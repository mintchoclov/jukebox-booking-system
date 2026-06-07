import { useState } from 'react'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import Blobs from '../components/Blobs'
import shake from '../hooks/shake'
import cursorParticles from '../hooks/cursorParticles'

function Signup() {
  const [username, setUsername] = useState('')
  const [emailPrefix, setEmailPrefix] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { shakeStyle, triggerShake } = shake()
  const { handleMouseMove, handleTouchMove, ParticleLayer } = cursorParticles()

  function handleEmailChange(e) {
    const prefix = e.target.value
    setEmailPrefix(prefix)
    setEmail(prefix + '@u.nus.edu')
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (!username || !emailPrefix || !password) {
      setError('Please fill in all fields')
      triggerShake()
      return
    }

    const emailRegex = /^e\d{7}@u\.nus\.edu$/
    if (!emailRegex.test(email)) {
      setError('Invalid NUS email format. Please use e1234567@u.nus.edu')
      triggerShake()
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')

    fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role: 'individual' })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false)
        if (data.error) {
          setError(data.error)
          triggerShake()
        } else {
          setSubmitted(true)
        }
      })
      .catch(() => {
        setLoading(false)
        setError('Something went wrong. Please try again.')
        triggerShake()
      })
  }

  if (submitted) {
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
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-semibold text-[#09122C] mb-3">Account Created!</h1>
            <p className="text-sm text-[#09122C] opacity-60 mb-6">
              Your account is pending admin approval. You will be notified once your account has been activated!
            </p>
            <button
              onClick={() => window.location.href = '/login'}
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
        <div className="bg-white rounded-2xl p-6 text-center mb-6 border border-[#F0D9B5]">
          <h1 className="text-3xl font-semibold text-[#09122C] mb-3">Create Account</h1>
          <img src={Mascot} alt="JukeBox mascot" className="w-64 mx-auto mb-3" />
          <p className="text-sm text-[#09122C] opacity-50">Join Jukebox today!</p>
        </div>

        {/* form */}
        <div
          className="bg-white rounded-2xl p-6 border border-[#F0D9B5]"
          style={shakeStyle}
        >
          {/* progress */}
          <div className="flex justify-center gap-2 mb-5">
            <div className="h-1 w-8 rounded-full bg-[#F5C842]" />
            <div className="h-1 w-8 rounded-full bg-[#F5C842]" />
            <div className="h-1 w-8 rounded-full bg-[#F0D9B5]" />
          </div>

          <form onSubmit={handleSubmit}>

            {/* username */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#09122C] mb-1">Username</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-[#F0D9B5] rounded-xl bg-[#FDF6E3] text-[#09122C] outline-none focus:border-[#F5C842] focus:ring-2 focus:ring-[#F5C842] focus:ring-opacity-30"
              />
            </div>

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
                  placeholder="Min. 6 characters"
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
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#09122C] opacity-50 mt-4">
            Already have an account?{' '}
            <a href="/login" className="font-bold text-[#E8A89E] underline">Log in here.</a>
          </p>
        </div>

      </div>
    </div>
  )
}

export default Signup