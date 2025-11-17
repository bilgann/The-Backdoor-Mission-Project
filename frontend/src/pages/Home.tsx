/**
 * Home Page Component
 * 
 * This is the main dashboard page that displays:
 * - Page title
 * - Total Clients chart component (20px below title)
 * - Button to navigate to Get Clients page
 */

import { Link } from 'react-router-dom'
import TotalClients from '../components/TotalClients'
import TotalVisitors from '../components/TotalVisitors'
import ActionButton from '../components/ActionButton'
import '../styles/Home.css'

const Home = () => {
    return (
        <div className="home-page">
            <h1 className="page-title">Home</h1>
            
            {/* Total Clients and Total Visitors side-by-side (8px gap) */}
            <div className="home-chart-section">
                                <div className="dashboard-widgets">
                                        <TotalClients />

                                        {/* Wrap the visitors card and its button in a column so the button appears
                                                directly under the TotalVisitors frame. */}
                                        <div className="visitors-column">
                                                <TotalVisitors />

                                                {/* 'See visitor data' button placed right under TotalVisitors. Uses the
                                                        same className as the existing Get Clients button so styles match. */}
                                                <ActionButton
                                                    to="/visitor-data"
                                                    label="see visitor data"
                                                    className="get-clients-button"
                                                    icon={(
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                            <path d="M0.5 11.5L11.5 0.5M11.5 0.5H0.5M11.5 0.5V11.5" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    )}
                                                />
                                        </div>
                                </div>

                                {/* Get Clients Button: reuse the same ActionButton component so the
                                        implementation is consistent and easy to update in one place. */}
                                <ActionButton
                                    to="/get-clients"
                                    label="get clients"
                                    className="get-clients-button"
                                    icon={(
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <path d="M0.5 11.5L11.5 0.5M11.5 0.5H0.5M11.5 0.5V11.5" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                />
            </div>
        </div>
    )
}

export default Home
