import { useEffect, useState } from 'react'
import './Dashboard.css'
import { nhost } from './lib/nhost'

const ORGANIZATION_ID =
  'c55609d5-c8d3-491c-8de6-a787b5a2e109'

function Dashboard({
  user,
  onLogout,
  onCreateWorkflow,
  onEditWorkflow,
  onRunHistory,
  refreshKey
}) {

  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)

  const [runningWorkflowId, setRunningWorkflowId] =
    useState(null)

  const [deletingWorkflowId, setDeletingWorkflowId] =
    useState(null)

  const [error, setError] = useState('')

  const [runCount, setRunCount] =
    useState(0)

  const [loadingRuns, setLoadingRuns] =
    useState(true)


  // =====================================================
  // GRAPHQL ERROR HELPER
  // =====================================================

  const getGraphQLError = response => {

    if (response?.body?.errors?.length) {

      return response.body.errors
        .map(error => error.message)
        .join('\n')

    }

    return null
  }


  // =====================================================
  // LOAD WORKFLOWS
  // =====================================================

  const loadWorkflows = async () => {

    if (!user?.id) {

      setWorkflows([])
      setLoading(false)

      return
    }

    try {

      setLoading(true)
      setError('')


      const query = `
        query GetWorkflows(
          $orgId: uuid!
        ) {

          workflows(
            where: {
              org_id: {
                _eq: $orgId
              }
            }

            order_by: {
              created_at: desc
            }
          ) {

            id
            org_id
            name
            description
            created_at
            updated_at

            workflow_triggers {

              id
              workflow_id
              type
              config
              created_at

            }

            workflow_steps {

              id
              workflow_id
              name
              type
              config
              created_at

            }

          }

        }
      `


      const response =
        await nhost.graphql.request({

          query,

          variables: {
            orgId:
              ORGANIZATION_ID
          }

        })


      const graphQLError =
        getGraphQLError(response)


      if (graphQLError) {

        throw new Error(
          graphQLError
        )

      }


      const data =
        response
          ?.body
          ?.data
          ?.workflows


      setWorkflows(
        data || []
      )


    } catch (error) {

      console.error(
        'LOAD WORKFLOWS ERROR:',
        error
      )

      setError(
        error?.message ||
        'Failed to load workflows.'
      )

      setWorkflows([])

    } finally {

      setLoading(false)

    }

  }


  // =====================================================
  // LOAD RUN COUNT
  // =====================================================

  const loadRunCount = async () => {

    if (!user?.id) {

      setRunCount(0)
      setLoadingRuns(false)

      return
    }

    try {

      setLoadingRuns(true)


      const query = `
        query GetWorkflowRuns(
          $orgId: uuid!
        ) {

          workflow_runs(
            where: {
              workflow: {
                org_id: {
                  _eq: $orgId
                }
              }
            }
          ) {

            id

          }

        }
      `


      const response =
        await nhost.graphql.request({

          query,

          variables: {
            orgId:
              ORGANIZATION_ID
          }

        })


      const graphQLError =
        getGraphQLError(response)


      if (graphQLError) {

        throw new Error(
          graphQLError
        )

      }


      const runs =
        response
          ?.body
          ?.data
          ?.workflow_runs || []


      setRunCount(
        runs.length
      )


    } catch (error) {

      console.error(
        'RUN COUNT ERROR:',
        error
      )

      setRunCount(0)

    } finally {

      setLoadingRuns(false)

    }

  }


  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {

    if (!user?.id) {
      return
    }

    loadWorkflows()
    loadRunCount()

  }, [
    user?.id,
    refreshKey
  ])


  // =====================================================
  // RUN WORKFLOW
  // =====================================================

  const handleRunWorkflow = async workflow => {

    if (!user?.id) {

      alert(
        'Your login session is missing. Please login again.'
      )

      return
    }


    const steps =
      workflow.workflow_steps || []


    if (steps.length === 0) {

      alert(
        'This workflow has no steps.'
      )

      return
    }


    let workflowRunId = null


    try {

      setRunningWorkflowId(
        workflow.id
      )


      // =================================================
      // 1. CREATE WORKFLOW RUN
      // =================================================

      const runMutation = `
        mutation CreateWorkflowRun(
          $workflowId: uuid!
          $status: String!
          $startedAt: timestamptz!
        ) {

          insert_workflow_runs_one(
            object: {
              workflow_id: $workflowId
              status: $status
              started_at: $startedAt
            }
          ) {

            id
            workflow_id
            status
            started_at
            created_at

          }

        }
      `


      const runResponse =
        await nhost.graphql.request({

          query:
            runMutation,

          variables: {

            workflowId:
              workflow.id,

            status:
              'running',

            startedAt:
              new Date().toISOString()

          }

        })


      const runError =
        getGraphQLError(
          runResponse
        )


      if (runError) {

        throw new Error(
          runError
        )

      }


      const workflowRun =
        runResponse
          ?.body
          ?.data
          ?.insert_workflow_runs_one


      if (!workflowRun) {

        throw new Error(
          'Workflow run was not created.'
        )

      }


      workflowRunId =
        workflowRun.id


      // =================================================
      // 2. USE DATABASE ORDER
      // =================================================

      const orderedSteps =
        [...steps]


      let previousOutput = null


      // =================================================
      // 3. RUN EACH STEP
      // =================================================

      for (
        let index = 0;
        index < orderedSteps.length;
        index++
      ) {

        const step =
          orderedSteps[index]


        // -----------------------------------------------
        // CREATE STEP RUN
        // -----------------------------------------------

        const stepRunMutation = `
          mutation CreateStepRun(
            $workflowRunId: uuid!
            $stepId: uuid!
            $status: String!
            $input: jsonb!
            $startedAt: timestamptz!
          ) {

            insert_step_runs_one(
              object: {
                workflow_run_id: $workflowRunId
                step_id: $stepId
                status: $status
                input: $input
                started_at: $startedAt
              }
            ) {

              id
              status

            }

          }
        `


        const stepRunResponse =
          await nhost.graphql.request({

            query:
              stepRunMutation,

            variables: {

              workflowRunId:
                workflowRun.id,

              stepId:
                step.id,

              status:
                'running',

              input: {

                step_number:
                  index + 1,

                step_name:
                  step.name,

                type:
                  step.type,

                config:
                  step.config,

                previous_output:
                  previousOutput

              },

              startedAt:
                new Date().toISOString()

            }

          })


        const stepRunError =
          getGraphQLError(
            stepRunResponse
          )


        if (stepRunError) {

          throw new Error(
            stepRunError
          )

        }


        const stepRun =
          stepRunResponse
            ?.body
            ?.data
            ?.insert_step_runs_one


        if (!stepRun) {

          throw new Error(
            `Step ${index + 1} run was not created.`
          )

        }


        // -----------------------------------------------
        // EXECUTE STEP
        // -----------------------------------------------

        let output = null


        if (
          step.type ===
          'llm_call'
        ) {

          output = {

            success:
              true,

            type:
              'llm_call',

            message:
              'LLM step executed successfully.',

            prompt:
              step.config?.prompt ||
              '',

            previous_output:
              previousOutput,

            executed_at:
              new Date().toISOString()

          }

        } else {

          output = {

            success:
              true,

            type:
              step.type,

            message:
              `${step.type} step executed successfully.`,

            config:
              step.config,

            previous_output:
              previousOutput,

            executed_at:
              new Date().toISOString()

          }

        }


        // -----------------------------------------------
        // COMPLETE STEP RUN
        // -----------------------------------------------

        const completeStepMutation = `
          mutation CompleteStepRun(
            $id: uuid!
            $status: String!
            $output: jsonb!
            $completedAt: timestamptz!
          ) {

            update_step_runs_by_pk(
              pk_columns: {
                id: $id
              }

              _set: {
                status: $status
                output: $output
                completed_at: $completedAt
              }
            ) {

              id
              status

            }

          }
        `


        const completeStepResponse =
          await nhost.graphql.request({

            query:
              completeStepMutation,

            variables: {

              id:
                stepRun.id,

              status:
                'completed',

              output,

              completedAt:
                new Date().toISOString()

            }

          })


        const completeStepError =
          getGraphQLError(
            completeStepResponse
          )


        if (completeStepError) {

          throw new Error(
            completeStepError
          )

        }


        previousOutput =
          output

      }


      // =================================================
      // 4. COMPLETE WORKFLOW RUN
      // =================================================

      // IMPORTANT:
      // workflow_runs does NOT have an "error" column.
      // Therefore we do NOT send error: null here.

      const completeRunMutation = `
        mutation CompleteWorkflowRun(
          $id: uuid!
          $status: String!
          $completedAt: timestamptz!
        ) {

          update_workflow_runs_by_pk(
            pk_columns: {
              id: $id
            }

            _set: {
              status: $status
              completed_at: $completedAt
            }
          ) {

            id
            status
            completed_at

          }

        }
      `


      const completeRunResponse =
        await nhost.graphql.request({

          query:
            completeRunMutation,

          variables: {

            id:
              workflowRun.id,

            status:
              'completed',

            completedAt:
              new Date().toISOString()

          }

        })


      const completeRunError =
        getGraphQLError(
          completeRunResponse
        )


      if (completeRunError) {

        throw new Error(
          completeRunError
        )

      }


      await loadRunCount()


      alert(
        `Workflow "${workflow.name}" completed successfully!`
      )


    } catch (error) {

      console.error(
        'WORKFLOW RUN ERROR:',
        error
      )


      // =================================================
      // MARK WORKFLOW RUN AS FAILED
      // =================================================

      if (workflowRunId) {

        try {

          // IMPORTANT:
          // workflow_runs has no "error" column.
          // Only update the status and completed_at.

          const failRunMutation = `
            mutation FailWorkflowRun(
              $id: uuid!
              $status: String!
              $completedAt: timestamptz!
            ) {

              update_workflow_runs_by_pk(
                pk_columns: {
                  id: $id
                }

                _set: {
                  status: $status
                  completed_at: $completedAt
                }
              ) {

                id
                status

              }

            }
          `


          const failResponse =
            await nhost.graphql.request({

              query:
                failRunMutation,

              variables: {

                id:
                  workflowRunId,

                status:
                  'failed',

                completedAt:
                  new Date().toISOString()

              }

            })


          const failError =
            getGraphQLError(
              failResponse
            )


          if (failError) {

            console.error(
              'FAILED TO MARK RUN AS FAILED:',
              failError
            )

          }

        } catch (
          updateError
        ) {

          console.error(
            'FAILED TO UPDATE WORKFLOW RUN:',
            updateError
          )

        }

      }


      alert(
        error?.message ||
        'Workflow execution failed.'
      )


      await loadRunCount()

    } finally {

      setRunningWorkflowId(null)

    }

  }


  // =====================================================
  // DELETE WORKFLOW
  // =====================================================

  const handleDeleteWorkflow =
    async workflow => {

      const confirmed =
        window.confirm(
          `Are you sure you want to delete "${workflow.name}"?`
        )


      if (!confirmed) {
        return
      }


      try {

        setDeletingWorkflowId(
          workflow.id
        )


        const workflowId =
          String(workflow.id)


        // =================================================
        // GET WORKFLOW RUNS
        // =================================================

        const runsQuery = `
          query GetRuns(
            $workflowId: uuid!
          ) {

            workflow_runs(
              where: {
                workflow_id: {
                  _eq: $workflowId
                }
              }
            ) {

              id

            }

          }
        `


        const runsResponse =
          await nhost.graphql.request({

            query:
              runsQuery,

            variables: {
              workflowId
            }

          })


        const runsError =
          getGraphQLError(
            runsResponse
          )


        if (runsError) {

          throw new Error(
            runsError
          )

        }


        const runs =
          runsResponse
            ?.body
            ?.data
            ?.workflow_runs || []


        // =================================================
        // DELETE STEP RUNS
        // =================================================

        for (
          const run of runs
        ) {

          const deleteStepRunsMutation = `
            mutation DeleteStepRuns(
              $runId: uuid!
            ) {

              delete_step_runs(
                where: {
                  workflow_run_id: {
                    _eq: $runId
                  }
                }
              ) {

                affected_rows

              }

            }
          `


          const response =
            await nhost.graphql.request({

              query:
                deleteStepRunsMutation,

              variables: {

                runId:
                  run.id

              }

            })


          const error =
            getGraphQLError(
              response
            )


          if (error) {

            throw new Error(
              error
            )

          }

        }


        // =================================================
        // DELETE WORKFLOW RUNS
        // =================================================

        const deleteRunsMutation = `
          mutation DeleteRuns(
            $workflowId: uuid!
          ) {

            delete_workflow_runs(
              where: {
                workflow_id: {
                  _eq: $workflowId
                }
              }
            ) {

              affected_rows

            }

          }
        `


        let response =
          await nhost.graphql.request({

            query:
              deleteRunsMutation,

            variables: {
              workflowId
            }

          })


        let error =
          getGraphQLError(
            response
          )


        if (error) {

          throw new Error(
            error
          )

        }


        // =================================================
        // DELETE TRIGGERS
        // =================================================

        const deleteTriggersMutation = `
          mutation DeleteTriggers(
            $workflowId: uuid!
          ) {

            delete_workflow_triggers(
              where: {
                workflow_id: {
                  _eq: $workflowId
                }
              }
            ) {

              affected_rows

            }

          }
        `


        response =
          await nhost.graphql.request({

            query:
              deleteTriggersMutation,

            variables: {
              workflowId
            }

          })


        error =
          getGraphQLError(
            response
          )


        if (error) {

          throw new Error(
            error
          )

        }


        // =================================================
        // DELETE STEPS
        // =================================================

        const deleteStepsMutation = `
          mutation DeleteSteps(
            $workflowId: uuid!
          ) {

            delete_workflow_steps(
              where: {
                workflow_id: {
                  _eq: $workflowId
                }
              }
            ) {

              affected_rows

            }

          }
        `


        response =
          await nhost.graphql.request({

            query:
              deleteStepsMutation,

            variables: {
              workflowId
            }

          })


        error =
          getGraphQLError(
            response
          )


        if (error) {

          throw new Error(
            error
          )

        }


        // =================================================
        // DELETE WORKFLOW
        // =================================================

        const deleteWorkflowMutation = `
          mutation DeleteWorkflow(
            $workflowId: uuid!
          ) {

            delete_workflows(
              where: {
                id: {
                  _eq: $workflowId
                }
              }
            ) {

              affected_rows

            }

          }
        `


        response =
          await nhost.graphql.request({

            query:
              deleteWorkflowMutation,

            variables: {
              workflowId
            }

          })


        error =
          getGraphQLError(
            response
          )


        if (error) {

          throw new Error(
            error
          )

        }


        setWorkflows(
          previous =>
            previous.filter(
              item =>
                item.id !==
                workflow.id
            )
        )


        await loadRunCount()


        alert(
          `Workflow "${workflow.name}" deleted successfully!`
        )


      } catch (error) {

        console.error(
          'DELETE WORKFLOW ERROR:',
          error
        )


        alert(
          error?.message ||
          'Failed to delete workflow.'
        )

      } finally {

        setDeletingWorkflowId(null)

      }

    }


  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = date => {

    if (!date) {
      return 'Not available'
    }


    const parsed =
      new Date(date)


    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {

      return 'Not available'

    }


    return parsed.toLocaleString()

  }


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="dashboard">

      <header className="dashboard-header">

        <div>

          <h1>
            ⚡ AI Agent Workflow Builder
          </h1>

          <p>
            Build, automate and manage AI workflows
          </p>

        </div>


        <button
          type="button"
          onClick={onLogout}
        >
          Logout
        </button>

      </header>


      <main className="dashboard-content">

        <h2>
          Welcome back! 👋
        </h2>


        <p className="user-email">
          {user?.email || 'User'}
        </p>


        <div className="stats">

          <div className="stat-card">

            <h3>
              {workflows.length}
            </h3>

            <p>
              Workflows
            </p>

          </div>


          <div className="stat-card">

            <h3>

              {loadingRuns
                ? '...'
                : runCount}

            </h3>

            <p>
              Workflow Runs
            </p>

          </div>


          <div className="stat-card">

            <h3>
              {workflows.length}
            </h3>

            <p>
              Active Workflows
            </p>

          </div>

        </div>


        <div className="workflow-section">

          <div>

            <h2>
              Your Workflows
            </h2>

            <p>
              Create and manage your AI workflows.
            </p>

          </div>


          <button
            type="button"
            className="create-button"
            onClick={
              onCreateWorkflow
            }
          >
            + Create Workflow
          </button>

        </div>


        {error && (

          <div
            style={{
              marginTop:
                '20px',

              padding:
                '15px',

              borderRadius:
                '8px',

              background:
                '#ffecec',

              color:
                '#b00020'
            }}
          >

            <strong>
              Error:
            </strong>

            <p>
              {error}
            </p>

          </div>

        )}


        {loading && (

          <div
            style={{
              marginTop:
                '30px',

              textAlign:
                'center'
            }}
          >

            Loading workflows...

          </div>

        )}


        {!loading &&
          !error &&
          workflows.length === 0 && (

            <div
              style={{
                marginTop:
                  '30px',

                padding:
                  '30px',

                textAlign:
                  'center',

                border:
                  '1px solid #ddd',

                borderRadius:
                  '12px'
              }}
            >

              <h3>
                No workflows found
              </h3>


              <p>
                Create your first workflow.
              </p>


              <button
                type="button"
                className="create-button"
                onClick={
                  onCreateWorkflow
                }
              >
                + Create Workflow
              </button>

            </div>

          )}


        {!loading &&
          !error &&
          workflows.length > 0 && (

            <div
              style={{
                marginTop:
                  '30px',

                display:
                  'grid',

                gap:
                  '20px'
              }}
            >

              {workflows.map(
                workflow => {

                  const isRunning =
                    runningWorkflowId ===
                    workflow.id


                  const isDeleting =
                    deletingWorkflowId ===
                    workflow.id


                  const steps =
                    workflow.workflow_steps ||
                    []


                  const trigger =
                    workflow.workflow_triggers?.[0]


                  return (

                    <div
                      key={
                        workflow.id
                      }

                      style={{
                        border:
                          '1px solid #ddd',

                        borderRadius:
                          '12px',

                        padding:
                          '20px',

                        background:
                          '#fff'
                      }}
                    >

                      <h3>
                        {workflow.name}
                      </h3>


                      <p>
                        {workflow.description ||
                          'No description'}
                      </p>


                      <p>

                        <strong>
                          Trigger:
                        </strong>{' '}

                        {trigger?.type ||
                          'manual'}

                      </p>


                      <p>

                        <strong>
                          Status:
                        </strong>{' '}

                        Active 🟢

                      </p>


                      <p>

                        <strong>
                          Steps:
                        </strong>{' '}

                        {steps.length}

                      </p>


                      <p>

                        <strong>
                          Created:
                        </strong>{' '}

                        {formatDate(
                          workflow.created_at
                        )}

                      </p>


                      {steps.length > 0 && (

                        <div
                          style={{
                            marginTop:
                              '15px',

                            padding:
                              '12px',

                            background:
                              '#f8f9fa',

                            borderRadius:
                              '8px'
                          }}
                        >

                          <strong>
                            Steps:
                          </strong>


                          <ol>

                            {steps.map(
                              (step, index) => (

                                <li
                                  key={
                                    step.id
                                  }
                                >

                                  {step.name ||
                                    `Step ${index + 1}`}

                                  {' — '}

                                  {step.type}

                                </li>

                              )
                            )}

                          </ol>

                        </div>

                      )}


                      <div
                        style={{
                          display:
                            'flex',

                          gap:
                            '10px',

                          marginTop:
                            '15px',

                          flexWrap:
                            'wrap'
                        }}
                      >

                        <button
                          type="button"
                          onClick={() =>
                            onEditWorkflow(
                              workflow
                            )
                          }

                          disabled={
                            isRunning ||
                            isDeleting
                          }
                        >
                          ✏️ Edit
                        </button>


                        <button
                          type="button"
                          onClick={() =>
                            handleRunWorkflow(
                              workflow
                            )
                          }

                          disabled={
                            isRunning ||
                            isDeleting ||
                            steps.length === 0
                          }
                        >

                          {isRunning
                            ? 'Running...'
                            : '▶️ Run'}

                        </button>


                        <button
                          type="button"
                          onClick={() =>
                            onRunHistory(
                              workflow
                            )
                          }

                          disabled={
                            isRunning ||
                            isDeleting
                          }
                        >
                          📋 Run History
                        </button>


                        <button
                          type="button"

                          onClick={() =>
                            handleDeleteWorkflow(
                              workflow
                            )
                          }

                          disabled={
                            isDeleting ||
                            isRunning
                          }

                          style={{
                            background:
                              '#dc3545',

                            color:
                              '#fff',

                            border:
                              'none',

                            padding:
                              '8px 14px',

                            borderRadius:
                              '6px',

                            cursor:
                              'pointer'
                          }}
                        >

                          {isDeleting
                            ? 'Deleting...'
                            : '🗑️ Delete'}

                        </button>

                      </div>

                    </div>

                  )

                }
              )}

            </div>

          )}

      </main>

    </div>

  )

}


export default Dashboard