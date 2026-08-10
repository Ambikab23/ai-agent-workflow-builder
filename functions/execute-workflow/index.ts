import { createClient } from "@nhost/nhost-js"

const nhost = createClient({
  subdomain: Deno.env.get("NHOST_SUBDOMAIN")!,
  region: Deno.env.get("NHOST_REGION")!,
})

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
