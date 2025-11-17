import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Clients from './pages/Clients'
import Analytics from './pages/Analytics'
import CoatCheck from './pages/CoatCheck'
import Sanctuary from './pages/Sanctuary'
import Washroom from './pages/Washroom'
import Clinic from './pages/Clinic'
import SafeSleep from './pages/SafeSleep'
import Activity from './pages/Activity'
import GetClients from './pages/GetClients'
import VisitorData from './pages/VisitorData'

// Helper function to check if session has expired (1 hour = 3600000 ms)
const isSessionValid = (): boolean => {
  const loginTime = localStorage.getItem('loginTime')
  if (!loginTime) return false
  
  const currentTime = Date.now()
  const sessionDuration = 60 * 60 * 1000 // 1 hour in milliseconds
  const timeElapsed = currentTime - parseInt(loginTime, 10)
  
  return timeElapsed < sessionDuration
}

// Helper function to clear authentication
const clearAuthentication = () => {
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('loginTime')
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true' && isSessionValid()
  
  // If session expired, clear auth and redirect
  if (localStorage.getItem('isAuthenticated') === 'true' && !isSessionValid()) {
    clearAuthentication()
    return <Navigate to="/login" replace />
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = () => {
      if (localStorage.getItem('isAuthenticated') === 'true') {
        if (isSessionValid()) {
          setIsAuthenticated(true)
        } else {
          // Session expired, clear auth
          clearAuthentication()
          setIsAuthenticated(false)
        }
      } else {
        setIsAuthenticated(false)
      }
      setLoading(false)
    }

    checkAuth()

    // Set up interval to check session validity every minute
    const interval = setInterval(() => {
      if (localStorage.getItem('isAuthenticated') === 'true') {
        if (!isSessionValid()) {
          // Session expired, log out
          clearAuthentication()
          setIsAuthenticated(false)
          // Force navigation to login
          window.location.href = '/login'
        }
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/coat-check" element={<CoatCheck />} />
                  <Route path="/sanctuary" element={<Sanctuary />} />
                  <Route path="/washroom" element={<Washroom />} />
                  <Route path="/clinic" element={<Clinic />} />
                  <Route path="/safe-sleep" element={<SafeSleep />} />
                  <Route path="/activity" element={<Activity />} />
                  <Route path="/get-clients" element={<GetClients />} />
                  <Route path="/visitor-data" element={<VisitorData />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  )
}

export default App