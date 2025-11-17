import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Login.css'
import config from '../config'

const Login = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch(`${config.API_BASE}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: email, password }),
            })

            let data
            try {
                data = await response.json()
            } catch (parseError) {
                setError('Server returned an invalid response. Please check if the backend is running.')
                setLoading(false)
                return
            }

            if (response.ok && data.success) {
                // Store authentication token or session
                const loginTime = Date.now()
                localStorage.setItem('isAuthenticated', 'true')
                localStorage.setItem('loginTime', loginTime.toString())
                navigate('/')
            } else {
                setError(data.message || 'Invalid credentials')
            }
        } catch (err) {
            console.error('Login error:', err)
            if (err instanceof TypeError && err.message.includes('fetch')) {
                setError(`Cannot connect to server. Please make sure the backend is running on ${config.API_BASE}`)
            } else {
                setError('An error occurred. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container">
                <h1 className="login-title">Log In</h1>
                <div className="login-form-container">
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="text"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Value"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Value"
                                required
                            />
                        </div>
                        {error && <div className="error-message">{error}</div>}
                        <button type="submit" className="sign-in-button" disabled={loading}>
                            {loading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </form>
                </div>
                <div className="login-footer">
                    <div className="footer-logo"></div>
                    <span className="footer-text">The Backdoor Mission</span>
                </div>
            </div>
        </div>
    )
}

export default Login

