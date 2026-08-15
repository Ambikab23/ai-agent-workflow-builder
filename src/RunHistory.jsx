import { useEffect, useState } from 'react'
import './RunHistory.css'
import { nhost } from './lib/nhost'

function RunHistory({
  workflow,
  onBack
}) {

  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


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
  // LOAD RUNS
  // =====================================================

  const loadRuns = async () => {

    if (!workflow?.id) {

      setRuns([])
      setLoading(false)

      return
    }

    try {

      setLoading(true)
      setError('')


      const query = `
        query GetWorkflowRuns(
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

            step_runs {

              id
              workflow_run_id
              step_id
              status
              input
              output
              started_at
              completed_at
              created_at

              workflow_step {

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


      const response =
        await nhost.graphql.request({

          query,

          variables: {

            workflowId:
              workflow.id

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
          ?.workflow_runs || []


      setRuns(data)


    } catch (error) {

      console.error(
        'RUN HISTORY ERROR:',
        error
      )

      setError(
        error?.message ||
        'Failed to load run history.'
      )

      setRuns([])

    } finally {

      setLoading(false)

    }

  }


  // =====================================================
  // LOAD WHEN WORKFLOW CHANGES
  // =====================================================

  useEffect(() => {

    loadRuns()

  }, [
    workflow?.id
  ])


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
  // STATUS CLASS
  // =====================================================

  const getStatusClass = status => {

    if (status === 'completed') {
      return 'completed'
    }

    if (status === 'running') {
      return 'running'
    }

    if (status === 'failed') {
      return 'failed'
    }

    return 'pending'

  }


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div
      style={{
        minHeight:
          '100vh',

        background:
          '#f5f7fb',

        padding:
          '30px'
      }}
    >

      <div
        style={{
          maxWidth:
            '1000px',

          margin:
            '0 auto'
        }}
      >

        {/* BACK BUTTON */}

        <button
          type="button"
          onClick={onBack}
          style={{
            marginBottom:
              '20px'
          }}
        >
          ← Back
        </button>


        <div
          style={{
            background:
              '#fff',

            borderRadius:
              '12px',

            padding:
              '25px'
          }}
        >

          {/* TITLE */}

          <h1>
            📋 Run History
          </h1>


          <h2>
            {workflow?.name ||
              'Workflow'}
          </h2>


          <p>
            {workflow?.description ||
              'No description'}
          </p>


          {/* ERROR */}

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


          {/* LOADING */}

          {loading && (

            <div
              style={{
                padding:
                  '30px',

                textAlign:
                  'center'
              }}
            >

              Loading run history...

            </div>

          )}


          {/* EMPTY */}

          {!loading &&
            !error &&
            runs.length === 0 && (

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
                    '10px'
                }}
              >

                <h3>
                  No runs yet
                </h3>


                <p>
                  Run this workflow from the
                  dashboard to see its history here.
                </p>

              </div>

            )}


          {/* RUN LIST */}

          {!loading &&
            !error &&
            runs.length > 0 && (

              <div
                style={{
                  marginTop:
                    '25px',

                  display:
                    'grid',

                  gap:
                    '20px'
                }}
              >

                {runs.map(
                  run => (

                    <div
                      key={
                        run.id
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

                      {/* RUN HEADER */}

                      <div
                        style={{
                          display:
                            'flex',

                          justifyContent:
                            'space-between',

                          alignItems:
                            'center',

                          flexWrap:
                            'wrap',

                          gap:
                            '10px'
                        }}
                      >

                        <h3>
                          Run
                        </h3>


                        <span
                          className={
                            getStatusClass(
                              run.status
                            )
                          }

                          style={{
                            padding:
                              '6px 12px',

                            borderRadius:
                              '20px',

                            background:
                              '#eee'
                          }}
                        >

                          {run.status}

                        </span>

                      </div>


                      {/* RUN ID */}

                      <p>

                        <strong>
                          Run ID:
                        </strong>{' '}

                        {run.id}

                      </p>


                      {/* STARTED */}

                      <p>

                        <strong>
                          Started:
                        </strong>{' '}

                        {formatDate(
                          run.started_at
                        )}

                      </p>


                      {/* COMPLETED */}

                      <p>

                        <strong>
                          Completed:
                        </strong>{' '}

                        {formatDate(
                          run.completed_at
                        )}

                      </p>


                      {/* CREATED */}

                      <p>

                        <strong>
                          Created:
                        </strong>{' '}

                        {formatDate(
                          run.created_at
                        )}

                      </p>


                      {/* STEP RUNS */}

                      <h4>
                        Step Runs
                      </h4>


                      {!run.step_runs?.length && (

                        <p>
                          No step runs recorded.
                        </p>

                      )}


                      {run.step_runs
                        ?.slice()
                        .sort(
                          (a, b) =>
                            (
                              a.workflow_step
                                ?.step_order || 0
                            ) -
                            (
                              b.workflow_step
                                ?.step_order || 0
                            )
                        )
                        .map(
                          (
                            stepRun,
                            index
                          ) => (

                            <div
                              key={
                                stepRun.id
                              }

                              style={{
                                border:
                                  '1px solid #eee',

                                borderRadius:
                                  '8px',

                                padding:
                                  '15px',

                                marginTop:
                                  '10px'
                              }}
                            >

                              {/* STEP NAME */}

                              <strong>

                                Step {index + 1}:{' '}

                                {stepRun
                                  .workflow_step
                                  ?.name ||
                                  'Unknown Step'}

                              </strong>


                              {/* TYPE */}

                              <p>

                                Type:{' '}

                                {stepRun
                                  .workflow_step
                                  ?.type ||
                                  'Unknown'}

                              </p>


                              {/* STATUS */}

                              <p>

                                Status:{' '}

                                {stepRun.status}

                              </p>


                              {/* STARTED */}

                              <p>

                                Started:{' '}

                                {formatDate(
                                  stepRun.started_at
                                )}

                              </p>


                              {/* COMPLETED */}

                              <p>

                                Completed:{' '}

                                {formatDate(
                                  stepRun.completed_at
                                )}

                              </p>


                              {/* INPUT */}

                              {stepRun.input && (

                                <details
                                  style={{
                                    marginTop:
                                      '10px'
                                  }}
                                >

                                  <summary>
                                    View Input
                                  </summary>


                                  <pre
                                    style={{
                                      whiteSpace:
                                        'pre-wrap',

                                      wordBreak:
                                        'break-word',

                                      background:
                                        '#f5f5f5',

                                      padding:
                                        '10px',

                                      borderRadius:
                                        '6px',

                                      marginTop:
                                        '10px'
                                    }}
                                  >

                                    {JSON.stringify(
                                      stepRun.input,
                                      null,
                                      2
                                    )}

                                  </pre>

                                </details>

                              )}


                              {/* OUTPUT */}

                              {stepRun.output && (

                                <details
                                  style={{
                                    marginTop:
                                      '10px'
                                  }}
                                >

                                  <summary>
                                    View Output
                                  </summary>


                                  <pre
                                    style={{
                                      whiteSpace:
                                        'pre-wrap',

                                      wordBreak:
                                        'break-word',

                                      background:
                                        '#f5f5f5',

                                      padding:
                                        '10px',

                                      borderRadius:
                                        '6px',

                                      marginTop:
                                        '10px'
                                    }}
                                  >

                                    {JSON.stringify(
                                      stepRun.output,
                                      null,
                                      2
                                    )}

                                  </pre>

                                </details>

                              )}

                            </div>

                          )
                        )}

                    </div>

                  )
                )}

              </div>

            )}

        </div>

      </div>

    </div>

  )

}


export default RunHistory