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
            error
            created_by
            created_at

            step_runs {

              id
              workflow_run_id
              step_id
              status
              input
              output
              error
              attempt_count
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
        throw new Error(graphQLError)
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

  useEffect(() => {

    loadRuns()

  }, [
    workflow?.id
  ])

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

  return (

    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '30px'
      }}
    >

      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto'
        }}
      >

        <button
          type="button"
          onClick={onBack}
          style={{
            marginBottom: '20px'
          }}
        >
          ← Back
        </button>

        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '25px'
          }}
        >

          <h1>
            📋 Run History
          </h1>

          <h2>
            {workflow?.name || 'Workflow'}
          </h2>

          <p>
            {workflow?.description ||
              'No description'}
          </p>

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
              {error}
            </div>

          )}

          {loading && (

            <div
              style={{
                padding: '30px',
                textAlign: 'center'
              }}
            >
              Loading run history...
            </div>

          )}

          {!loading &&
            !error &&
            runs.length === 0 && (

              <div
                style={{
                  marginTop: '30px',
                  padding: '30px',
                  textAlign: 'center',
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
                  Run this workflow from the dashboard
                  to see its history here.
                </p>

              </div>

            )}

          {!loading &&
            !error &&
            runs.length > 0 && (

              <div
                style={{
                  marginTop: '25px',
                  display: 'grid',
                  gap: '20px'
                }}
              >

                {runs.map(run => (

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

                    <p>
                      <strong>
                        Run ID:
                      </strong>{' '}
                      {run.id}
                    </p>

                    <p>
                      <strong>
                        Started:
                      </strong>{' '}
                      {formatDate(
                        run.started_at
                      )}
                    </p>

                    <p>
                      <strong>
                        Completed:
                      </strong>{' '}
                      {formatDate(
                        run.completed_at
                      )}
                    </p>

                    {run.error && (

                      <p
                        style={{
                          color:
                            '#b00020'
                        }}
                      >
                        <strong>
                          Error:
                        </strong>{' '}
                        {run.error}
                      </p>

                    )}

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

                            <strong>
                              Step {index + 1}:{' '}
                              {stepRun
                                .workflow_step
                                ?.name ||
                                'Unknown Step'}
                            </strong>

                            <p>
                              Type:{' '}
                              {stepRun
                                .workflow_step
                                ?.type ||
                                'Unknown'}
                            </p>

                            <p>
                              Status:{' '}
                              {stepRun.status}
                            </p>

                            <p>
                              Started:{' '}
                              {formatDate(
                                stepRun.started_at
                              )}
                            </p>

                            <p>
                              Completed:{' '}
                              {formatDate(
                                stepRun.completed_at
                              )}
                            </p>

                            {stepRun.error && (

                              <p
                                style={{
                                  color:
                                    '#b00020'
                                }}
                              >
                                Error:{' '}
                                {stepRun.error}
                              </p>

                            )}

                            {stepRun.output && (

                              <details>

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
                                      '6px'
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

                ))}

              </div>

            )}

        </div>

      </div>

    </div>

  )
}

export default RunHistory