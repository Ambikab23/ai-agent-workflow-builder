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

function getGraphQLError(response: any) {
  if (response?.body?.errors?.length) {
    return response.body.errors
      .map((error: any) => error.message)
      .join("\n")
  }

  return null
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
${
  previousOutput
    ? JSON.stringify(previousOutput)
    : "None"
}

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
    message:
      text || "LLM completed successfully.",
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

    workflowRunId =
      body.workflowRunId

    if (!workflowRunId) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "workflowRunId is required",
        }),
        {
          status: 400,
          headers,
        },
      )
    }

    console.log(
      "================================",
    )

    console.log(
      "EXECUTE WORKFLOW",
    )

    console.log(
      "Workflow Run ID:",
      workflowRunId,
    )

    console.log(
      "================================",
    )

    // =================================================
    // GET WORKFLOW
    // =================================================

    const runQuery = `
      query GetWorkflowRun(
        $id: uuid!
      ) {

        workflow_runs_by_pk(
          id: $id
        ) {

          id
          workflow_id
          status

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

    const runResponse =
      await nhost.graphql.request({
        query:
          runQuery,

        variables: {
          id:
            workflowRunId,
        },
      })

    const runError =
      getGraphQLError(
        runResponse,
      )

    if (runError) {
      throw new Error(
        runError,
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

    // =================================================
    // MARK WORKFLOW AS RUNNING
    // =================================================

    const workflowStartedAt =
      new Date().toISOString()

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

    const runningResponse =
      await nhost.graphql.request({
        query:
          updateRunningMutation,

        variables: {

          id:
            workflowRunId,

          startedAt:
            workflowStartedAt,

        },
      })

    const runningError =
      getGraphQLError(
        runningResponse,
      )

    if (runningError) {
      throw new Error(
        runningError,
      )
    }

    // =================================================
    // EXECUTE STEPS
    // =================================================

    let previousOutput: any = null

    for (
      let index = 0;
      index < steps.length;
      index++
    ) {

      const step =
        steps[index]

      console.log(
        "--------------------------------",
      )

      console.log(
        `Executing step ${
          index + 1
        }:`,
        step.name,
      )

      console.log(
        "Type:",
        step.type,
      )

      // =================================================
      // CREATE STEP RUN
      // =================================================

      /*
        IMPORTANT:

        Your step_runs table contains:

        workflow_run_id
        step_id
        status
        input
        output
        error
        attempt_count
        approved_by
        approved_at
        started_at
        completed_at
        created_at

        Therefore we MUST use:

        step_id

        NOT:

        workflow_step_id
      */

      const createStepRunMutation = `
        mutation CreateStepRun(
          $workflowRunId: uuid!
          $stepId: uuid!
          $status: String!
          $input: jsonb!
          $startedAt: timestamptz!
        ) {

          insert_step_runs_one(
            object: {

              workflow_run_id:
                $workflowRunId

              step_id:
                $stepId

              status:
                $status

              input:
                $input

              started_at:
                $startedAt

            }
          ) {

            id
            status
            step_id
            workflow_run_id
            started_at

          }

        }
      `

      const stepStartedAt =
        new Date().toISOString()

      const stepRunResponse =
        await nhost.graphql.request({

          query:
            createStepRunMutation,

          variables: {

            workflowRunId,

            stepId:
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
              stepStartedAt,

          },

        })

      const stepRunError =
        getGraphQLError(
          stepRunResponse,
        )

      if (stepRunError) {
        throw new Error(
          stepRunError,
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

        // =================================================
        // EXECUTE STEP
        // =================================================

        const config =
          getConfig(
            step.config,
          )

        let output: any

        // =================================================
        // LLM
        // =================================================

        if (
          step.type ===
          "llm_call"
        ) {

          const prompt =
            config?.prompt ||
            ""

          output =
            await executeLLM(
              prompt,
              previousOutput,
            )
        }

        // =================================================
        // HTTP
        // =================================================

        else if (
          step.type ===
          "http_request"
        ) {

          output = {

            success:
              true,

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

        // =================================================
        // DATABASE
        // =================================================

        else if (
          step.type ===
          "db_write"
        ) {

          output = {

            success:
              true,

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

        // =================================================
        // NOTIFICATION
        // =================================================

        else if (
          step.type ===
          "notify"
        ) {

          output = {

            success:
              true,

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

        // =================================================
        // CONDITIONAL
        // =================================================

        else if (
          step.type ===
          "conditional_branch"
        ) {

          output = {

            success:
              true,

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

        // =================================================
        // APPROVAL
        // =================================================

        else if (
          step.type ===
          "approval_gate"
        ) {

          output = {

            success:
              true,

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

        // =================================================
        // COMPLETE STEP RUN
        // =================================================

        const completedAt =
          new Date().toISOString()

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

                status:
                  $status

                output:
                  $output

                completed_at:
                  $completedAt

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

              completedAt,

            },

          })

        const updateStepError =
          getGraphQLError(
            updateStepResponse,
          )

        if (updateStepError) {
          throw new Error(
            updateStepError,
          )
        }

        previousOutput =
          output

      } catch (stepError) {

        console.error(
          "STEP FAILED:",
          stepError,
        )

        // =================================================
        // SAVE FAILED STEP
        // =================================================

        const failedOutput = {

          success:
            false,

          error:
            stepError instanceof Error
              ? stepError.message
              : "Step failed",

          executed_at:
            new Date().toISOString(),

        }

        const failStepMutation = `
          mutation FailStepRun(
            $id: uuid!
            $status: String!
            $output: jsonb!
            $error: String
            $completedAt: timestamptz!
          ) {

            update_step_runs_by_pk(
              pk_columns: {
                id: $id
              }

              _set: {

                status:
                  $status

                output:
                  $output

                error:
                  $error

                completed_at:
                  $completedAt

              }

            ) {

              id
              status
              error
              completed_at

            }

          }
        `

        const failResponse =
          await nhost.graphql.request({

            query:
              failStepMutation,

            variables: {

              id:
                stepRun.id,

              status:
                "failed",

              output:
                failedOutput,

              error:
                stepError instanceof Error
                  ? stepError.message
                  : "Step failed",

              completedAt:
                new Date().toISOString(),

            },

          })

        const failError =
          getGraphQLError(
            failResponse,
          )

        if (failError) {

          console.error(
            "Could not save failed step:",
            failError,
          )

        }

        throw stepError
      }
    }

    // =================================================
    // COMPLETE WORKFLOW
    // =================================================

    const workflowCompletedAt =
      new Date().toISOString()

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

            status:
              $status

            completed_at:
              $completedAt

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
            workflowCompletedAt,

        },

      })

    const completeError =
      getGraphQLError(
        completeResponse,
      )

    if (completeError) {
      throw new Error(
        completeError,
      )
    }

    console.log(
      "================================",
    )

    console.log(
      "WORKFLOW COMPLETED",
    )

    console.log(
      "================================",
    )

    return new Response(
      JSON.stringify({

        success:
          true,

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

        status:
          200,

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

    // =================================================
    // MARK WORKFLOW FAILED
    // =================================================

    if (workflowRunId) {

      try {

        const failedAt =
          new Date().toISOString()

        const failWorkflowMutation = `
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

                status:
                  $status

                completed_at:
                  $completedAt

              }

            ) {

              id
              status
              completed_at

            }

          }
        `

        const failWorkflowResponse =
          await nhost.graphql.request({

            query:
              failWorkflowMutation,

            variables: {

              id:
                workflowRunId,

              status:
                "failed",

              completedAt:
                failedAt,

            },

          })

        const failWorkflowError =
          getGraphQLError(
            failWorkflowResponse,
          )

        if (failWorkflowError) {

          console.error(
            "Could not mark workflow failed:",
            failWorkflowError,
          )

        }

      } catch (dbError) {

        console.error(
          "Could not mark workflow failed:",
          dbError,
        )

      }

    }

    return new Response(
      JSON.stringify({

        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Workflow execution failed",

      }),
      {

        status:
          500,

        headers,

      },
    )
  }
})
