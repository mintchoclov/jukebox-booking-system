import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()

    // check all fields are filled
    if (!email || !password) {
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

        <button type="submit">Log In</button>
      </form>
      <p>Don't have an account? <a href="/signup">Sign up</a></p>
    </div>
  )
}

export default Login