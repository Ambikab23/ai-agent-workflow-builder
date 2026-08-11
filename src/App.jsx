import { useEffect, useState } from 'react'
import './App.css'
import { nhost } from './lib/nhost'

import Dashboard from './Dashboard'
import WorkflowBuilder from './WorkflowBuilder'
import RunHistory from './RunHistory'

function App() {

  // =====================================================
  // AUTH STATE
  // =====================================================

  const [user, setUser] = useState(null)

  const [isSignup, setIsSignup] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [message, setMessage] = useState('')


  // =====================================================
  // PAGE STATE
  // =====================================================

  const [page, setPage] = useState('dashboard')


  // =====================================================
  // WORKFLOW STATE
  // =====================================================

  const [editingWorkflow, setEditingWorkflow] =
    useState(null)

  const [historyWorkflow, setHistoryWorkflow] =
    useState(null)


  // =====================================================
  // CHECK AUTH
  // =====================================================

  useEffect(() => {

    let mounted = true

    const checkAuth = async () => {

      try {

        console.log(
          '========== CHECK AUTH =========='
        )

        const storedSession =
          nhost.auth.getSession?.()

        console.log(
          'STORED SESSION:',
          storedSession
        )

        if (
          storedSession &&
          storedSession.user
        ) {

          if (mounted) {

            setUser(
              storedSession.user
            )

            setPage('dashboard')

          }

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

  const handleSubmit = async (e) => {

    e.preventDefault()

    setLoading(true)
    setMessage('')

    try {

      // =================================================
      // SIGN UP
      // =================================================

      if (isSignup) {

        console.log(
          '========== SIGN UP =========='
        )

        const response =
          await nhost.auth.signUpEmailPassword({

            email: email.trim(),
            password

          })

        console.log(
          'SIGNUP RESPONSE:',
          response
        )

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


      // =================================================
      // LOGIN
      // =================================================

      console.log(
        '========== LOGIN =========='
      )

      const response =
        await nhost.auth.signInEmailPassword({

          email: email.trim(),
          password

        })

      console.log(
        'FULL LOGIN RESPONSE:',
        response
      )

      console.log(
        'LOGIN RESPONSE BODY:',
        response?.body
      )


      // =================================================
      // CHECK ERROR
      // =================================================

      if (response?.body?.error) {

        console.error(
          'LOGIN ERROR:',
          response.body.error
        )

        setMessage(
          response.body.error.message
        )

        return
      }

      if (response?.error) {

        console.error(
          'LOGIN ERROR:',
          response.error
        )

        setMessage(
          response.error.message
        )

        return
      }


      // =================================================
      // GET SESSION
      // =================================================

      const session =
        response?.body?.session

      console.log(
        'LOGIN SESSION:',
        session
      )

      if (!session) {

        setMessage(
          'Login failed. Nhost did not return a session.'
        )

        return
      }


      // =================================================
      // GET USER
      // =================================================

      const loggedInUser =
        session.user

      console.log(
        'LOGGED IN USER:',
        loggedInUser
      )

      if (!loggedInUser) {

        setMessage(
          'Login succeeded, but no user was returned.'
        )

        return
      }


      // =================================================
      // SAVE USER
      // =================================================

      setUser(loggedInUser)

      setPage('dashboard')

      setEditingWorkflow(null)

      setHistoryWorkflow(null)

      setPassword('')

      setMessage('')

      console.log(
        '========== LOGIN SUCCESS =========='
      )

      console.log(
        'USER ID:',
        loggedInUser.id
      )

      console.log(
        'USER EMAIL:',
        loggedInUser.email
      )

    } catch (error) {

      console.error(
        'AUTHENTICATION EXCEPTION:',
        error
      )

      setMessage(
        error?.message ||
        'Something went wrong during authentication.'
      )

    } finally {

      setLoading(false)

    }

  }


  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {

    console.log(
      '========== LOGOUT =========='
    )

    setLoading(true)

    try {

      await nhost.auth.signOut()

      console.log(
        'Nhost logout successful'
      )

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

      setLoading(false)

      console.log(
        '========== LOGOUT COMPLETE =========='
      )

    }

  }


  // =====================================================
  // CREATE WORKFLOW
  // =====================================================

  const handleCreateWorkflow = () => {

    console.log(
      '========== CREATE WORKFLOW =========='
    )

    console.log(
      'CURRENT USER:',
      user
    )

    console.log(
      'CURRENT USER ID:',
      user?.id
    )

    setEditingWorkflow(null)

    setHistoryWorkflow(null)

    setPage('workflow')

  }


  // =====================================================
  // EDIT WORKFLOW
  // =====================================================

  const handleEditWorkflow = (workflow) => {

    console.log(
      '========== EDIT WORKFLOW =========='
    )

    console.log(
      'SELECTED WORKFLOW:',
      workflow
    )

    console.log(
      'WORKFLOW ID:',
      workflow?.id
    )

    setEditingWorkflow(workflow)

    setHistoryWorkflow(null)

    setPage('workflow')

  }


  // =====================================================
  // OPEN RUN HISTORY
  // =====================================================

  const handleRunHistory = (workflow) => {

    console.log(
      '========== RUN HISTORY =========='
    )

    console.log(
      'SELECTED WORKFLOW:',
      workflow
    )

    console.log(
      'WORKFLOW ID:',
      workflow?.id
    )

    if (!workflow?.id) {

      alert(
        'Workflow ID is missing.'
      )

      return
    }

    setHistoryWorkflow(workflow)

    setEditingWorkflow(null)

    setPage('run-history')

  }


  // =====================================================
  // BACK TO DASHBOARD
  // =====================================================

  const handleBack = () => {

    console.log(
      '========== BACK TO DASHBOARD =========='
    )

    setEditingWorkflow(null)

    setHistoryWorkflow(null)

    setPage('dashboard')

  }


  // =====================================================
  // AUTH CHECK SCREEN
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
  // LOGGED-IN APPLICATION
  // =====================================================

  if (user) {

    // ===================================================
    // WORKFLOW BUILDER
    // ===================================================

    if (page === 'workflow') {

      console.log(
        'RENDERING WORKFLOW BUILDER'
      )

      console.log(
        'EDITING WORKFLOW:',
        editingWorkflow
      )

      return (

        <WorkflowBuilder

          user={user}

          workflow={editingWorkflow}

          onBack={handleBack}

        />

      )

    }


    // ===================================================
    // RUN HISTORY
    // ===================================================

    if (page === 'run-history') {

      console.log(
        'RENDERING RUN HISTORY'
      )

      console.log(
        'HISTORY WORKFLOW:',
        historyWorkflow
      )

      return (

        <RunHistory

          workflow={historyWorkflow}

          onBack={handleBack}

        />

      )

    }


    // ===================================================
    // DASHBOARD
    // ===================================================

    console.log(
      'RENDERING DASHBOARD'
    )

    return (

      <Dashboard

        user={user}

        onLogout={handleLogout}

        onCreateWorkflow={
          handleCreateWorkflow
        }

        onEditWorkflow={
          handleEditWorkflow
        }

        onRunHistory={
          handleRunHistory
        }

      />

    )

  }


  // =====================================================
  // LOGIN / SIGNUP PAGE
  // =====================================================

  return (

    <div className="page">

      <div className="auth-card">

        {/* LOGO */}

        <div className="logo">
          ⚡
        </div>


        {/* TITLE */}

        <h1>
          AI Agent
        </h1>

        <h1 className="title-second">
          Workflow Builder
        </h1>


        {/* SUBTITLE */}

        <p className="subtitle">

          {isSignup
            ? 'Create your account'
            : 'Build, automate and manage AI workflows'}

        </p>


        {/* FORM */}

        <form onSubmit={handleSubmit}>

          {/* EMAIL */}

          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            disabled={loading}
            required
          />


          {/* PASSWORD */}

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            disabled={loading}
            required
          />


          {/* LOGIN / SIGNUP */}

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


        {/* MESSAGE */}

        {message && (

          <p className="message">
            {message}
          </p>

        )}


        {/* SWITCH */}

        <button
          className="switch-button"
          type="button"
          disabled={loading}
          onClick={() => {

            setIsSignup(
              !isSignup
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