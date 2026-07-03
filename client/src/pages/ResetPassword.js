import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import API_URL from '../config'
import shake from '../hooks/shake'
import { Card, Button, Spinner, Label, ErrorText } from '../components/UI'

const inputClass = `
  w-1/2 flex-1 min-w-0 px-3 py-2.5 text-sm border border-[#F0D9B5] rounded-l-xl
  bg-[#FDF6E3] text-[#09122C] outline-none focus:border-[#F5C842] focus:ring-2
  focus:ring-[#F5C842] focus:ring-opacity-30
`
const suffixClass = `
  w-28 sm:w-32 flex items-center justify-center text-xs sm:text-sm
  bg-[#F0D9B5] border border-[#F0D9B5] rounded-r-xl text-[#09122C] opacity-70 shrink-0 text-center px-1
`

function ResetPassword() {
    const [step, setStep] = useState(1)
    const [emailPrefix, setEmailPrefix] = useState('')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [resendIn, setResendIn] = useState(0)
    const navigate = useNavigate()
    const { shakeStyle, triggerShake } = shake()

    useEffect(() => {
        if (resendIn <= 0) return
        const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
        return () => clearTimeout(t)
    }, [resendIn])

    function handleEmailChange(e) {
        const prefix = e.target.value
        setEmailPrefix(prefix)
        setEmail(prefix + '@u.nus.edu')
    }

    function handleRequestOtp(e) {
        e.preventDefault()
        if (!emailPrefix) {
            setError('Please enter your NUS email')
            triggerShake()
            return
        }
        setLoading(true)
        setError('')
        fetch(`${API_URL}/api/auth/request-reset-otp`, {
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
                    setStep(2)
                    setResendIn(60)
                }
            })
            .catch(() => {
                setLoading(false)
                setError('Something went wrong. Please try again.')
                triggerShake()
            })
    }

    function handleVerifyOtp(e) {
        e.preventDefault()
        if (otp.trim().length !== 6) {
            setError('Please enter the 6-digit code')
            triggerShake()
            return
        }
        setError('')
        setStep(3)
    }

    function handleResend() {
        if (resendIn > 0) return
        setError('')
        fetch(`${API_URL}/api/auth/request-reset-otp`, {
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

    function handleResetPassword(e) {
        e.preventDefault()
        if (!newPassword || !confirmPassword) {
            setError('Please fill in all fields')
            triggerShake()
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match')
            triggerShake()
            return
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters')
            triggerShake()
            return
        }
        setLoading(true)
        setError('')
        fetch(`${API_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword })
        })
            .then(res => res.json())
            .then(data => {
                setLoading(false)
                if (data.error) {
                    setError(data.error)
                    triggerShake()
                    if (data.error.toLowerCase().includes('incorrect') || data.error.toLowerCase().includes('expired')) {
                        setStep(2)
                    }
                } else {
                    setStep(4)
                }
            })
            .catch(() => {
                setLoading(false)
                setError('Something went wrong. Please try again.')
                triggerShake()
            })
    }

    if (step === 4) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="w-full max-w-sm md:max-w-md lg:max-w-lg">
                    <Card className="p-8 text-center">
                        <div className="text-5xl mb-4">✅</div>
                        <h1 className="text-2xl font-semibold text-[#09122C] mb-3">Password Reset!</h1>
                        <p className="text-sm text-[#09122C] opacity-60 mb-6">
                            Your password has been updated. You can now log in with your new password.
                        </p>
                        <Button variant="primary" className="w-full" onClick={() => navigate('/login')}>
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
                <Card className="p-6 text-center mb-6">
                    <h1 className="text-3xl font-semibold text-navy mb-3">
                        {step === 1 && 'Reset Password'}
                        {step === 2 && 'Check Your Email'}
                        {step === 3 && 'New Password'}
                    </h1>
                    <p className="text-sm text-navy opacity-50">
                        {step === 1 && 'Enter your NUS email to receive a reset code.'}
                        {step === 2 && <>We sent a 6-digit code to <span className="font-bold">{email}</span></>}
                        {step === 3 && 'Almost there! Set your new password.'}
                    </p>
                </Card>

                {/* form */}
                <Card className="p-6" style={shakeStyle}>

                    {/* progress dots */}
                    <div className="flex justify-center gap-2 mb-5">
                        {[1, 2, 3].map(s => (
                            <div
                                key={s}
                                className={`h-1 w-8 rounded-full ${s <= step ? 'bg-[#F5C842]' : 'bg-[#F0D9B5]'}`}
                            />
                        ))}
                    </div>

                    {/* email */}
                    {step === 1 && (
                        <form onSubmit={handleRequestOtp}>
                            <div className="mb-5">
                                <Label>NUS Email</Label>
                                <div className="flex w-full">
                                    <input
                                        type="text"
                                        placeholder="e1234567"
                                        value={emailPrefix}
                                        onChange={handleEmailChange}
                                        className={inputClass}
                                    />
                                    <span className={suffixClass}>@u.nus.edu</span>
                                </div>
                            </div>
                            <ErrorText>{error}</ErrorText>
                            <Button type="submit" variant="primary" disabled={loading} className="w-full flex items-center justify-center gap-2">
                                {loading ? <><Spinner /> Sending...</> : 'Send Reset Code'}
                            </Button>
                            <p className="text-center text-xs text-navy opacity-50 mt-4">
                                Remember your password?{' '}
                                <Link to="/login" className="font-bold text-pinkDark underline">Log in.</Link>
                            </p>
                        </form>
                    )}

                    {/* OTP */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyOtp}>
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
                            <Button type="submit" variant="primary" className="w-full flex items-center justify-center gap-2 mb-3">
                                Verify Code
                            </Button>
                            <p className="text-center text-xs text-navy opacity-50 mt-2">
                                Didn't get it?{' '}
                                {resendIn > 0 ? (
                                    <span>Resend in {resendIn}s</span>
                                ) : (
                                    <button type="button" onClick={handleResend} className="font-bold text-pinkDark underline">
                                        Resend code
                                    </button>
                                )}
                            </p>
                            <p className="text-center text-xs text-navy opacity-50 mt-2">
                                Wrong email?{' '}
                                <button type="button" onClick={() => { setStep(1); setOtp(''); setError('') }} className="font-bold text-pinkDark underline">
                                    Go back
                                </button>
                            </p>
                        </form>
                    )}

                    {/* new password */}
                    {step === 3 && (
                        <form onSubmit={handleResetPassword}>
                            <div className="mb-4">
                                <Label>New Password</Label>
                                <div className="flex w-full">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Min. 6 characters"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className={inputClass}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={suffixClass}>
                                        {showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>
                            <div className="mb-5">
                                <Label>Confirm New Password</Label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm border border-[#F0D9B5] rounded-xl bg-[#FDF6E3] text-[#09122C] outline-none focus:border-[#F5C842] focus:ring-2 focus:ring-[#F5C842] focus:ring-opacity-30"
                                />
                            </div>
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-xs text-pinkDark mb-2">Passwords do not match</p>
                            )}
                            <ErrorText>{error}</ErrorText>
                            <Button type="submit" variant="primary" disabled={loading} className="w-full flex items-center justify-center gap-2">
                                {loading ? <><Spinner /> Resetting...</> : 'Reset Password'}
                            </Button>
                        </form>
                    )}

                </Card>
            </div>
        </div>
    )
}

export default ResetPassword