// 08/06 updated styling with reference to design system 
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import shake from '../hooks/shake'
import { Card, Button, Spinner, Label, ErrorText } from '../components/UI'

const greetings = [
  'Ready to rock? 🎸',
  "Make some music! 🎵",
  'Welcome back, rockstar! 🌟',
  'Time to jam! 🥁',
  'Book some slots today! 🎹',
  'Strike a chord today! 🎶',
  'Practice makes perfect! 👩‍🎤'
]
const inputClass = `
  w-1/2 flex-1 min-w-0 px-3 py-2.5 text-sm border border-beige rounded-l-xl
  bg-cream text-navy outline-none focus:border-primary focus:ring-2
  focus:ring-primary focus:ring-opacity-30
`

const suffixClass = `
  w-28 sm:w-32 flex items-center justify-center text-xs sm:text-sm
  bg-beige border border-beige rounded-r-xl text-navy opacity-70 shrink-0 text-center px-1
`

function Login() {
  const [emailPrefix, setEmailPrefix] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState('')
  const [greetingIndex, setGreetingIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [bumped, setBumped] = useState(false)
  const navigate = useNavigate()

  const { shakeStyle, triggerShake } = shake()

  // typewriter effect
  useEffect(() => {
    const current = greetings[greetingIndex]
    let timeout

    if (!isDeleting && typed.length < current.length) {
      timeout = setTimeout(() => {
        setTyped(current.slice(0, typed.length + 1))
      }, 80)
    } else if (!isDeleting && typed.length === current.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true)
      }, 1500)
    } else if (isDeleting && typed.length > 0) {
      timeout = setTimeout(() => {
        setTyped(current.slice(0, typed.length - 1))
      }, 40)
    } else if (isDeleting && typed.length === 0) {
      setIsDeleting(false)
      setGreetingIndex(prev => (prev + 1) % greetings.length)
    }

    return () => clearTimeout(timeout)
  }, [typed, isDeleting, greetingIndex])

  function handleEmailChange(e) {
    const prefix = e.target.value
    setEmailPrefix(prefix)
    setEmail(prefix + '@u.nus.edu')
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (!emailPrefix || !password) {
      setError('Please fill in all fields')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')

    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false)
        if (data.error === 'pending') {
          setIsPending(true)
        } else if (data.error) {
          setError(data.error)
          triggerShake()
        } else {
          localStorage.setItem('user', JSON.stringify(data))
          navigate('/dashboard')
        }
      })
      .catch(() => {
        setLoading(false)
        setError('Something went wrong. Please try again.')
        triggerShake()
      })
  }

  // pending screen
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm md:max-w-md lg:max-w-lg">
          <Card className="p-8 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-semibold text-navy mb-3">Account Pending</h1>
            <p className="text-sm text-navy opacity-60 mb-6">
              Your account is still waiting for admin approval. You can nudge the admin to remind them!
            </p>
            {bumped ? (
              <p className="text-sm text-successText mb-4">Admin has been notified! ✅</p>
            ) : (
              <Button
                variant = "secondary"
                className= "w-full mb-3"
                onClick={() => {
                  fetch(`${API_URL}/api/auth/bump-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  }).then(() => setBumped(true))
                }}
              >
                Nudge Admin 👋
              </Button>
            )}
            <Button variant ="primary" className="w-full" 
              onClick={() => setIsPending(false)}
            >
              Back to Login
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm md:max-w-md lg:max-w-lg">

        {/* header */}
        <Card className="p-8 text-center mb-6">
          <h1 className="text-3xl font-medium text-navy mb-3">Jukebox</h1>
          <img src={Mascot} alt="JukeBox mascot" className="w-64 mx-auto mb-3" />
          <p className="text-sm text-navy opacity-60 min-h-[20px]">
            {typed}<span className="animate-pulse">|</span>
          </p>
        </Card>

        {/* form */}
        <Card
          className="p-6"
          style={shakeStyle}
        >
          <form onSubmit={handleSubmit}>

            {/* NUS email */}
            <div className="mb-4">
              <Label>NUS Email</Label>
              <div className="flex w-full">
                <input
                  type="text"
                  placeholder="e1234567"
                  value={emailPrefix}
                  onChange={handleEmailChange}
                  className= {inputClass}
                />
                <span className={suffixClass}>@u.nus.edu
                </span>
              </div>
            </div>

            {/* password */}
            <div className="mb-5">
              <Label>Password</Label>
              <div className="flex w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className= {suffixClass}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <ErrorText>{error}</ErrorText>

            <Button
              type="submit" variant = "primary"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner />
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-navy opacity-50 mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-pinkDark underline">Sign up here.</Link>
          </p>
        </Card>

      </div>
    </div>
  )
}

export default Login