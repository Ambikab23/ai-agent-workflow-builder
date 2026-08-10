import { useEffect, useState } from 'react'
import './Dashboard.css'
import { nhost } from './lib/nhost'

function Dashboard({
  user,
  onLogout,
  onCreateWorkflow,
  onEditWorkflow
}) {

  // =====================================================
  // STATE
  // =====================================================

  const [workflows, setWorkflows] = useState([])

  const [loading, setLoading] = useState(true)

  const [runningWorkflowId, setRunningWorkflowId] =
    useState(null)

  const [deletingWorkflowId, setDeletingWorkflowId] =
    useState(null)

  const [error, setError] = useState('')

  const [runCount, setRunCount] = useState(0)

  const [loadingRuns, setLoadingRuns] =
    useState(true)


  // =====================================================
  // ORGANIZATION
  // =====================================================

  const ORGANIZATION_ID =
    'c55609d5-c8d3-491c-8de6-a787b5a2e109'


  // =====================================================
  // LOAD WORKFLOWS
  // =====================================================

  const loadWorkflows = async () => {

    if (!user?.id) {

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
            created_by
            created_at
            updated_at

            workflow_triggers {

              id
              workflow_id
              type
              config
              enabled
              created_at

            }

            workflow_steps {

              id
              workflow_id
              name
              step_order
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
            orgId: ORGANIZATION_ID
          }

        })


      console.log(
        'WORKFLOW RESPONSE:',
        response
      )


      if (
        response?.body?.errors?.length
      ) {

        console.error(
          'GraphQL errors:',
          response.body.errors
        )

        setError(
          response.body.errors
            .map(error => error.message)
            .join('\n')
        )

        return
      }


      const data =
        response
          ?.body
          ?.data
          ?.workflows


      if (!data) {

        setError(
          'Workflows were not returned by the database.'
        )

        return
      }


      setWorkflows(data)

    } catch (error) {

      console.error(
        'LOAD WORKFLOWS ERROR:',
        error
      )

      setError(
        error?.message ||
        'Failed to load workflows.'
      )

    } finally {

      setLoading(false)

    }

  }


  // =====================================================
  // LOAD WORKFLOW RUN COUNT
  // =====================================================

  const loadRunCount = async () => {

    if (!user?.id) {

      setLoadingRuns(false)

      return
    }


    try {

      setLoadingRuns(true)


      const query = `
        query GetWorkflowRuns {

          workflow_runs_aggregate {

            aggregate {
              count
            }

          }

        }
      `


      const response =
        await nhost.graphql.request({
          query
        })


      console.log(
        'RUN COUNT RESPONSE:',
        response
      )


      if (
        response?.body?.errors?.length
      ) {

        console.error(
          'RUN COUNT ERROR:',
          response.body.errors
        )

        return
      }


      const count =
        response
          ?.body
          ?.data
          ?.workflow_runs_aggregate
          ?.aggregate
          ?.count


      setRunCount(
        count || 0
      )

    } catch (error) {

      console.error(
        'LOAD RUN COUNT ERROR:',
        error
      )

    } finally {

      setLoadingRuns(false)

    }

  }


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {

    if (!user?.id) {
      return
    }

    loadWorkflows()

    loadRunCount()

  }, [user?.id])


  // =====================================================
  // RUN WORKFLOW
  // =====================================================

  const handleRunWorkflow = async (
    workflow
  ) => {

    if (!user?.id) {

      alert(
        'Your login session is missing. Please login again.'
      )

      return
    }


    if (!workflow?.id) {

      alert(
        'Workflow ID is missing.'
      )

      return
    }


    const steps =
      workflow.workflow_steps || []


    if (steps.length === 0) {

      alert(
        'This workflow has no steps. Please edit the workflow and add at least one step.'
      )

      return
    }


    try {

      setRunningWorkflowId(
        workflow.id
      )


      console.log(
        '================================'
      )

      console.log(
        'STARTING WORKFLOW'
      )

      console.log(
        'Workflow:',
        workflow.name
      )

      console.log(
        'Workflow ID:',
        workflow.id
      )

      console.log(
        'Number of steps:',
        steps.length
      )

      console.log(
        '================================'
      )


      // =================================================
      // CREATE WORKFLOW RUN
      // =================================================

      const createRunMutation = `
        mutation CreateWorkflowRun(
          $workflowId: uuid!
        ) {

          insert_workflow_runs_one(
            object: {
              workflow_id: $workflowId
              status: "pending"
            }
          ) {

            id
            workflow_id
            status
            started_at
            completed_at
            error
            created_by
            created_at

          }

        }
      `


      const runResponse =
        await nhost.graphql.request({

          query: createRunMutation,

          variables: {
            workflowId: String(workflow.id)
          }

        })


      console.log(
        'CREATE WORKFLOW RUN RESPONSE:',
        runResponse
      )


      if (
        runResponse?.body?.errors?.length
      ) {

        alert(
          runResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

        return
      }


      const workflowRun =
        runResponse
          ?.body
          ?.data
          ?.insert_workflow_runs_one


      if (!workflowRun) {

        alert(
          'Workflow run was not created.'
        )

        return
      }


      // =================================================
      // CREATE STEP RUNS
      // =================================================

      for (
        const step of steps
      ) {

        const createStepRunMutation = `
          mutation CreateStepRun(
            $workflowRunId: uuid!
            $stepId: uuid!
          ) {

            insert_step_runs_one(
              object: {

                workflow_run_id: $workflowRunId

                step_id: $stepId

                status: "pending"

                attempt_count: 1

              }
            ) {

              id
              workflow_run_id
              step_id
              status
              attempt_count
              created_at

            }

          }
        `


        const stepResponse =
          await nhost.graphql.request({

            query: createStepRunMutation,

            variables: {

              workflowRunId:
                String(workflowRun.id),

              stepId:
                String(step.id)

            }

          })


        console.log(
          'STEP RUN RESPONSE:',
          stepResponse
        )


        if (
          stepResponse?.body?.errors?.length
        ) {

          alert(
            stepResponse.body.errors
              .map(error => error.message)
              .join('\n')
          )

          return
        }

      }


      // =================================================
      // UPDATE RUN COUNT
      // =================================================

      setRunCount(
        previous => previous + 1
      )


      alert(
        `Workflow "${workflow.name}" started successfully!`
      )


      await loadRunCount()

      await loadWorkflows()


    } catch (error) {

      console.error(
        'WORKFLOW RUN ERROR:',
        error
      )

      alert(
        error?.message ||
        'Something went wrong while running the workflow.'
      )

    } finally {

      setRunningWorkflowId(null)

    }

  }


  // =====================================================
  // DELETE WORKFLOW
  // =====================================================

  const handleDeleteWorkflow = async (
    workflow
  ) => {

    if (!user?.id) {

      alert(
        'Your login session is missing. Please login again.'
      )

      return
    }


    if (!workflow?.id) {

      alert(
        'Workflow ID is missing.'
      )

      return
    }


    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${workflow.name}"?\n\nThis will delete the workflow, steps, triggers and run history.`
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


      console.log(
        '================================'
      )

      console.log(
        'DELETE WORKFLOW'
      )

      console.log(
        'Workflow ID:',
        workflowId
      )

      console.log(
        'ID TYPE:',
        typeof workflowId
      )

      console.log(
        'Workflow:',
        workflow.name
      )

      console.log(
        '================================'
      )


      // =================================================
      // STEP 1
      // FIND WORKFLOW RUNS
      // =================================================

      const getRunsQuery = `
        query GetWorkflowRuns(
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

          query: getRunsQuery,

          variables: {
            workflowId: workflowId
          }

        })


      console.log(
        'WORKFLOW RUNS:',
        runsResponse
      )


      if (
        runsResponse?.body?.errors?.length
      ) {

        throw new Error(
          runsResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

      }


      const workflowRuns =
        runsResponse
          ?.body
          ?.data
          ?.workflow_runs || []


      // =================================================
      // STEP 2
      // DELETE STEP RUNS
      // =================================================

      for (
        const run of workflowRuns
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


        const stepRunsResponse =
          await nhost.graphql.request({

            query:
              deleteStepRunsMutation,

            variables: {

              runId:
                String(run.id)

            }

          })


        console.log(
          'DELETE STEP RUNS:',
          stepRunsResponse
        )


        if (
          stepRunsResponse?.body?.errors?.length
        ) {

          throw new Error(
            stepRunsResponse.body.errors
              .map(error => error.message)
              .join('\n')
          )

        }

      }


      // =================================================
      // STEP 3
      // DELETE WORKFLOW RUNS
      // =================================================

      const deleteRunsMutation = `
        mutation DeleteWorkflowRuns(
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


      const deleteRunsResponse =
        await nhost.graphql.request({

          query:
            deleteRunsMutation,

          variables: {
            workflowId: workflowId
          }

        })


      console.log(
        'DELETE WORKFLOW RUNS:',
        deleteRunsResponse
      )


      if (
        deleteRunsResponse?.body?.errors?.length
      ) {

        throw new Error(
          deleteRunsResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

      }


      // =================================================
      // STEP 4
      // DELETE TRIGGERS
      // =================================================

      const deleteTriggersMutation = `
        mutation DeleteWorkflowTriggers(
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


      const triggersResponse =
        await nhost.graphql.request({

          query:
            deleteTriggersMutation,

          variables: {
            workflowId: workflowId
          }

        })


      console.log(
        'DELETE TRIGGERS:',
        triggersResponse
      )


      if (
        triggersResponse?.body?.errors?.length
      ) {

        throw new Error(
          triggersResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

      }


      // =================================================
      // STEP 5
      // DELETE WORKFLOW STEPS
      // =================================================

      const deleteStepsMutation = `
        mutation DeleteWorkflowSteps(
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


      const stepsResponse =
        await nhost.graphql.request({

          query:
            deleteStepsMutation,

          variables: {
            workflowId: workflowId
          }

        })


      console.log(
        'DELETE WORKFLOW STEPS:',
        stepsResponse
      )


      if (
        stepsResponse?.body?.errors?.length
      ) {

        throw new Error(
          stepsResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

      }


      // =================================================
      // STEP 6
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

            returning {
              id
              name
            }

          }

        }
      `


      const workflowResponse =
        await nhost.graphql.request({

          query:
            deleteWorkflowMutation,

          variables: {

            // VERY IMPORTANT
            // UUID is sent as STRING

            workflowId:
              String(workflow.id)

          }

        })


      console.log(
        'DELETE WORKFLOW RESPONSE:',
        workflowResponse
      )


      if (
        workflowResponse?.body?.errors?.length
      ) {

        throw new Error(
          workflowResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

      }


      const deleted =
        workflowResponse
          ?.body
          ?.data
          ?.delete_workflows


      console.log(
        'DELETED RESULT:',
        deleted
      )


      if (
        !deleted ||
        deleted.affected_rows === 0
      ) {

        throw new Error(
          'Workflow was not deleted. Check your Hasura permissions.'
        )

      }


      // =================================================
      // REMOVE FROM UI
      // =================================================

      setWorkflows(
        previousWorkflows =>
          previousWorkflows.filter(
            item =>
              item.id !== workflow.id
          )
      )


      alert(
        `Workflow "${workflow.name}" deleted successfully!`
      )


      // Refresh counts

      await loadWorkflows()

      await loadRunCount()


    } catch (error) {

      console.error(
        'DELETE WORKFLOW ERROR:',
        error
      )


      console.error(
        'ERROR MESSAGE:',
        error?.message
      )


      alert(
        error?.message ||
        'Failed to delete workflow.'
      )

    } finally {

      setDeletingWorkflowId(
        null
      )

    }

  }


  // =====================================================
  // ACTIVE WORKFLOW COUNT
  // =====================================================

  const activeWorkflowCount =
    workflows.filter(
      workflow => {

        const triggers =
          workflow.workflow_triggers || []


        return triggers.some(
          trigger =>
            trigger.enabled === true
        )

      }
    ).length


  // =====================================================
  // EDIT WORKFLOW
  // =====================================================

  const handleEditWorkflow = (
    workflow
  ) => {

    console.log(
      'EDIT WORKFLOW:',
      workflow
    )


    if (onEditWorkflow) {

      onEditWorkflow(
        workflow
      )

    } else {

      alert(
        'Edit functionality is not connected yet.'
      )

    }

  }


  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (
    date
  ) => {

    if (!date) {
      return 'Unknown'
    }


    return new Date(
      date
    ).toLocaleString()

  }


  // =====================================================
  // GET TRIGGER
  // =====================================================

  const getTrigger = (
    workflow
  ) => {

    const triggers =
      workflow.workflow_triggers || []


    if (
      triggers.length === 0
    ) {

      return 'No trigger'

    }


    return (
      triggers[0]?.type ||
      'manual'
    )

  }


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="dashboard">


      {/* =================================================
          HEADER
      ================================================= */}

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


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="dashboard-content">


        {/* =================================================
            WELCOME
        ================================================= */}

        <h2>
          Welcome back! 👋
        </h2>


        <p className="user-email">
          {user?.email || 'User'}
        </p>


        {/* =================================================
            STATISTICS
        ================================================= */}

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
              {activeWorkflowCount}
            </h3>

            <p>
              Active Workflows
            </p>

          </div>


        </div>


        {/* =================================================
            WORKFLOW HEADER
        ================================================= */}

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
            onClick={onCreateWorkflow}
          >
            + Create Workflow
          </button>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (

          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              borderRadius: '8px',
              background: '#ffecec',
              color: '#b00020'
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


        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (

          <div
            style={{
              marginTop: '30px',
              textAlign: 'center'
            }}
          >

            Loading workflows...

          </div>

        )}


        {/* =================================================
            NO WORKFLOWS
        ================================================= */}

        {!loading &&
          !error &&
          workflows.length === 0 && (

            <div
              style={{
                marginTop: '30px',
                padding: '30px',
                textAlign: 'center',
                border: '1px solid #ddd',
                borderRadius: '12px'
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
                onClick={onCreateWorkflow}
              >
                + Create Workflow
              </button>

            </div>

          )}


        {/* =================================================
            WORKFLOW LIST
        ================================================= */}

        {!loading &&
          !error &&
          workflows.length > 0 && (

            <div
              style={{
                marginTop: '30px',
                display: 'grid',
                gap: '20px'
              }}
            >

              {workflows.map(
                workflow => {

                  const trigger =
                    getTrigger(
                      workflow
                    )


                  const triggers =
                    workflow.workflow_triggers ||
                    []


                  const steps =
                    workflow.workflow_steps ||
                    []


                  const isActive =
                    triggers.some(
                      item =>
                        item.enabled === true
                    )


                  const isRunning =
                    runningWorkflowId ===
                    workflow.id


                  const isDeleting =
                    deletingWorkflowId ===
                    workflow.id


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


                      {/* NAME */}

                      <h3>
                        {workflow.name}
                      </h3>


                      {/* DESCRIPTION */}

                      <p>
                        {workflow.description ||
                          'No description'}
                      </p>


                      {/* TRIGGER */}

                      <p>

                        <strong>
                          Trigger:
                        </strong>{' '}

                        {trigger}

                      </p>


                      {/* STATUS */}

                      <p>

                        <strong>
                          Status:
                        </strong>{' '}

                        {isActive
                          ? 'Active'
                          : 'Inactive'}

                      </p>


                      {/* STEPS */}

                      <p>

                        <strong>
                          Steps:
                        </strong>{' '}

                        {steps.length}

                      </p>


                      {/* CREATED */}

                      <p>

                        <strong>
                          Created:
                        </strong>{' '}

                        {formatDate(
                          workflow.created_at
                        )}

                      </p>


                      {/* =================================================
                          BUTTONS
                      ================================================= */}

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


                        {/* EDIT */}

                        <button
                          type="button"
                          onClick={() =>
                            handleEditWorkflow(
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


                        {/* RUN */}

                        <button
                          type="button"
                          onClick={() =>
                            handleRunWorkflow(
                              workflow
                            )
                          }
                          disabled={
                            isRunning ||
                            isDeleting
                          }
                        >

                          {isRunning
                            ? 'Running...'
                            : '▶️ Run'}

                        </button>


                        {/* DELETE */}

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
                              '#ffffff',

                            border:
                              'none',

                            padding:
                              '8px 14px',

                            borderRadius:
                              '6px',

                            cursor:
                              isDeleting ||
                              isRunning
                                ? 'not-allowed'
                                : 'pointer'
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