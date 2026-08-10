import { useState } from 'react'
import './WorkflowBuilder.css'
import { nhost } from './lib/nhost'

function WorkflowBuilder({ user, onBack }) {

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('manual')

  const [steps, setSteps] = useState([])

  const [loading, setLoading] = useState(false)

  const ORGANIZATION_ID =
    'c55609d5-c8d3-491c-8de6-a787b5a2e109'


  // =====================================================
  // ADD STEP
  // =====================================================

  const addStep = () => {

    const newStep = {
      id: Date.now(),
      name: `Step ${steps.length + 1}`,
      type: 'llm_call',
      config: ''
    }

    setSteps([
      ...steps,
      newStep
    ])
  }


  // =====================================================
  // UPDATE STEP
  // =====================================================

  const updateStep = (id, field, value) => {

    setSteps(
      steps.map(step => {

        if (step.id === id) {

          return {
            ...step,
            [field]: value
          }

        }

        return step

      })
    )
  }


  // =====================================================
  // REMOVE STEP
  // =====================================================

  const removeStep = (id) => {

    setSteps(
      steps.filter(
        step => step.id !== id
      )
    )

  }


  // =====================================================
  // SAVE WORKFLOW
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

      console.log(
        '================================'
      )

      console.log(
        'STARTING WORKFLOW CREATION'
      )

      console.log(
        'USER ID:',
        user.id
      )

      console.log(
        'ORGANIZATION ID:',
        ORGANIZATION_ID
      )

      console.log(
        'STEPS:',
        steps
      )

      console.log(
        '================================'
      )


      // =================================================
      // 1. CREATE WORKFLOW
      // =================================================

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
            created_by
            created_at
            updated_at
          }
        }
      `


      const workflowResponse =
        await nhost.graphql.request({

          query: workflowMutation,

          variables: {

            orgId: ORGANIZATION_ID,

            name: name.trim(),

            description:
              description.trim() || null

          }

        })


      console.log(
        'WORKFLOW RESPONSE:',
        workflowResponse
      )


      // =================================================
      // CHECK WORKFLOW ERRORS
      // =================================================

      if (
        workflowResponse?.body?.errors?.length
      ) {

        console.error(
          'WORKFLOW ERRORS:',
          workflowResponse.body.errors
        )

        alert(
          workflowResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

        return
      }


      const workflow =
        workflowResponse
          ?.body
          ?.data
          ?.insert_workflows_one


      if (!workflow) {

        console.error(
          'WORKFLOW WAS NOT RETURNED:',
          workflowResponse
        )

        alert(
          'Workflow was not created. Check the browser console.'
        )

        return
      }


      console.log(
        'WORKFLOW CREATED:',
        workflow
      )


      // =================================================
      // 2. CREATE TRIGGER
      // =================================================

      const triggerMutation = `
        mutation CreateTrigger(
          $workflowId: uuid!
          $triggerType: String!
        ) {
          insert_workflow_triggers_one(
            object: {
              workflow_id: $workflowId
              type: $triggerType
              enabled: true
            }
          ) {
            id
            workflow_id
            type
            enabled
            created_at
          }
        }
      `


      const triggerResponse =
        await nhost.graphql.request({

          query: triggerMutation,

          variables: {

            workflowId:
              workflow.id,

            triggerType:
              triggerType

          }

        })


      console.log(
        'TRIGGER RESPONSE:',
        triggerResponse
      )


      // =================================================
      // CHECK TRIGGER ERRORS
      // =================================================

      if (
        triggerResponse?.body?.errors?.length
      ) {

        console.error(
          'TRIGGER ERRORS:',
          triggerResponse.body.errors
        )

        alert(
          'Workflow was created, but trigger creation failed:\n\n' +
          triggerResponse.body.errors
            .map(error => error.message)
            .join('\n')
        )

        return
      }


      // =================================================
      // 3. CREATE WORKFLOW STEPS
      // =================================================

      for (
        let index = 0;
        index < steps.length;
        index++
      ) {

        const step =
          steps[index]


        console.log(
          `CREATING STEP ${index + 1}:`,
          step
        )


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

            query: stepMutation,

            variables: {

              workflowId:
                workflow.id,

              name:
                step.name.trim(),

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


        console.log(
          `STEP ${index + 1} RESPONSE:`,
          stepResponse
        )


        // =================================================
        // CHECK STEP ERRORS
        // =================================================

        if (
          stepResponse?.body?.errors?.length
        ) {

          console.error(
            `STEP ${index + 1} ERRORS:`,
            stepResponse.body.errors
          )

          alert(
            `Workflow was created, but Step ${index + 1} failed:\n\n` +
            stepResponse.body.errors
              .map(error => error.message)
              .join('\n')
          )

          return
        }


        const createdStep =
          stepResponse
            ?.body
            ?.data
            ?.insert_workflow_steps_one


        if (!createdStep) {

          console.error(
            `STEP ${index + 1} WAS NOT RETURNED:`,
            stepResponse
          )

          alert(
            `Workflow was created, but Step ${index + 1} was not created.`
          )

          return
        }


        console.log(
          `STEP ${index + 1} CREATED:`,
          createdStep
        )

      }


      // =================================================
      // SUCCESS
      // =================================================

      console.log(
        '================================'
      )

      console.log(
        'WORKFLOW SAVED SUCCESSFULLY'
      )

      console.log(
        'WORKFLOW:',
        workflow
      )

      console.log(
        'TOTAL STEPS:',
        steps.length
      )

      console.log(
        '================================'
      )


      alert(
        `Workflow saved successfully!\n\nSteps created: ${steps.length}`
      )


      // Clear form

      setName('')

      setDescription('')

      setTriggerType('manual')

      setSteps([])


      // Go back to dashboard

      if (onBack) {

        onBack()

      }


    } catch (error) {

      console.error(
        '================================'
      )

      console.error(
        'WORKFLOW SAVE ERROR:',
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


      {/* =================================================
          HEADER
      ================================================= */}

      <header className="builder-header">

        <button
          className="back-button"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>


        <h1>
          ⚡ Create Workflow
        </h1>

      </header>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="builder-content">

        <div className="builder-card">


          {/* =================================================
              WORKFLOW DETAILS
          ================================================= */}

          <h2>
            Workflow Details
          </h2>


          {/* WORKFLOW NAME */}

          <label>
            Workflow Name
          </label>


          <input
            type="text"
            placeholder="Enter workflow name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            disabled={loading}
          />


          {/* DESCRIPTION */}

          <label>
            Description
          </label>


          <textarea
            placeholder="Describe what this workflow does"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            disabled={loading}
          />


          {/* TRIGGER */}

          <label>
            Trigger
          </label>


          <select
            value={triggerType}
            onChange={(e) =>
              setTriggerType(e.target.value)
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


          {/* =================================================
              WORKFLOW STEPS
          ================================================= */}

          <div
            style={{
              marginTop: '30px'
            }}
          >

            <h2>
              Workflow Steps
            </h2>


            {/* NO STEPS */}

            {steps.length === 0 && (

              <p>
                No steps added yet.
              </p>

            )}


            {/* STEPS */}

            {steps.map(
              (step, index) => (

                <div
                  key={step.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '10px',
                    padding: '20px',
                    marginTop: '15px'
                  }}
                >


                  {/* STEP NUMBER */}

                  <h3>
                    Step {index + 1}
                  </h3>


                  {/* STEP NAME */}

                  <label>
                    Step Name
                  </label>


                  <input
                    type="text"
                    value={step.name}
                    onChange={(e) =>
                      updateStep(
                        step.id,
                        'name',
                        e.target.value
                      )
                    }
                    disabled={loading}
                  />


                  {/* STEP TYPE */}

                  <label>
                    Step Type
                  </label>


                  <select
                    value={step.type}
                    onChange={(e) =>
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


                  {/* CONFIGURATION */}

                  <label>
                    Configuration
                  </label>


                  <textarea
                    placeholder="Enter step configuration or prompt"
                    value={step.config}
                    onChange={(e) =>
                      updateStep(
                        step.id,
                        'config',
                        e.target.value
                      )
                    }
                    disabled={loading}
                  />


                  {/* REMOVE */}

                  <button
                    type="button"
                    onClick={() =>
                      removeStep(step.id)
                    }
                    disabled={loading}
                    style={{
                      marginTop: '10px'
                    }}
                  >
                    Remove Step
                  </button>


                </div>

              )
            )}


            {/* =================================================
                ADD STEP
            ================================================= */}

            <button
              type="button"
              onClick={addStep}
              disabled={loading}
              style={{
                marginTop: '15px'
              }}
            >
              + Add Step
            </button>


          </div>


          {/* =================================================
              ACTION BUTTONS
          ================================================= */}

          <div className="builder-actions">

            <button
              className="cancel-button"
              onClick={onBack}
              disabled={loading}
            >
              Cancel
            </button>


            <button
              className="save-button"
              onClick={handleSave}
              disabled={loading}
            >

              {loading
                ? 'Saving...'
                : 'Save Workflow'}

            </button>

          </div>


        </div>

      </main>

    </div>

  )

}

export default WorkflowBuilder