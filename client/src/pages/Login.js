import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import Blobs from '../components/Blobs'
import shake from '../hooks/shake'
import cursorParticles from '../hooks/cursorParticles'

const greetings = [
  'Ready to rock? 🎸',
  "Make some music! 🎵",
  'Welcome back, rockstar! 🌟',
  'Time to jam! 🥁',
  'Book some slots today! 🎹',
  'Strike a chord today! 🎶',
  'Practice makes perfect! 👩‍🎤'
]

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
  const { handleMouseMove, handleTouchMove, ParticleLayer } = cursorParticles()

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
      <div
        className="min-h-screen bg-[#FDF6E3] flex items-center justify-center px-4 relative overflow-hidden"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
      >
        <ParticleLayer />
        <Blobs />
        <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10">
          <div className="bg-white rounded-2xl p-8 text-center border border-[#F0D9B5]">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-semibold text-[#09122C] mb-3">Account Pending</h1>
            <p className="text-sm text-[#09122C] opacity-60 mb-6">
              Your account is still waiting for admin approval. You can nudge the admin to remind them!
            </p>
            {bumped ? (
              <p className="text-sm text-green-500 mb-4">Admin has been notified! ✅</p>
            ) : (
              <button
                onClick={() => {
                  fetch(`${API_URL}/api/auth/bump-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  }).then(() => setBumped(true))
                }}
                className="w-full bg-[#F5C8C0] text-[#09122C] font-medium py-3 rounded-full text-sm mb-3"
              >
                Nudge Admin 👋
              </button>
            )}
            <button
              onClick={() => setIsPending(false)}
              className="w-full bg-[#F5C842] text-[#09122C] font-medium py-3 rounded-full text-sm"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#FDF6E3] flex items-center justify-center px-4 relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      <ParticleLayer />
      <Blobs />

      <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10">

        {/* header */}
        <div className="bg-white rounded-2xl p-8 text-center mb-6 border border-[#F0D9B5]">
          <h1 className="text-3xl font-medium text-[#09122C] mb-3">Jukebox</h1>
          <img src={Mascot} alt="JukeBox mascot" className="w-64 mx-auto mb-3" />
          <p className="text-sm text-[#09122C] opacity-60 min-h-[20px]">
            {typed}<span className="animate-pulse">|</span>
          </p>
        </div>

        {/* form */}
        <div
          className="bg-white rounded-2xl p-6 border border-[#F0D9B5]"
          style={shakeStyle}
        >
          <form onSubmit={handleSubmit}>

            {/* NUS email */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#09122C] mb-1">NUS Email</label>
              <div className="flex w-full">
                <input
                  type="text"
                  placeholder="e1234567"
                  value={emailPrefix}
                  onChange={handleEmailChange}
                  className="w-1/2 flex-1 min-w-0 px-3 py-2.5 text-sm border border-[#F0D9B5] rounded-l-xl bg-[#FDF6E3] text-[#09122C] outline-none focus:border-[#F5C842] focus:ring-2 focus:ring-[#F5C842] focus:ring-opacity-30"
                />
                <span className="w-28 sm:w-32 flex items-center justify-center text-xs sm:text-sm bg-[#F0D9B5] border border-[#F0D9B5] rounded-r-xl text-[#09122C] opacity-70 shrink-0 text-center px-1">
                  @u.nus.edu
                </span>
              </div>
            </div>

            {/* password */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-[#09122C] mb-1">Password</label>
              <div className="flex w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-1/2 flex-1 min-w-0 px-3 py-2.5 text-sm border border-[#F0D9B5] rounded-l-xl bg-[#FDF6E3] text-[#09122C] outline-none focus:border-[#F5C842] focus:ring-2 focus:ring-[#F5C842] focus:ring-opacity-30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-28 sm:w-32 flex items-center justify-center bg-[#F0D9B5] border border-[#F0D9B5] rounded-r-xl text-[#09122C] opacity-70 shrink-0"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F5C842] text-[#09122C] font-medium py-3 rounded-full text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#09122C] border-t-transparent rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#09122C] opacity-50 mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-[#E8A89E] underline">Sign up here.</Link>
          </p>
        </div>

      </div>
    </div>
  )
}

export default Login