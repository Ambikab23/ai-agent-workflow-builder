import { createClient } from "@nhost/nhost-js"

const nhost = createClient({
  subdomain: Deno.env.get("NHOST_SUBDOMAIN")!,
  region: Deno.env.get("NHOST_REGION")!,
})

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization",
}

function getConfig(config: any) {
  if (!config) return {}

  if (typeof config === "string") {
    try {
      return JSON.parse(config)
    } catch {
      return {
        prompt: config,
      }
    }
  }

  return config
}

async function executeLLM(
  prompt: string,
  previousOutput: any,
) {
  const apiKey = Deno.env.get("OPENAI_API_KEY")

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured in the Nhost function environment.",
    )
  }

  const finalPrompt = `
You are an AI workflow step.

Execute the following workflow instruction.

Workflow instruction:
${prompt || "Complete the requested workflow task."}

Previous step output:
${previousOutput
  ? JSON.stringify(previousOutput)
  : "None"}

Return a useful response for the next workflow step.
`

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: "gpt-5-mini",
        input: finalPrompt,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "OpenAI API request failed.",
    )
  }

  let text = ""

  if (typeof data?.output_text === "string") {
    text = data.output_text
  } else if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (
            content?.type === "output_text" &&
            typeof content?.text === "string"
          ) {
            text += content.text
          }
        }
      }
    }
  }

  return {
    success: true,
    type: "llm_call",
    prompt,
    message: text || "LLM completed successfully.",
    previous_output:
      previousOutput || null,
    executed_at:
      new Date().toISOString(),
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    })
  }

  let workflowRunId = ""

  try {
    const body = await req.json()

    workflowRunId = body.workflowRunId

    if (!workflowRunId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "workflowRunId is required",
        }),
        {
          status: 400,
          headers,
        },
      )
    }

    console.log("================================")
    console.log("EXECUTE WORKFLOW")
    console.log("Workflow Run ID:", workflowRunId)
    console.log("================================")

    // -------------------------------------------------
    // GET WORKFLOW
    // -------------------------------------------------

    const runQuery = `
      query GetWorkflowRun($id: uuid!) {
        workflow_runs_by_pk(id: $id) {
          id
          workflow_id
          status

          workflow {
            id
            name
            description

            workflow_steps(
              order_by: {
                position: asc
              }
            ) {
              id
              name
              position
              type
              config
            }
          }
        }
      }
    `

    const runResponse =
      await nhost.graphql.request({
        query: runQuery,

        variables: {
          id: workflowRunId,
        },
      })

    if (runResponse?.body?.errors?.length) {
      throw new Error(
        runResponse.body.errors
          .map((e: any) => e.message)
          .join("\n"),
      )
    }

    const workflowRun =
      runResponse
        ?.body
        ?.data
        ?.workflow_runs_by_pk

    if (!workflowRun) {
      throw new Error(
        "Workflow run not found.",
      )
    }

    const workflow =
      workflowRun.workflow

    if (!workflow) {
      throw new Error(
        "Workflow not found.",
      )
    }

    const steps =
      workflow.workflow_steps || []

    console.log(
      "Workflow:",
      workflow.name,
    )

    console.log(
      "Steps:",
      steps.length,
    )

    // -------------------------------------------------
    // MARK RUNNING
    // -------------------------------------------------

    const updateRunningMutation = `
      mutation UpdateWorkflowRun(
        $id: uuid!
        $startedAt: timestamptz!
      ) {
        update_workflow_runs_by_pk(
          pk_columns: {
            id: $id
          }

          _set: {
            status: "running"
            started_at: $startedAt
          }
        ) {
          id
          status
          started_at
        }
      }
    `

    await nhost.graphql.request({
      query: updateRunningMutation,

      variables: {
        id: workflowRunId,

        startedAt:
          new Date().toISOString(),
      },
    })

    // -------------------------------------------------
    // EXECUTE STEPS
    // -------------------------------------------------

    let previousOutput: any = null

    for (
      let index = 0;
      index < steps.length;
      index++
    ) {
      const step = steps[index]

      console.log("--------------------------------")
      console.log(
        `Executing step ${index + 1}:`,
        step.name,
      )

      console.log(
        "Type:",
        step.type,
      )

      // -------------------------------------------------
      // CREATE STEP RUN
      // -------------------------------------------------

      const createStepRunMutation = `
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
            status
          }
        }
      `

      const stepRunResponse =
        await nhost.graphql.request({
          query:
            createStepRunMutation,

          variables: {
            workflowRunId,

            workflowStepId:
              step.id,

            status:
              "running",

            input: {
              type:
                step.type,

              step_name:
                step.name,

              step_number:
                index + 1,

              previous_output:
                previousOutput,
            },

            startedAt:
              new Date().toISOString(),
          },
        })

      if (
        stepRunResponse
          ?.body
          ?.errors
          ?.length
      ) {
        throw new Error(
          stepRunResponse.body.errors
            .map(
              (e: any) =>
                e.message,
            )
            .join("\n"),
        )
      }

      const stepRun =
        stepRunResponse
          ?.body
          ?.data
          ?.insert_step_runs_one

      if (!stepRun) {
        throw new Error(
          `Could not create step run for ${step.name}`,
        )
      }

      try {
        // -------------------------------------------------
        // EXECUTE STEP
        // -------------------------------------------------

        const config =
          getConfig(step.config)

        let output: any

        // -------------------------------------------------
        // REAL LLM
        // -------------------------------------------------

        if (
          step.type ===
          "llm_call"
        ) {
          const prompt =
            config?.prompt || ""

          output =
            await executeLLM(
              prompt,
              previousOutput,
            )
        }

        // -------------------------------------------------
        // HTTP
        // -------------------------------------------------

        else if (
          step.type ===
          "http_request"
        ) {
          output = {
            success: true,

            type:
              "http_request",

            message:
              "HTTP request step recognized. Real HTTP execution can be added later.",

            config,

            previous_output:
              previousOutput ||
              null,

            executed_at:
              new Date().toISOString(),
          }
        }

        // -------------------------------------------------
        // DATABASE
        // -------------------------------------------------

        else if (
          step.type ===
          "db_write"
        ) {
          output = {
            success: true,

            type:
              "db_write",

            message:
              "Database write step recognized.",

            config,

            previous_output:
              previousOutput ||
              null,

            executed_at:
              new Date().toISOString(),
          }
        }

        // -------------------------------------------------
        // NOTIFICATION
        // -------------------------------------------------

        else if (
          step.type ===
          "notify"
        ) {
          output = {
            success: true,

            type:
              "notify",

            message:
              "Notification step recognized.",

            config,

            previous_output:
              previousOutput ||
              null,

            executed_at:
              new Date().toISOString(),
          }
        }

        // -------------------------------------------------
        // CONDITIONAL
        // -------------------------------------------------

        else if (
          step.type ===
          "conditional_branch"
        ) {
          output = {
            success: true,

            type:
              "conditional_branch",

            message:
              "Conditional branch step recognized.",

            config,

            previous_output:
              previousOutput ||
              null,

            executed_at:
              new Date().toISOString(),
          }
        }

        // -------------------------------------------------
        // APPROVAL
        // -------------------------------------------------

        else if (
          step.type ===
          "approval_gate"
        ) {
          output = {
            success: true,

            type:
              "approval_gate",

            message:
              "Approval gate reached.",

            status:
              "waiting_for_approval",

            config,

            executed_at:
              new Date().toISOString(),
          }
        }

        else {
          throw new Error(
            `Unsupported step type: ${step.type}`,
          )
        }

        console.log(
          "Step output:",
          output,
        )

        // -------------------------------------------------
        // COMPLETE STEP
        // -------------------------------------------------

        const updateStepMutation = `
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
              output
              completed_at
            }
          }
        `

        const updateStepResponse =
          await nhost.graphql.request({
            query:
              updateStepMutation,

            variables: {
              id:
                stepRun.id,

              status:
                "completed",

              output,

              completedAt:
                new Date().toISOString(),
            },
          })

        if (
          updateStepResponse
            ?.body
            ?.errors
            ?.length
        ) {
          throw new Error(
            updateStepResponse.body.errors
              .map(
                (e: any) =>
                  e.message,
              )
              .join("\n"),
          )
        }

        previousOutput =
          output
      } catch (stepError) {
        console.error(
          "STEP FAILED:",
          stepError,
        )

        // -------------------------------------------------
        // SAVE FAILED STEP
        // -------------------------------------------------

        await nhost.graphql.request({
          query: `
            mutation FailStepRun(
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
          `,

          variables: {
            id:
              stepRun.id,

            status:
              "failed",

            output: {
              success: false,

              error:
                stepError instanceof
                Error
                  ? stepError.message
                  : "Step failed",

              executed_at:
                new Date().toISOString(),
            },

            completedAt:
              new Date().toISOString(),
          },
        })

        throw stepError
      }
    }

    // -------------------------------------------------
    // COMPLETE WORKFLOW
    // -------------------------------------------------

    const completeMutation = `
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

    const completeResponse =
      await nhost.graphql.request({
        query:
          completeMutation,

        variables: {
          id:
            workflowRunId,

          status:
            "completed",

          completedAt:
            new Date().toISOString(),
        },
      })

    if (
      completeResponse
        ?.body
        ?.errors
        ?.length
    ) {
      throw new Error(
        completeResponse.body.errors
          .map(
            (e: any) =>
              e.message,
          )
          .join("\n"),
      )
    }

    console.log("================================")
    console.log("WORKFLOW COMPLETED")
    console.log("================================")

    return new Response(
      JSON.stringify({
        success: true,

        workflowRunId,

        workflow:
          workflow.name,

        stepsExecuted:
          steps.length,

        status:
          "completed",

        finalOutput:
          previousOutput,
      }),
      {
        status: 200,
        headers,
      },
    )
  } catch (error) {
    console.error(
      "================================",
    )

    console.error(
      "EXECUTE WORKFLOW ERROR:",
      error,
    )

    console.error(
      "================================",
    )

    // -------------------------------------------------
    // MARK WORKFLOW FAILED
    // -------------------------------------------------

    if (workflowRunId) {
      try {
        await nhost.graphql.request({
          query: `
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
          `,

          variables: {
            id:
              workflowRunId,

            status:
              "failed",

            completedAt:
              new Date().toISOString(),
          },
        })
      } catch (dbError) {
        console.error(
          "Could not mark workflow failed:",
          dbError,
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Workflow execution failed",
      }),
      {
        status: 500,
        headers,
      },
    )
  }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    })
  }

  try {
    const body = await req.json()

    const workflowRunId = body.workflowRunId

    if (!workflowRunId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "workflowRunId is required",
        }),
        {
          status: 400,
          headers,
        },
      )
    }

    console.log("================================")
    console.log("EXECUTE WORKFLOW")
    console.log("Workflow Run ID:", workflowRunId)
    console.log("================================")

    // -------------------------------------------------
    // 1. GET WORKFLOW RUN
    // -------------------------------------------------

    const runQuery = `
      query GetWorkflowRun($id: uuid!) {
        workflow_runs_by_pk(id: $id) {
          id
          workflow_id
          status
          created_by

          workflow {
            id
            name
            description

            workflow_steps(
              order_by: {
                step_order: asc
              }
            ) {
              id
              name
              step_order
              type
              config
            }
          }
        }
      }
    `

    const runResponse = await nhost.graphql.request({
      query: runQuery,
      variables: {
        id: workflowRunId,
      },
    })

    if (runResponse?.body?.errors?.length) {
      throw new Error(
        runResponse.body.errors
          .map((e: any) => e.message)
          .join("\n"),
      )
    }

    const workflowRun =
      runResponse?.body?.data?.workflow_runs_by_pk

    if (!workflowRun) {
      throw new Error("Workflow run not found")
    }

    const workflow = workflowRun.workflow

    if (!workflow) {
      throw new Error("Workflow not found")
    }

    const steps = workflow.workflow_steps || []

    console.log("Workflow:", workflow.name)
    console.log("Steps:", steps.length)

    // -------------------------------------------------
    // 2. MARK WORKFLOW RUN AS RUNNING
    // -------------------------------------------------

    const updateRunningMutation = `
      mutation UpdateWorkflowRun(
        $id: uuid!
      ) {
        update_workflow_runs_by_pk(
          pk_columns: {
            id: $id
          }

          _set: {
            status: "running"
            started_at: "now()"
          }
        ) {
          id
          status
          started_at
        }
      }
    `

    await nhost.graphql.request({
      query: updateRunningMutation,
      variables: {
        id: workflowRunId,
      },
    })

    // -------------------------------------------------
    // 3. EXECUTE EACH STEP
    // -------------------------------------------------

    for (const step of steps) {
      console.log("--------------------------------")
      console.log("Executing step:", step.name)
      console.log("Type:", step.type)
      console.log("Step ID:", step.id)

      // Create step run
      const createStepRunMutation = `
        mutation CreateStepRun(
          $workflowRunId: uuid!
          $stepId: uuid!
          $input: jsonb!
        ) {
          insert_step_runs_one(
            object: {
              workflow_run_id: $workflowRunId
              step_id: $stepId
              status: "running"
              input: $input
              attempt_count: 1
              started_at: "now()"
            }
          ) {
            id
            status
          }
        }
      `

      const stepRunResponse =
        await nhost.graphql.request({
          query: createStepRunMutation,
          variables: {
            workflowRunId,
            stepId: step.id,
            input: step.config || {},
          },
        })

      if (stepRunResponse?.body?.errors?.length) {
        throw new Error(
          stepRunResponse.body.errors
            .map((e: any) => e.message)
            .join("\n"),
        )
      }

      const stepRun =
        stepRunResponse
          ?.body
          ?.data
          ?.insert_step_runs_one

      if (!stepRun) {
        throw new Error(
          `Could not create step run for ${step.name}`,
        )
      }

      // -------------------------------------------------
      // STEP EXECUTION
      // -------------------------------------------------

      let output: any = {}

      if (step.type === "llm_call") {
        output = {
          message:
            "LLM step received successfully.",
          prompt:
            step.config?.prompt || "",
        }
      }

      else if (step.type === "http_request") {
        output = {
          message:
            "HTTP request step received.",
          config:
            step.config || {},
        }
      }

      else if (step.type === "db_write") {
        output = {
          message:
            "Database write step received.",
          config:
            step.config || {},
        }
      }

      else if (step.type === "notify") {
        output = {
          message:
            "Notification step received.",
          config:
            step.config || {},
        }
      }

      else if (
        step.type === "conditional_branch"
      ) {
        output = {
          message:
            "Conditional branch evaluated.",
          config:
            step.config || {},
        }
      }

      else if (
        step.type === "approval_gate"
      ) {
        output = {
          message:
            "Approval gate reached.",
          status:
            "waiting_for_approval",
        }
      }

      else {
        output = {
          message:
            `Unknown step type: ${step.type}`,
        }
      }

      console.log(
        "Step output:",
        output,
      )

      // -------------------------------------------------
      // MARK STEP AS COMPLETED
      // -------------------------------------------------

      const updateStepMutation = `
        mutation UpdateStepRun(
          $id: uuid!
          $output: jsonb!
        ) {
          update_step_runs_by_pk(
            pk_columns: {
              id: $id
            }

            _set: {
              status: "completed"
              output: $output
              completed_at: "now()"
            }
          ) {
            id
            status
            output
            completed_at
          }
        }
      `

      await nhost.graphql.request({
        query: updateStepMutation,
        variables: {
          id: stepRun.id,
          output,
        },
      })
    }

    // -------------------------------------------------
    // 4. MARK WORKFLOW AS COMPLETED
    // -------------------------------------------------

    const completeMutation = `
      mutation CompleteWorkflowRun(
        $id: uuid!
      ) {
        update_workflow_runs_by_pk(
          pk_columns: {
            id: $id
          }

          _set: {
            status: "completed"
            completed_at: "now()"
          }
        ) {
          id
          status
          completed_at
        }
      }
    `

    const completeResponse =
      await nhost.graphql.request({
        query: completeMutation,
        variables: {
          id: workflowRunId,
        },
      })

    if (completeResponse?.body?.errors?.length) {
      throw new Error(
        completeResponse.body.errors
          .map((e: any) => e.message)
          .join("\n"),
      )
    }

    console.log("================================")
    console.log("WORKFLOW COMPLETED")
    console.log("================================")

    return new Response(
      JSON.stringify({
        success: true,
        workflowRunId,
        workflow: workflow.name,
        stepsExecuted: steps.length,
        status: "completed",
      }),
      {
        status: 200,
        headers,
      },
    )

  } catch (error) {

    console.error(
      "EXECUTE WORKFLOW ERROR:",
      error,
    )

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Workflow execution failed",
      }),
      {
        status: 500,
        headers,
      },
    )
  }
})
