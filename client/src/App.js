import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Bidding from './pages/Bidding'
import Booking from './pages/Booking'
import Admin from './pages/Admin'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path = "/" element = {<Login />} />
        <Route path = "/login" element = {<Login />} />
        <Route path = "/signup" element = {<Signup />} />
        <Route path = "/dashboard" element = {<Dashboard />} />
        <Route path = "/bidding" element = {<Bidding />} />
        <Route path = "/booking" element = {<Booking />} />
        <Route path = "/admin" element = {<Booking />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App