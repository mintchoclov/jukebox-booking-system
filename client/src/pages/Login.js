import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'

function Login() {
  const [emailPrefix, setEmailPrefix] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // update both the prefix and full email when user types
  function handleEmailChange(e) {
    const prefix = e.target.value
    setEmailPrefix(prefix)
    setEmail(prefix + '@u.nus.edu')
  }

  function handleSubmit(e) {
    e.preventDefault()

    // check all fields are filled
    if (!emailPrefix || !password) {
      setError('Please fill in all fields')
      return
    }

    // submit login credentials to backend
    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          // show error message if login fails
          setError(data.error)
        } else {
          // save user data to localStorage and redirect to dashboard
          localStorage.setItem('user', JSON.stringify(data))
          navigate('/dashboard')
        }
      })
      .catch(() => setError('Something went wrong. Please try again.'))
  }

  return (
    <div>
      <h1>JukeBox Login</h1>
      <form onSubmit={handleSubmit}>

        {/* NUS email field with autocomplete */}
        <div>
          <label>NUS Email</label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="e1234567"
              value={emailPrefix}
              onChange={handleEmailChange}
            />
            <span>@u.nus.edu</span>
          </div>
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

        <button type="submit">Log In</button>
      </form>
      <p>Don't have an account? <a href="/signup">Sign up</a></p>
    </div>
  )
}

export default Login