import { useState, useEffect } from 'react'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import shake from '../hooks/shake'
import { Card, Button, Spinner, Label, ErrorText } from '../components/UI'

function Signup() {
  const [step, setStep] = useState('form')
  const [username, setUsername] = useState('')
  const [emailPrefix, setEmailPrefix] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  const { shakeStyle, triggerShake } = shake()

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  function handleEmailChange(e) {
    const prefix = e.target.value
    setEmailPrefix(prefix)
    setEmail(prefix + '@u.nus.edu')
  }

  function handleSendCode(e) {
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

    fetch(`${API_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false)
        if (data.error) {
          setError(data.error)
          triggerShake()
        } else {
          setStep('otp')
          setResendIn(60)
        }
      })
      .catch(() => {
        setLoading(false)
        setError('Something went wrong. Please try again.')
        triggerShake()
      })
  }
  function handleVerify(e) {
    e.preventDefault()

    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit code')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')

    fetch(`${API_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: otp.trim(), username, password })
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
  function handleResend() {
    if (resendIn > 0) return
    setError('')
    fetch(`${API_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          triggerShake()
        } else {
          setResendIn(60)
        }
      })
      .catch(() => {
        setError('Something went wrong. Please try again.')
        triggerShake()
      })
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 relative"
      >
        <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10">
          <Card className="p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-semibold text-[#09122C] mb-3">Account Created!</h1>
            <p className="text-sm text-[#09122C] opacity-60 mb-6">
              Your account is pending admin approval. You will be notified once your account has been activated!
            </p>
            <Button variant = "primary" className= "w-full" 
              onClick={() => window.location.href = '/login'}
            >
              Back to Login
            </Button>
          </Card>
        </div>
      </div>
    )
  }
  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative">
        <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10">

          <Card className="p-6 text-center mb-6">
            <h1 className="text-3xl font-semibold text-navy mb-3">Check Your Email</h1>
            <img src={Mascot} alt="JukeBox mascot" className="w-64 mx-auto mb-3" />
            <p className="text-sm text-navy opacity-50">
              We sent a 6-digit code to <span className="font-bold">{email}</span>
            </p>
          </Card>

          <Card className="p-6" style={shakeStyle}>
            {/* progress: step 2 of 3 */}
            <div className="flex justify-center gap-2 mb-5">
              <div className="h-1 w-8 rounded-full bg-[#F5C842]" />
              <div className="h-1 w-8 rounded-full bg-[#F0D9B5]" />
              <div className="h-1 w-8 rounded-full bg-[#F0D9B5]" />
            </div>

            <form onSubmit={handleVerify}>
              <div className="mb-5">
                <Label>Verification Code</Label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 text-center text-2xl tracking-[0.5em] border border-[#F0D9B5] rounded-xl bg-[#FDF6E3] text-[#09122C] outline-none focus:border-[#F5C842] focus:ring-2 focus:ring-[#F5C842] focus:ring-opacity-30"
                />
              </div>

              <ErrorText>{error}</ErrorText>

              <Button
                type="submit" variant="primary"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2"
              >
                {loading ? (<><Spinner />Verifying...</>) : 'Verify & Create Account'}
              </Button>
            </form>

            <p className="text-center text-xs text-navy opacity-50 mt-4">
              Didn't get it?{' '}
              {resendIn > 0 ? (
                <span>Resend in {resendIn}s</span>
              ) : (
                <button onClick={handleResend} className="font-bold text-pinkDark underline">
                  Resend code
                </button>
              )}
            </p>
            <p className="text-center text-xs text-navy opacity-50 mt-2">
              Wrong email?{' '}
              <button
                onClick={() => { setStep('form'); setOtp(''); setError('') }}
                className="font-bold text-pinkDark underline"
              >
                Go back
              </button>
            </p>
          </Card>

        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
    >
      <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10">

        {/* header */}
        <Card className="p-6 text-center mb-6">
          <h1 className="text-3xl font-semibold text-navy mb-3">Create Account</h1>
          <img src={Mascot} alt="JukeBox mascot" className="w-64 mx-auto mb-3" />
          <p className="text-sm text-navy opacity-50">Join Jukebox today!</p>
        </Card>

        {/* form */}
        <Card
          className="p-6"
          style={shakeStyle}
        >
          {/* progress */}
          <div className="flex justify-center gap-2 mb-5">
            <div className="h-1 w-8 rounded-full bg-[#F5C842]" />
            <div className="h-1 w-8 rounded-full bg-[#F5C842]" />
            <div className="h-1 w-8 rounded-full bg-[#F0D9B5]" />
          </div>

          <form onSubmit={handleSendCode}>

            {/* username */}
            <div className="mb-4">
              <Label>Username</Label>
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
              <Label>NUS Email</Label>
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
              <Label>Password</Label>
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

            <ErrorText>{error}</ErrorText>

            <Button
              type="submit" variant ="primary"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner />
                  Sending Code...
                </>
              ) : (
                'Send Code'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-navy opacity-50 mt-4">
            Already have an account?{' '}
            <a href="/login" className="font-bold text-pinkDark underline">Log in here.</a>
          </p>
        </Card>

      </div>
    </div>
  )
}

export default Signup