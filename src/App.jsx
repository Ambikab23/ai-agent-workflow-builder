import { useEffect, useState } from 'react'
import './App.css'
import { nhost } from './lib/nhost'

import Dashboard from './Dashboard'
import WorkflowBuilder from './WorkflowBuilder'
import RunHistory from './RunHistory'

function App() {

  const [user, setUser] = useState(null)

  const [isSignup, setIsSignup] =
    useState(false)

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [checkingAuth, setCheckingAuth] =
    useState(true)

  const [message, setMessage] =
    useState('')

  const [page, setPage] =
    useState('dashboard')

  const [editingWorkflow, setEditingWorkflow] =
    useState(null)

  const [historyWorkflow, setHistoryWorkflow] =
    useState(null)

  const [dashboardRefreshKey, setDashboardRefreshKey] =
    useState(0)

  // =====================================================
  // AUTH CHECK
  // =====================================================

  useEffect(() => {

    let mounted = true

    const checkAuth = async () => {

      try {

        const session =
          nhost.auth.getSession?.()

        if (
          session?.user &&
          mounted
        ) {

          setUser(
            session.user
          )

          setPage(
            'dashboard'
          )

        }

      } catch (error) {

        console.error(
          'AUTH CHECK ERROR:',
          error
        )

        if (mounted) {
          setUser(null)
        }

      } finally {

        if (mounted) {
          setCheckingAuth(false)
        }

      }

    }

    checkAuth()

    return () => {
      mounted = false
    }

  }, [])

  // =====================================================
  // LOGIN / SIGNUP
  // =====================================================

  const handleSubmit = async e => {

    e.preventDefault()

    setLoading(true)
    setMessage('')

    try {

      if (isSignup) {

        const response =
          await nhost.auth
            .signUpEmailPassword({

              email:
                email.trim(),

              password

            })

        if (response?.body?.error) {

          setMessage(
            response.body.error.message
          )

          return
        }

        if (response?.error) {

          setMessage(
            response.error.message
          )

          return
        }

        setMessage(
          'Account created successfully. Please login.'
        )

        setIsSignup(false)
        setPassword('')

        return
      }

      const response =
        await nhost.auth
          .signInEmailPassword({

            email:
              email.trim(),

            password

          })

      if (response?.body?.error) {

        setMessage(
          response.body.error.message
        )

        return
      }

      if (response?.error) {

        setMessage(
          response.error.message
        )

        return
      }

      const session =
        response?.body?.session

      if (!session) {

        setMessage(
          'Login failed. Nhost did not return a session.'
        )

        return
      }

      const loggedInUser =
        session.user

      if (!loggedInUser) {

        setMessage(
          'Login succeeded, but no user was returned.'
        )

        return
      }

      setUser(
        loggedInUser
      )

      setPage(
        'dashboard'
      )

      setEditingWorkflow(null)
      setHistoryWorkflow(null)
      setPassword('')
      setMessage('')

      setDashboardRefreshKey(
        previous =>
          previous + 1
      )

    } catch (error) {

      console.error(
        'AUTH ERROR:',
        error
      )

      setMessage(
        error?.message ||
        'Authentication failed.'
      )

    } finally {

      setLoading(false)

    }

  }

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {

    setLoading(true)

    try {

      await nhost.auth.signOut()

    } catch (error) {

      console.error(
        'LOGOUT ERROR:',
        error
      )

    } finally {

      setUser(null)
      setPage('dashboard')
      setEditingWorkflow(null)
      setHistoryWorkflow(null)
      setEmail('')
      setPassword('')
      setMessage('')
      setDashboardRefreshKey(0)
      setLoading(false)

    }

  }

  // =====================================================
  // CREATE
  // =====================================================

  const handleCreateWorkflow = () => {

    setEditingWorkflow(null)
    setHistoryWorkflow(null)
    setPage('workflow')

  }

  // =====================================================
  // EDIT
  // =====================================================

  const handleEditWorkflow =
    workflow => {

      setEditingWorkflow(
        workflow
      )

      setHistoryWorkflow(null)
      setPage('workflow')

    }

  // =====================================================
  // HISTORY
  // =====================================================

  const handleRunHistory =
    workflow => {

      if (!workflow?.id) {

        alert(
          'Workflow ID is missing.'
        )

        return
      }

      setHistoryWorkflow(
        workflow
      )

      setEditingWorkflow(null)
      setPage('run-history')

    }

  // =====================================================
  // BACK
  // =====================================================

  const handleBack = () => {

    setDashboardRefreshKey(
      previous =>
        previous + 1
    )

    setEditingWorkflow(null)
    setHistoryWorkflow(null)
    setPage('dashboard')

  }

  // =====================================================
  // AUTH SCREEN
  // =====================================================

  if (checkingAuth) {

    return (

      <div className="page">

        <div className="auth-card">

          <div className="logo">
            ⚡
          </div>

          <h1>
            AI Agent
          </h1>

          <h1 className="title-second">
            Workflow Builder
          </h1>

          <p className="subtitle">
            Checking your session...
          </p>

        </div>

      </div>

    )

  }

  // =====================================================
  // LOGGED IN
  // =====================================================

  if (user) {

    if (page === 'workflow') {

      return (

        <WorkflowBuilder
          user={user}
          workflow={editingWorkflow}
          onBack={handleBack}
        />

      )

    }

    if (page === 'run-history') {

      return (

        <RunHistory
          workflow={historyWorkflow}
          onBack={handleBack}
        />

      )

    }

    return (

      <Dashboard

        key={
          dashboardRefreshKey
        }

        user={user}

        onLogout={
          handleLogout
        }

        onCreateWorkflow={
          handleCreateWorkflow
        }

        onEditWorkflow={
          handleEditWorkflow
        }

        onRunHistory={
          handleRunHistory
        }

        refreshKey={
          dashboardRefreshKey
        }

      />

    )

  }

  // =====================================================
  // LOGIN
  // =====================================================

  return (

    <div className="page">

      <div className="auth-card">

        <div className="logo">
          ⚡
        </div>

        <h1>
          AI Agent
        </h1>

        <h1 className="title-second">
          Workflow Builder
        </h1>

        <p className="subtitle">

          {isSignup
            ? 'Create your account'
            : 'Build, automate and manage AI workflows'}

        </p>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e =>
              setEmail(
                e.target.value
              )
            }
            disabled={loading}
            required
          />

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e =>
              setPassword(
                e.target.value
              )
            }
            disabled={loading}
            required
          />

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >

            {loading
              ? 'Please wait...'
              : isSignup
                ? 'Create Account'
                : 'Login'}

          </button>

        </form>

        {message && (

          <p className="message">
            {message}
          </p>

        )}

        <button
          className="switch-button"
          type="button"
          disabled={loading}
          onClick={() => {

            setIsSignup(
              previous =>
                !previous
            )

            setMessage('')
            setPassword('')

          }}
        >

          {isSignup
            ? 'Already have an account? Login'
            : "Don't have an account? Sign Up"}

        </button>

      </div>

    </div>

  )

}

export default App