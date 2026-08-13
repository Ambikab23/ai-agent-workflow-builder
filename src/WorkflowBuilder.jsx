import { useEffect, useState } from 'react'
import './WorkflowBuilder.css'
import { nhost } from './lib/nhost'

const ORGANIZATION_ID =
  'c55609d5-c8d3-491c-8de6-a787b5a2e109'

function WorkflowBuilder({
  user,
  workflow,
  onBack
}) {

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(false)

  const isEditMode = Boolean(workflow?.id)

  // =====================================================
  // GRAPHQL ERROR HANDLER
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
  // LOAD EXISTING WORKFLOW
  // =====================================================

  useEffect(() => {

    if (!workflow?.id) {

      setName('')
      setDescription('')
      setTriggerType('manual')
      setSteps([])

      return
    }

    setName(workflow.name || '')
    setDescription(workflow.description || '')

    const trigger =
      workflow.workflow_triggers?.[0]

    setTriggerType(
      trigger?.type || 'manual'
    )

    const existingSteps =
      workflow.workflow_steps || []

    /*
      IMPORTANT:

      step_order exists in the database and is NOT NULL.

      Therefore we use step_order to preserve the
      workflow step order.
    */

    const formattedSteps =
      [...existingSteps]
        .sort(
          (a, b) =>
            Number(a.step_order || 0) -
            Number(b.step_order || 0)
        )
        .map(step => {

          let config = step.config

          if (
            typeof config === 'string'
          ) {

            try {

              config =
                JSON.parse(config)

            } catch {

              config = {
                prompt: config
              }

            }

          }

          return {

            id:
              step.id,

            name:
              step.name || '',

            type:
              step.type || 'llm_call',

            config:
              config?.prompt || ''

          }

        })

    setSteps(formattedSteps)

  }, [workflow])

  // =====================================================
  // ADD STEP
  // =====================================================

  const addStep = () => {

    setSteps(previous => [

      ...previous,

      {

        id:
          `new-${Date.now()}`,

        name:
          `Step ${previous.length + 1}`,

        type:
          'llm_call',

        config:
          ''

      }

    ])

  }

  // =====================================================
  // UPDATE STEP
  // =====================================================

  const updateStep = (
    id,
    field,
    value
  ) => {

    setSteps(previous =>
      previous.map(step =>
        step.id === id
          ? {
              ...step,
              [field]: value
            }
          : step
      )
    )

  }

  // =====================================================
  // REMOVE STEP
  // =====================================================

  const removeStep = id => {

    setSteps(previous =>
      previous.filter(
        step =>
          step.id !== id
      )
    )

  }

  // =====================================================
  // CREATE WORKFLOW
  // =====================================================

  const createWorkflow = async () => {

    // ===================================================
    // CREATE WORKFLOW
    // ===================================================

    const workflowMutation = `
      mutation CreateWorkflow(
        $orgId: uuid!
        $name: String!
        $description: String
      ) {

        insert_workflows_one(
          object: {
            org_id: $orgId
            name: $name
            description: $description
          }
        ) {

          id
          org_id
          name
          description
          created_at
          updated_at

        }

      }
    `

    const workflowResponse =
      await nhost.graphql.request({

        query:
          workflowMutation,

        variables: {

          orgId:
            ORGANIZATION_ID,

          name:
            name.trim(),

          description:
            description.trim() || null

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

    const createdWorkflow =
      workflowResponse
        ?.body
        ?.data
        ?.insert_workflows_one

    if (!createdWorkflow) {

      throw new Error(
        'Workflow was not created.'
      )

    }

    // ===================================================
    // CREATE TRIGGER
    // ===================================================

    const triggerMutation = `
      mutation CreateTrigger(
        $workflowId: uuid!
        $type: String!
        $config: jsonb!
      ) {

        insert_workflow_triggers_one(
          object: {
            workflow_id: $workflowId
            type: $type
            config: $config
          }
        ) {

          id
          workflow_id
          type
          config

        }

      }
    `

    const triggerResponse =
      await nhost.graphql.request({

        query:
          triggerMutation,

        variables: {

          workflowId:
            createdWorkflow.id,

          type:
            triggerType,

          config:
            {}

        }

      })

    const triggerError =
      getGraphQLError(
        triggerResponse
      )

    if (triggerError) {

      throw new Error(
        `Trigger creation failed:\n${triggerError}`
      )

    }

    // ===================================================
    // CREATE STEPS
    // ===================================================

    for (
      let index = 0;
      index < steps.length;
      index++
    ) {

      const step =
        steps[index]

      /*
        IMPORTANT:

        step_order is NOT NULL in PostgreSQL.

        Therefore every inserted step MUST receive
        a step_order value.

        First step  -> 1
        Second step -> 2
        Third step  -> 3
        etc.
      */

      const stepMutation = `
        mutation CreateWorkflowStep(
          $workflowId: uuid!
          $name: String!
          $stepOrder: Int!
          $type: String!
          $config: jsonb!
        ) {

          insert_workflow_steps_one(
            object: {
              workflow_id: $workflowId
              name: $name
              step_order: $stepOrder
              type: $type
              config: $config
            }
          ) {

            id
            workflow_id
            name
            step_order
            type
            config
            created_at

          }

        }
      `

      const stepResponse =
        await nhost.graphql.request({

          query:
            stepMutation,

          variables: {

            workflowId:
              createdWorkflow.id,

            name:
              step.name.trim() ||
              `Step ${index + 1}`,

            stepOrder:
              index + 1,

            type:
              step.type,

            config: {

              prompt:
                step.config || ''

            }

          }

        })

      const stepError =
        getGraphQLError(
          stepResponse
        )

      if (stepError) {

        throw new Error(
          `Step ${index + 1} creation failed:\n${stepError}`
        )

      }

    }

    return createdWorkflow

  }

  // =====================================================
  // UPDATE WORKFLOW
  // =====================================================

  const updateWorkflow = async () => {

    const workflowId =
      String(workflow.id)

    // ===================================================
    // UPDATE WORKFLOW
    // ===================================================

    const updateMutation = `
      mutation UpdateWorkflow(
        $workflowId: uuid!
        $name: String!
        $description: String
      ) {

        update_workflows_by_pk(
          pk_columns: {
            id: $workflowId
          }

          _set: {
            name: $name
            description: $description
          }
        ) {

          id
          org_id
          name
          description
          created_at
          updated_at

        }

      }
    `

    const response =
      await nhost.graphql.request({

        query:
          updateMutation,

        variables: {

          workflowId,

          name:
            name.trim(),

          description:
            description.trim() || null

        }

      })

    const error =
      getGraphQLError(response)

    if (error) {

      throw new Error(error)

    }

    const updatedWorkflow =
      response
        ?.body
        ?.data
        ?.update_workflows_by_pk

    if (!updatedWorkflow) {

      throw new Error(
        'Workflow was not updated.'
      )

    }

    // ===================================================
    // TRIGGER
    // ===================================================

    const existingTrigger =
      workflow.workflow_triggers?.[0]

    if (existingTrigger?.id) {

      const updateTriggerMutation = `
        mutation UpdateTrigger(
          $id: uuid!
          $type: String!
          $config: jsonb!
        ) {

          update_workflow_triggers_by_pk(
            pk_columns: {
              id: $id
            }

            _set: {
              type: $type
              config: $config
            }
          ) {

            id
            workflow_id
            type
            config

          }

        }
      `

      const triggerResponse =
        await nhost.graphql.request({

          query:
            updateTriggerMutation,

          variables: {

            id:
              existingTrigger.id,

            type:
              triggerType,

            config:
              {}

          }

        })

      const triggerError =
        getGraphQLError(
          triggerResponse
        )

      if (triggerError) {

        throw new Error(
          `Trigger update failed:\n${triggerError}`
        )

      }

    } else {

      const createTriggerMutation = `
        mutation CreateTrigger(
          $workflowId: uuid!
          $type: String!
          $config: jsonb!
        ) {

          insert_workflow_triggers_one(
            object: {
              workflow_id: $workflowId
              type: $type
              config: $config
            }
          ) {

            id
            workflow_id
            type
            config

          }

        }
      `

      const triggerResponse =
        await nhost.graphql.request({

          query:
            createTriggerMutation,

          variables: {

            workflowId,

            type:
              triggerType,

            config:
              {}

          }

        })

      const triggerError =
        getGraphQLError(
          triggerResponse
        )

      if (triggerError) {

        throw new Error(
          `Trigger creation failed:\n${triggerError}`
        )

      }

    }

    // ===================================================
    // GET EXISTING STEPS
    // ===================================================

    const stepsQuery = `
      query GetWorkflowSteps(
        $workflowId: uuid!
      ) {

        workflow_steps(
          where: {
            workflow_id: {
              _eq: $workflowId
            }
          }

          order_by: {
            step_order: asc
          }
        ) {

          id
          workflow_id
          name
          step_order
          type
          config
          created_at

        }

      }
    `

    const stepsResponse =
      await nhost.graphql.request({

        query:
          stepsQuery,

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

    const existingSteps =
      stepsResponse
        ?.body
        ?.data
        ?.workflow_steps || []

    // ===================================================
    // DELETE REMOVED STEPS
    // ===================================================

    const currentStepIds =
      new Set(
        steps
          .filter(
            step =>
              !String(step.id)
                .startsWith('new-')
          )
          .map(
            step =>
              String(step.id)
          )
      )

    for (
      const existingStep
      of existingSteps
    ) {

      if (
        !currentStepIds.has(
          String(existingStep.id)
        )
      ) {

        const deleteMutation = `
          mutation DeleteStep(
            $id: uuid!
          ) {

            delete_workflow_steps_by_pk(
              id: $id
            ) {

              id

            }

          }
        `

        const deleteResponse =
          await nhost.graphql.request({

            query:
              deleteMutation,

            variables: {

              id:
                existingStep.id

            }

          })

        const deleteError =
          getGraphQLError(
            deleteResponse
          )

        if (deleteError) {

          throw new Error(
            `Step deletion failed:\n${deleteError}`
          )

        }

      }

    }

    // ===================================================
    // UPDATE / INSERT STEPS
    // ===================================================

    const existingStepIds =
      new Set(
        existingSteps.map(
          step =>
            String(step.id)
        )
      )

    for (
      let index = 0;
      index < steps.length;
      index++
    ) {

      const step =
        steps[index]

      const stepId =
        String(step.id)

      const stepOrder =
        index + 1

      // ===============================================
      // UPDATE EXISTING STEP
      // ===============================================

      if (
        existingStepIds.has(
          stepId
        )
      ) {

        const mutation = `
          mutation UpdateStep(
            $id: uuid!
            $name: String!
            $stepOrder: Int!
            $type: String!
            $config: jsonb!
          ) {

            update_workflow_steps_by_pk(
              pk_columns: {
                id: $id
              }

              _set: {
                name: $name
                step_order: $stepOrder
                type: $type
                config: $config
              }
            ) {

              id
              workflow_id
              name
              step_order
              type
              config
              created_at

            }

          }
        `

        const response =
          await nhost.graphql.request({

            query:
              mutation,

            variables: {

              id:
                step.id,

              name:
                step.name.trim() ||
                `Step ${stepOrder}`,

              stepOrder,

              type:
                step.type,

              config: {

                prompt:
                  step.config || ''

              }

            }

          })

        const error =
          getGraphQLError(
            response
          )

        if (error) {

          throw new Error(
            `Step ${stepOrder} update failed:\n${error}`
          )

        }

      }

      // ===============================================
      // INSERT NEW STEP
      // ===============================================

      else {

        const mutation = `
          mutation CreateStep(
            $workflowId: uuid!
            $name: String!
            $stepOrder: Int!
            $type: String!
            $config: jsonb!
          ) {

            insert_workflow_steps_one(
              object: {
                workflow_id: $workflowId
                name: $name
                step_order: $stepOrder
                type: $type
                config: $config
              }
            ) {

              id
              workflow_id
              name
              step_order
              type
              config
              created_at

            }

          }
        `

        const response =
          await nhost.graphql.request({

            query:
              mutation,

            variables: {

              workflowId,

              name:
                step.name.trim() ||
                `Step ${stepOrder}`,

              stepOrder,

              type:
                step.type,

              config: {

                prompt:
                  step.config || ''

              }

            }

          })

        const error =
          getGraphQLError(
            response
          )

        if (error) {

          throw new Error(
            `Step ${stepOrder} creation failed:\n${error}`
          )

        }

      }

    }

    return updatedWorkflow

  }

  // =====================================================
  // SAVE
  // =====================================================

  const handleSave = async () => {

    if (!name.trim()) {

      alert(
        'Please enter a workflow name.'
      )

      return
    }

    if (!user?.id) {

      alert(
        'Your login session is missing. Please login again.'
      )

      return
    }

    setLoading(true)

    try {

      let savedWorkflow

      if (isEditMode) {

        savedWorkflow =
          await updateWorkflow()

        alert(
          `Workflow "${savedWorkflow.name}" updated successfully!`
        )

      } else {

        savedWorkflow =
          await createWorkflow()

        alert(
          `Workflow "${savedWorkflow.name}" created successfully!`
        )

      }

      if (onBack) {
        onBack()
      }

    } catch (error) {

      console.error(
        'WORKFLOW SAVE ERROR:',
        error
      )

      alert(
        error?.message ||
        'Something went wrong while saving the workflow.'
      )

    } finally {

      setLoading(false)

    }

  }

  // =====================================================
  // UI
  // =====================================================

  return (

    <div className="workflow-builder">

      <header className="builder-header">

        <button
          type="button"
          className="back-button"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>

        <h1>
          ⚡ {isEditMode
            ? 'Edit Workflow'
            : 'Create Workflow'}
        </h1>

      </header>

      <main className="builder-content">

        <div className="builder-card">

          <h2>
            Workflow Details
          </h2>

          <label>
            Workflow Name
          </label>

          <input
            type="text"
            placeholder="Enter workflow name"
            value={name}
            onChange={e =>
              setName(e.target.value)
            }
            disabled={loading}
          />

          <label>
            Description
          </label>

          <textarea
            placeholder="Describe what this workflow does"
            value={description}
            onChange={e =>
              setDescription(
                e.target.value
              )
            }
            disabled={loading}
          />

          <label>
            Trigger
          </label>

          <select
            value={triggerType}
            onChange={e =>
              setTriggerType(
                e.target.value
              )
            }
            disabled={loading}
          >

            <option value="manual">
              Manual
            </option>

            <option value="webhook">
              Webhook
            </option>

            <option value="scheduled">
              Scheduled
            </option>

            <option value="database_event">
              Database Event
            </option>

          </select>

          <div
            style={{
              marginTop: '30px'
            }}
          >

            <h2>
              Workflow Steps
            </h2>

            {steps.length === 0 && (

              <p>
                No steps added yet.
              </p>

            )}

            {steps.map(
              (step, index) => (

                <div
                  key={step.id}
                  style={{
                    border:
                      '1px solid #ddd',
                    borderRadius:
                      '10px',
                    padding:
                      '20px',
                    marginTop:
                      '15px'
                  }}
                >

                  <h3>
                    Step {index + 1}
                  </h3>

                  <label>
                    Step Name
                  </label>

                  <input
                    type="text"
                    value={step.name}
                    onChange={e =>
                      updateStep(
                        step.id,
                        'name',
                        e.target.value
                      )
                    }
                    disabled={loading}
                  />

                  <label>
                    Step Type
                  </label>

                  <select
                    value={step.type}
                    onChange={e =>
                      updateStep(
                        step.id,
                        'type',
                        e.target.value
                      )
                    }
                    disabled={loading}
                  >

                    <option value="llm_call">
                      LLM Call
                    </option>

                    <option value="http_request">
                      HTTP Request
                    </option>

                    <option value="db_write">
                      Database Write
                    </option>

                    <option value="notify">
                      Notification
                    </option>

                    <option value="conditional_branch">
                      Conditional Branch
                    </option>

                    <option value="approval_gate">
                      Approval Gate
                    </option>

                  </select>

                  <label>
                    Configuration
                  </label>

                  <textarea
                    placeholder="Enter step configuration or prompt"
                    value={step.config}
                    onChange={e =>
                      updateStep(
                        step.id,
                        'config',
                        e.target.value
                      )
                    }
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeStep(
                        step.id
                      )
                    }
                    disabled={loading}
                  >
                    Remove Step
                  </button>

                </div>

              )
            )}

            <button
              type="button"
              onClick={addStep}
              disabled={loading}
              style={{
                marginTop:
                  '15px'
              }}
            >
              + Add Step
            </button>

          </div>

          <div className="builder-actions">

            <button
              type="button"
              className="cancel-button"
              onClick={onBack}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="save-button"
              onClick={handleSave}
              disabled={loading}
            >
              {loading
                ? 'Saving...'
                : isEditMode
                  ? 'Update Workflow'
                  : 'Save Workflow'}
            </button>

          </div>

        </div>

      </main>

    </div>

  )

}

export default WorkflowBuilder