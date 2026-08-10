import { useEffect, useState } from 'react'
import { nhost } from './lib/nhost'
import Dashboard from './Dashboard'
import WorkflowBuilder from './WorkflowBuilder'
import './App.css'

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
  // WORKFLOW EDIT STATE
  // null = create new workflow
  // object = edit existing workflow
  // =====================================================

  const [editingWorkflow, setEditingWorkflow] = useState(null)


  // =====================================================
  // CHECK EXISTING AUTHENTICATION
  // =====================================================

  useEffect(() => {

    let mounted = true

    const checkAuth = async () => {

      try {

        console.log(
          '========== CHECK AUTH =========='
        )


        /*
          Your installed SDK is @nhost/nhost-js 4.8.0.

          We therefore use optional chaining here so the
          application does not crash if getSession is not
          available.
        */

        const storedSession =
          nhost.auth.getSession?.()


        console.log(
          'STORED SESSION:',
          storedSession
        )


        /*
          If a session exists and contains a user,
          restore the logged-in state.
        */

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
      // CHECK LOGIN ERROR
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

        console.error(
          'NO SESSION:',
          response
        )


        setMessage(
          'Login failed. Nhost did not return a session.'
        )


        return

      }


      // =================================================
      // GET USER FROM SESSION
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

      setUser(
        loggedInUser
      )


      // Always go to dashboard after login

      setPage(
        'dashboard'
      )


      // Clear any previous edit

      setEditingWorkflow(
        null
      )


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

      /*
        Clear everything immediately.

        This makes the login page appear without requiring
        a browser refresh.
      */

      setUser(null)

      setPage('dashboard')

      setEditingWorkflow(null)

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
  // CREATE NEW WORKFLOW
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


    /*
      Dashboard is only rendered when user exists.

      Therefore we do not need another login check here.
    */

    setEditingWorkflow(null)

    setPage('workflow')

  }


  // =====================================================
  // EDIT EXISTING WORKFLOW
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


    /*
      Store the selected workflow.

      WorkflowBuilder will use this object to populate:

      - Name
      - Description
      - Trigger
    */

    setEditingWorkflow(
      workflow
    )


    setPage(
      'workflow'
    )

  }


  // =====================================================
  // BACK TO DASHBOARD
  // =====================================================

  const handleBack = () => {

    console.log(
      '========== BACK TO DASHBOARD =========='
    )


    setEditingWorkflow(
      null
    )


    setPage(
      'dashboard'
    )

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

      />

    )

  }


  // =====================================================
  // LOGIN / SIGNUP PAGE
  // =====================================================

  return (

    <div className="page">

      <div className="auth-card">

        {/* Logo */}

        <div className="logo">
          ⚡
        </div>


        {/* Title */}

        <h1>
          AI Agent
        </h1>


        <h1 className="title-second">
          Workflow Builder
        </h1>


        {/* Subtitle */}

        <p className="subtitle">

          {isSignup
            ? 'Create your account'
            : 'Build, automate and manage AI workflows'}

        </p>


        {/* Login / Signup Form */}

        <form onSubmit={handleSubmit}>

          {/* Email */}

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


          {/* Password */}

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


          {/* Login / Signup button */}

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


        {/* Error / Success message */}

        {message && (

          <p className="message">

            {message}

          </p>

        )}


        {/* Switch Login / Signup */}

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