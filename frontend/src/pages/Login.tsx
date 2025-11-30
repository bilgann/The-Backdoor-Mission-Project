import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Login.css'
import BilganLogo from '../assets/icons/bilgan_logo.svg'
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
                    <div className="footer-brand">
                        <div className="footer-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 172 160" fill="none">
                              <path d="M172 85.7611C172.069 117.364 155.083 145.008 129.719 160C111.838 149.295 102.351 136.092 105.111 129.391C106.09 127.014 109.163 123.071 112.847 121.07C114.705 120.061 117.717 118.502 121.554 116.837C128.129 113.986 130.85 113.566 135.154 110.724C138.189 108.722 142.661 105.773 142.309 102.403C142.087 100.256 140 98.7735 138.143 97.4593C135.353 95.4727 133.273 95.2663 129.818 94.0132C127.815 93.2874 126.454 93.2492 123.335 91.2854C122.54 90.7812 120.706 88.7487 120.729 87.8165V87.8012C120.507 85.3867 124.398 82.2004 129.657 81.0696L142.126 77.9598C132.394 78.6245 122.693 79.9846 112.97 80.6493C101.954 82.1775 96.3047 83.5147 96.0677 86.0438C95.9684 87.1135 96.8322 88.2749 98.6669 89.528C99.416 90.04 100.234 90.4602 101.06 90.8423C102.688 91.5834 105.486 93.2339 106.701 96.3666V96.3896C107.167 97.5892 106.946 98.9722 106.059 99.9196C97.7954 108.798 56.8288 112.099 56.8288 112.099C49.8036 112.573 36.8692 114.491 24.0647 123.148C19.7303 126.074 16.2292 129.222 13.4542 132.149C4.93831 118.808 0 102.953 0 85.9598C0 38.082 39.1396 -0.641972 87.1849 0.00750265C133.915 0.634055 171.893 39.0524 172 85.7611Z" fill="#393939"/>
                            </svg>
                        </div>
                        <span className="footer-text">The Backdoor Mission</span>
                    </div>
                    <div className="footer-sub">
                        <img src={BilganLogo} alt="bilgan" className="bilgan-logo-img" />
                        <span className="copyright-text">Bilgan Kiris 2025. All rights reserved.</span>
                        <span className="copyright-symbol">©</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login

