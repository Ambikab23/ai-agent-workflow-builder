import { useEffect, useState } from 'react'
import './Dashboard.css'
import { nhost } from './lib/nhost'

function Dashboard({
  user,
  onLogout,
  onCreateWorkflow,
  onEditWorkflow,
  onRunHistory
}) {

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
  // ORGANIZATION ID
  // =====================================================

  const ORGANIZATION_ID =
    'b5e42b9c-cb68-4bdc-9a06-cc3bf013cb58'


  // =====================================================
  // GRAPHQL ERROR HELPER
  // =====================================================

  const getGraphQLError = (response) => {

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
            status
            created_at
            updated_at

            workflow_triggers {

              id
              workflow_id
              type
              config
              created_at

            }

            workflow_steps(
              order_by: {
                position: asc
              }
            ) {

              id
              workflow_id
              name
              position
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

      const graphQLError =
        getGraphQLError(response)

      if (graphQLError) {

        console.error(
          'GRAPHQL ERRORS:',
          graphQLError
        )

        setError(graphQLError)

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
        query GetWorkflowRunCount {

          workflow_runs(
            order_by: {
              created_at: desc
            }
          ) {

            id
            workflow_id
            status
            created_at

            workflow {

              id
              org_id
              name

            }

          }

        }
      `

      const response =
        await nhost.graphql.request({
          query
        })

      console.log(
        'WORKFLOW RUN COUNT RESPONSE:',
        response
      )

      const graphQLError =
        getGraphQLError(response)

      if (graphQLError) {

        console.error(
          'RUN COUNT GRAPHQL ERROR:',
          graphQLError
        )

        setRunCount(0)

        return
      }

      const allRuns =
        response
          ?.body
          ?.data
          ?.workflow_runs || []

      console.log(
        'ALL WORKFLOW RUNS:',
        allRuns
      )

      const organizationRuns =
        allRuns.filter(
          run =>
            run?.workflow?.org_id ===
            ORGANIZATION_ID
        )

      console.log(
        'ORGANIZATION WORKFLOW RUNS:',
        organizationRuns
      )

      console.log(
        'ORGANIZATION RUN COUNT:',
        organizationRuns.length
      )

      setRunCount(
        organizationRuns.length
      )

    } catch (error) {

      console.error(
        'LOAD RUN COUNT ERROR:',
        error
      )

      setRunCount(0)

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
  // CREATE STEP RUN
  // =====================================================

  const createStepRun = async ({
    workflowRunId,
    workflowStepId,
    input
  }) => {

    const mutation = `
      mutation CreateStepRun(
        $workflowRunId: uuid!
        $workflowStepId: uuid!
        $status: String!
        $input: jsonb!
        $startedAt: timestamptz!
      ) {

        insert_step_runs_one(
          object: {
            workflow_run_id: $workflowRunId
            workflow_step_id: $workflowStepId
            status: $status
            input: $input
            started_at: $startedAt
          }
        ) {

          id
          workflow_run_id
          workflow_step_id
          status
          input
          output
          started_at
          completed_at
          created_at

        }

      }
    `

    const response =
      await nhost.graphql.request({

        query: mutation,

        variables: {

          workflowRunId:
            String(workflowRunId),

          workflowStepId:
            String(workflowStepId),

          status:
            'running',

          input:
            input || {},

          startedAt:
            new Date().toISOString()

        }

      })

    console.log(
      'CREATE STEP RUN RESPONSE:',
      response
    )

    const graphQLError =
      getGraphQLError(response)

    if (graphQLError) {

      throw new Error(
        graphQLError
      )

    }

    const stepRun =
      response
        ?.body
        ?.data
        ?.insert_step_runs_one

    if (!stepRun) {

      throw new Error(
        'Step run was not created.'
      )

    }

    return stepRun

  }


  // =====================================================
  // COMPLETE STEP RUN
  // =====================================================

  const completeStepRun = async ({
    stepRunId,
    output,
    status = 'completed'
  }) => {

    const mutation = `
      mutation CompleteStepRun(
        $stepRunId: uuid!
        $status: String!
        $output: jsonb!
        $completedAt: timestamptz!
      ) {

        update_step_runs_by_pk(
          pk_columns: {
            id: $stepRunId
          }

          _set: {
            status: $status
            output: $output
            completed_at: $completedAt
          }
        ) {

          id
          workflow_run_id
          workflow_step_id
          status
          input
          output
          started_at
          completed_at
          created_at

        }

      }
    `

    const response =
      await nhost.graphql.request({

        query: mutation,

        variables: {

          stepRunId:
            String(stepRunId),

          status,

          output:
            output || {},

          completedAt:
            new Date().toISOString()

        }

      })

    console.log(
      'COMPLETE STEP RUN RESPONSE:',
      response
    )

    const graphQLError =
      getGraphQLError(response)

    if (graphQLError) {

      throw new Error(
        graphQLError
      )

    }

    return (
      response
        ?.body
        ?.data
        ?.update_step_runs_by_pk
    )

  }


  // =====================================================
  // UPDATE WORKFLOW RUN
  // =====================================================

  const updateWorkflowRun = async ({
    runId,
    status
  }) => {

    const mutation = `
      mutation UpdateWorkflowRun(
        $runId: uuid!
        $status: String!
        $completedAt: timestamptz
      ) {

        update_workflow_runs_by_pk(
          pk_columns: {
            id: $runId
          }

          _set: {
            status: $status
            completed_at: $completedAt
          }
        ) {

          id
          workflow_id
          status
          started_at
          completed_at
          created_at

        }

      }
    `

    const response =
      await nhost.graphql.request({

        query: mutation,

        variables: {

          runId:
            String(runId),

          status,

          completedAt:
            status === 'completed' ||
            status === 'failed'
              ? new Date().toISOString()
              : null

        }

      })

    console.log(
      'UPDATE WORKFLOW RUN RESPONSE:',
      response
    )

    const graphQLError =
      getGraphQLError(response)

    if (graphQLError) {

      throw new Error(
        graphQLError
      )

    }

    return (
      response
        ?.body
        ?.data
        ?.update_workflow_runs_by_pk
    )

  }


  // =====================================================
  // EXECUTE STEP
  // =====================================================

  const executeStep = async ({
    step,
    previousOutput
  }) => {

    console.log(
      'EXECUTING STEP:',
      step
    )

    let config = {}

    try {

      if (
        typeof step.config === 'string'
      ) {

        config =
          JSON.parse(
            step.config
          )

      } else {

        config =
          step.config || {}

      }

    } catch {

      config = {
        prompt:
          String(step.config || '')
      }

    }

    const prompt =
      config?.prompt || ''


    // ===================================================
    // LLM CALL
    // ===================================================

    if (
      step.type === 'llm_call'
    ) {

      return {

        success:
          true,

        type:
          'llm_call',

        message:
          'LLM step executed successfully.',

        prompt,

        previous_output:
          previousOutput || null,

        executed_at:
          new Date().toISOString()

      }

    }


    // ===================================================
    // HTTP REQUEST
    // ===================================================

    if (
      step.type === 'http_request'
    ) {

      return {

        success:
          true,

        type:
          'http_request',

        message:
          'HTTP request step recognized. Real HTTP execution will be added next.',

        config,

        previous_output:
          previousOutput || null,

        executed_at:
          new Date().toISOString()

      }

    }


    // ===================================================
    // DATABASE WRITE
    // ===================================================

    if (
      step.type === 'db_write'
    ) {

      return {

        success:
          true,

        type:
          'db_write',

        message:
          'Database write step recognized. Real database execution will be added next.',

        config,

        previous_output:
          previousOutput || null,

        executed_at:
          new Date().toISOString()

      }

    }


    // ===================================================
    // NOTIFICATION
    // ===================================================

    if (
      step.type === 'notify'
    ) {

      return {

        success:
          true,

        type:
          'notify',

        message:
          'Notification step recognized. Real notification delivery will be added next.',

        config,

        previous_output:
          previousOutput || null,

        executed_at:
          new Date().toISOString()

      }

    }


    // ===================================================
    // CONDITIONAL
    // ===================================================

    if (
      step.type === 'conditional_branch'
    ) {

      return {

        success:
          true,

        type:
          'conditional_branch',

        message:
          'Conditional branch step recognized.',

        config,

        previous_output:
          previousOutput || null,

        executed_at:
          new Date().toISOString()

      }

    }


    // ===================================================
    // APPROVAL
    // ===================================================

    if (
      step.type === 'approval_gate'
    ) {

      return {

        success:
          true,

        type:
          'approval_gate',

        message:
          'Approval gate step recognized.',

        config,

        previous_output:
          previousOutput || null,

        executed_at:
          new Date().toISOString()

      }

    }


    throw new Error(
      `Unsupported workflow step type: ${step.type}`
    )

  }


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

    if (
      runningWorkflowId === workflow.id
    ) {

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
        'STARTING WORKFLOW EXECUTION'
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
          $startedAt: timestamptz!
        ) {

          insert_workflow_runs_one(
            object: {
              workflow_id: $workflowId
              status: "running"
              started_at: $startedAt
            }
          ) {

            id
            workflow_id
            status
            started_at
            completed_at
            created_at

          }

        }
      `

      const runResponse =
        await nhost.graphql.request({

          query:
            createRunMutation,

          variables: {

            workflowId:
              String(workflow.id),

            startedAt:
              new Date().toISOString()

          }

        })

      console.log(
        'CREATE WORKFLOW RUN RESPONSE:',
        runResponse
      )

      const createRunError =
        getGraphQLError(runResponse)

      if (createRunError) {

        throw new Error(
          createRunError
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

      console.log(
        'WORKFLOW RUN CREATED:',
        workflowRun
      )


      // =================================================
      // EXECUTE STEPS
      // =================================================

      let previousOutput = null

      for (
        let index = 0;
        index < steps.length;
        index++
      ) {

        const step =
          steps[index]

        console.log(
          '--------------------------------'
        )

        console.log(
          `STARTING STEP ${index + 1}`
        )

        console.log(
          'STEP:',
          step
        )


        // =================================================
        // CREATE STEP RUN
        // =================================================

        const stepRun =
          await createStepRun({

            workflowRunId:
              workflowRun.id,

            workflowStepId:
              step.id,

            input: {

              step_number:
                index + 1,

              step_name:
                step.name,

              type:
                step.type,

              previous_output:
                previousOutput

            }

          })

        console.log(
          'STEP RUN CREATED:',
          stepRun
        )


        try {

          // ===============================================
          // EXECUTE
          // ===============================================

          const output =
            await executeStep({

              step,

              previousOutput

            })

          console.log(
            `STEP ${index + 1} OUTPUT:`,
            output
          )


          // ===============================================
          // COMPLETE STEP
          // ===============================================

          await completeStepRun({

            stepRunId:
              stepRun.id,

            output,

            status:
              'completed'

          })

          previousOutput =
            output

          console.log(
            `STEP ${index + 1} COMPLETED`
          )

        } catch (stepError) {

          console.error(
            `STEP ${index + 1} FAILED:`,
            stepError
          )

          try {

            await completeStepRun({

              stepRunId:
                stepRun.id,

              output: {

                success:
                  false,

                error:
                  stepError?.message ||
                  'Step failed',

                executed_at:
                  new Date().toISOString()

              },

              status:
                'failed'

            })

          } catch (saveError) {

            console.error(
              'FAILED TO SAVE STEP ERROR:',
              saveError
            )

          }

          await updateWorkflowRun({

            runId:
              workflowRun.id,

            status:
              'failed'

          })

          throw stepError

        }

      }


      // =================================================
      // MARK WORKFLOW COMPLETED
      // =================================================

      const completedRun =
        await updateWorkflowRun({

          runId:
            workflowRun.id,

          status:
            'completed'

        })

      console.log(
        'WORKFLOW RUN COMPLETED:',
        completedRun
      )


      // =================================================
      // REFRESH DASHBOARD
      // =================================================

      await loadRunCount()
      await loadWorkflows()

      alert(
        `Workflow "${workflow.name}" completed successfully!\n\n` +
        `Steps executed: ${steps.length}\n` +
        `Run ID: ${workflowRun.id}`
      )

    } catch (error) {

      console.error(
        '================================'
      )

      console.error(
        'WORKFLOW EXECUTION ERROR:',
        error
      )

      console.error(
        'ERROR MESSAGE:',
        error?.message
      )

      console.error(
        '================================'
      )

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


      // =================================================
      // GET WORKFLOW RUNS
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

          query:
            getRunsQuery,

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

      const workflowRuns =
        runsResponse
          ?.body
          ?.data
          ?.workflow_runs || []

      console.log(
        'WORKFLOW RUNS TO DELETE:',
        workflowRuns
      )


      // =================================================
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

        const stepRunsError =
          getGraphQLError(
            stepRunsResponse
          )

        if (stepRunsError) {

          throw new Error(
            stepRunsError
          )

        }

      }


      // =================================================
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

            workflowId

          }

        })

      const deleteRunsError =
        getGraphQLError(
          deleteRunsResponse
        )

      if (deleteRunsError) {

        throw new Error(
          deleteRunsError
        )

      }


      // =================================================
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

            workflowId

          }

        })

      const triggersError =
        getGraphQLError(
          triggersResponse
        )

      if (triggersError) {

        throw new Error(
          triggersError
        )

      }


      // =================================================
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

            workflowId

          }

        })

      const stepsError =
        getGraphQLError(
          stepsResponse
        )

      if (stepsError) {

        throw new Error(
          stepsError
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

            workflowId

          }

        })

      const workflowError =
        getGraphQLError(
          workflowResponse
        )

      if (workflowError) {

        throw new Error(
          workflowError
        )

      }

      const deleted =
        workflowResponse
          ?.body
          ?.data
          ?.delete_workflows

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

      await loadWorkflows()
      await loadRunCount()

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
  // ACTIVE WORKFLOW COUNT
  // =====================================================

  const activeWorkflowCount =
    workflows.filter(
      workflow =>
        workflow.status === 'active'
    ).length


  // =====================================================
  // EDIT WORKFLOW
  // =====================================================

  const handleEditWorkflow = (
    workflow
  ) => {

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
  // RUN HISTORY
  // =====================================================

  const handleOpenRunHistory = (
    workflow
  ) => {

    if (!workflow?.id) {

      alert(
        'Workflow ID is missing.'
      )

      return
    }

    if (onRunHistory) {

      onRunHistory(
        workflow
      )

    } else {

      alert(
        'Run History functionality is not connected yet.'
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
      return 'Not available'
    }

    const parsedDate =
      new Date(date)

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {

      return 'Not available'

    }

    return parsedDate.toLocaleString()

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
                    getTrigger(workflow)

                  const steps =
                    workflow.workflow_steps || []

                  const isActive =
                    workflow.status === 'active'

                  const isRunning =
                    runningWorkflowId ===
                    workflow.id

                  const isDeleting =
                    deletingWorkflowId ===
                    workflow.id

                  return (

                    <div
                      key={workflow.id}
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

                        {trigger}

                      </p>

                      <p>

                        <strong>
                          Status:
                        </strong>{' '}

                        {workflow.status ||
                          'draft'}

                        {' '}

                        {isActive
                          ? '🟢'
                          : '⚪'}

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


                        {/* RUN HISTORY */}

                        <button
                          type="button"
                          onClick={() =>
                            handleOpenRunHistory(
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