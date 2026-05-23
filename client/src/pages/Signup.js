import { useState } from 'react'
import API_URL from '../config'

function Signup() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // tracks whether signup was successful
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()

    // check all fields are filled
    if (!username || !email || !password) {
      setError('Please fill in all fields')
      return
    }

    // validate NUS email format: e1234567@u.nus.edu
    const emailRegex = /^e\d{7}@u\.nus\.edu$/
    if (!emailRegex.test(email)) {
      setError('Invalid NUS email format. Please use the format e1234567@u.nus.edu')
      return
    }

    // enforce minimum password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    // submit registration to backend
    // new accounts default to 'individual' role
    // admin must approve before user can log in
    fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role: 'individual' })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setSubmitted(true)
        }
      })
      .catch(() => setError('Something went wrong. Please try again.'))
  }

  // show pending approval message after successful signup
  if (submitted) {
    return (
      <div>
        <h1>Account Created!</h1>
        <p>Your account is pending admin approval. You will be notified once your account has been activated.</p>
        <a href="/login">Back to Login</a>
      </div>
    )
  }

  return (
    <div>
      <h1>JukeBox Sign Up</h1>
      <form onSubmit={handleSubmit}>

        {/* username field */}
        <div>
          <label>Username</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        {/* NUS email field */}
        <div>
          <label>NUS Email</label>
          <input
            type="email"
            placeholder="e1234567@u.nus.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* password field */}
        <div>
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit">Sign Up</button>
      </form>
      <p>Already have an account? <a href="/login">Log in</a></p>
    </div>
  )
}

export default Signup