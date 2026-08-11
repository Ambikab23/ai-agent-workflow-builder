import { useEffect, useState } from 'react'
import './Dashboard.css'
import { nhost } from './lib/nhost'

function RunHistory({ workflow, onBack }) {

  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


  // =====================================================
  // LOAD RUN HISTORY
  // =====================================================

  const loadRuns = async () => {

    if (!workflow?.id) {
      setError('Workflow ID is missing.')
      setLoading(false)
      return
    }

    try {

      setLoading(true)
      setError('')

      const workflowId = String(workflow.id)

      console.log('================================')
      console.log('LOADING RUN HISTORY')
      console.log('Workflow:', workflow.name)
      console.log('Workflow ID:', workflowId)
      console.log('================================')


      const query = `
        query GetWorkflowRunHistory(
          $workflowId: uuid!
        ) {

          workflow_runs(
            where: {
              workflow_id: {
                _eq: $workflowId
              }
            }

            order_by: {
              created_at: desc
            }
          ) {

            id
            workflow_id
            status
            started_at
            completed_at
            created_at

            step_runs(
              order_by: {
                created_at: asc
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

              workflow_step {

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


      const response =
        await nhost.graphql.request({

          query,

          variables: {
            workflowId
          }

        })


      console.log(
        'RUN HISTORY RESPONSE:',
        response
      )


      // =====================================================
      // GRAPHQL ERROR
      // =====================================================

      if (
        response?.body?.errors?.length
      ) {

        console.error(
          'RUN HISTORY ERRORS:',
          response.body.errors
        )

        throw new Error(
          response.body.errors
            .map(error => error.message)
            .join('\n')
        )

      }


      // =====================================================
      // GET RUNS
      // =====================================================

      const data =
        response
          ?.body
          ?.data
          ?.workflow_runs || []


      console.log(
        'RUNS FOUND:',
        data.length
      )


      // =====================================================
      // SAFETY CHECK
      // =====================================================

      const filteredRuns =
        data.filter(
          run =>
            String(run.workflow_id) === workflowId
        )


      console.log(
        'VALID RUNS FOR THIS WORKFLOW:',
        filteredRuns.length
      )


      setRuns(
        filteredRuns
      )

    } catch (error) {

      console.error(
        'LOAD RUN HISTORY ERROR:',
        error
      )

      setError(
        error?.message ||
        'Failed to load workflow run history.'
      )

    } finally {

      setLoading(false)

    }

  }


  // =====================================================
  // LOAD WHEN WORKFLOW CHANGES
  // =====================================================

  useEffect(() => {

    loadRuns()

  }, [workflow?.id])


  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (date) => {

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
  // STATUS ICON
  // =====================================================

  const getStatusIcon = (status) => {

    switch (status) {

      case 'completed':
        return '✅'

      case 'running':
        return '🔄'

      case 'failed':
        return '❌'

      case 'pending':
        return '⏳'

      default:
        return '⚪'

    }

  }


  // =====================================================
  // STEP STATUS
  // =====================================================

  const getStepStatusIcon = (status) => {

    switch (status) {

      case 'completed':
        return '✅'

      case 'running':
        return '🔄'

      case 'failed':
        return '❌'

      case 'pending':
        return '⏳'

      default:
        return '⚪'

    }

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
            Workflow Run History
          </p>

        </div>


        <button
          type="button"
          onClick={onBack}
        >
          ← Back
        </button>

      </header>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="dashboard-content">

        {/* =================================================
            WORKFLOW INFORMATION
        ================================================= */}

        <div>

          <h2>
            Run History
          </h2>

          <p>

            Workflow:{' '}

            <strong>
              {workflow?.name ||
                'Unknown Workflow'}
            </strong>

          </p>

          <p>

            {workflow?.description ||
              'No description'}

          </p>

          <p
            style={{
              fontSize: '13px',
              color: '#666'
            }}
          >

            Workflow ID:{' '}

            {workflow?.id ||
              'Not available'}

          </p>

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

            Loading run history...

          </div>

        )}


        {/* =================================================
            NO RUNS
        ================================================= */}

        {!loading &&
          !error &&
          runs.length === 0 && (

            <div
              style={{
                marginTop: '30px',
                padding: '30px',
                textAlign: 'center',
                border: '1px solid #ddd',
                borderRadius: '12px',
                background: '#fff'
              }}
            >

              <h3>
                No workflow runs yet
              </h3>

              <p>
                This workflow has not been executed yet.
              </p>

              <p
                style={{
                  fontSize: '13px',
                  color: '#777'
                }}
              >
                Click the Run button from the dashboard
                to create the first run.
              </p>

            </div>

          )}


        {/* =================================================
            RUN LIST
        ================================================= */}

        {!loading &&
          !error &&
          runs.length > 0 && (

            <div
              style={{
                marginTop: '30px',
                display: 'grid',
                gap: '20px'
              }}
            >

              {runs.map(
                (run, runIndex) => {

                  /*
                    Runs are already ordered:
                    newest -> oldest

                    Therefore:
                    newest run = Run #runs.length
                    oldest run = Run #1
                  */

                  const runNumber =
                    runs.length - runIndex


                  // Safely sort steps without modifying
                  // the original GraphQL response.
                  const sortedStepRuns =
                    [...(
                      run.step_runs || []
                    )].sort(
                      (a, b) => {

                        const positionA =
                          a.workflow_step?.position ??
                          0

                        const positionB =
                          b.workflow_step?.position ??
                          0

                        return (
                          positionA -
                          positionB
                        )

                      }
                    )


                  return (

                    <div
                      key={run.id}
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

                      {/* =================================================
                          RUN HEADER
                      ================================================= */}

                      <div
                        style={{
                          display:
                            'flex',

                          justifyContent:
                            'space-between',

                          alignItems:
                            'center',

                          gap:
                            '15px',

                          flexWrap:
                            'wrap'
                        }}
                      >

                        <h3>
                          Run #{runNumber}
                        </h3>


                        <strong>

                          {getStatusIcon(
                            run.status
                          )}

                          {' '}

                          {run.status ||
                            'unknown'}

                        </strong>

                      </div>


                      {/* =================================================
                          RUN ID
                      ================================================= */}

                      <p>

                        <strong>
                          Run ID:
                        </strong>{' '}

                        {run.id}

                      </p>


                      {/* =================================================
                          WORKFLOW ID
                      ================================================= */}

                      <p>

                        <strong>
                          Workflow ID:
                        </strong>{' '}

                        {run.workflow_id}

                      </p>


                      {/* =================================================
                          CREATED
                      ================================================= */}

                      <p>

                        <strong>
                          Created:
                        </strong>{' '}

                        {formatDate(
                          run.created_at
                        )}

                      </p>


                      {/* =================================================
                          STARTED
                      ================================================= */}

                      <p>

                        <strong>
                          Started:
                        </strong>{' '}

                        {formatDate(
                          run.started_at
                        )}

                      </p>


                      {/* =================================================
                          COMPLETED
                      ================================================= */}

                      <p>

                        <strong>
                          Completed:
                        </strong>{' '}

                        {formatDate(
                          run.completed_at
                        )}

                      </p>


                      {/* =================================================
                          STEP EXECUTIONS
                      ================================================= */}

                      <div
                        style={{
                          marginTop:
                            '20px'
                        }}
                      >

                        <h4>
                          Step Executions
                        </h4>


                        {sortedStepRuns.length === 0 && (

                          <p>
                            No step executions found.
                          </p>

                        )}


                        {sortedStepRuns.length > 0 && (

                          <div
                            style={{
                              display:
                                'grid',

                              gap:
                                '15px'
                            }}
                          >

                            {sortedStepRuns.map(
                              (
                                stepRun,
                                stepIndex
                              ) => (

                                <div
                                  key={
                                    stepRun.id
                                  }
                                  style={{
                                    border:
                                      '1px solid #eee',

                                    borderRadius:
                                      '10px',

                                    padding:
                                      '15px',

                                    background:
                                      '#fafafa'
                                  }}
                                >

                                  {/* STEP NAME */}

                                  <h4>

                                    {getStepStatusIcon(
                                      stepRun.status
                                    )}

                                    {' '}

                                    Step {stepIndex + 1}:{' '}

                                    {stepRun
                                      .workflow_step
                                      ?.name ||
                                      'Unknown Step'}

                                  </h4>


                                  {/* TYPE */}

                                  <p>

                                    <strong>
                                      Type:
                                    </strong>{' '}

                                    {stepRun
                                      .workflow_step
                                      ?.type ||
                                      'Unknown'}

                                  </p>


                                  {/* STATUS */}

                                  <p>

                                    <strong>
                                      Status:
                                    </strong>{' '}

                                    {stepRun.status ||
                                      'unknown'}

                                  </p>


                                  {/* STEP RUN ID */}

                                  <p>

                                    <strong>
                                      Step Run ID:
                                    </strong>{' '}

                                    {stepRun.id}

                                  </p>


                                  {/* WORKFLOW STEP ID */}

                                  <p>

                                    <strong>
                                      Workflow Step ID:
                                    </strong>{' '}

                                    {stepRun.workflow_step_id}

                                  </p>


                                  {/* INPUT */}

                                  <div
                                    style={{
                                      marginTop:
                                        '10px'
                                    }}
                                  >

                                    <strong>
                                      Input
                                    </strong>

                                    <pre
                                      style={{
                                        marginTop:
                                          '8px',

                                        padding:
                                          '10px',

                                        borderRadius:
                                          '6px',

                                        background:
                                          '#f1f1f1',

                                        overflowX:
                                          'auto',

                                        whiteSpace:
                                          'pre-wrap'
                                      }}
                                    >
{JSON.stringify(
  stepRun.input,
  null,
  2
)}
                                    </pre>

                                  </div>


                                  {/* OUTPUT */}

                                  <div
                                    style={{
                                      marginTop:
                                        '10px'
                                    }}
                                  >

                                    <strong>
                                      Output
                                    </strong>

                                    <pre
                                      style={{
                                        marginTop:
                                          '8px',

                                        padding:
                                          '10px',

                                        borderRadius:
                                          '6px',

                                        background:
                                          '#f1f1f1',

                                        overflowX:
                                          'auto',

                                        whiteSpace:
                                          'pre-wrap'
                                      }}
                                    >
{JSON.stringify(
  stepRun.output,
  null,
  2
)}
                                    </pre>

                                  </div>


                                  {/* STEP STARTED */}

                                  <p>

                                    <strong>
                                      Started:
                                    </strong>{' '}

                                    {formatDate(
                                      stepRun.started_at
                                    )}

                                  </p>


                                  {/* STEP COMPLETED */}

                                  <p>

                                    <strong>
                                      Completed:
                                    </strong>{' '}

                                    {formatDate(
                                      stepRun.completed_at
                                    )}

                                  </p>

                                </div>

                              )
                            )}

                          </div>

                        )}

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


export default RunHistory