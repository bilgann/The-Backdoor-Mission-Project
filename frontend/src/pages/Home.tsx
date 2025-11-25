/**
 * Home Page Component
 * 
 * This is the main dashboard page that displays:
 * - Page title
 * - Total Clients chart component (20px below title)
 * - Button to navigate to Get Clients page
 */

import { Link } from 'react-router-dom'
import TotalServicesUsed from '../components/TotalServicesUsed'
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
                                        {/* Left column: TotalClients + Clients button */}
                                        <div className="clients-column">
                                                <TotalServicesUsed />
                                                <div className="button-row">
                                                    <ActionButton
                                                        to="/clients"
                                                        label="clients"
                                                        className="get-clients-button"
                                                        icon={(
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                                <path d="M0.5 11.5L11.5 0.5M11.5 0.5H0.5M11.5 0.5V11.5" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                        )}
                                                    />
                                                </div>
                                        </div>

                                        {/* Right column: TotalVisitors + visitor-data button */}
                                        <div className="visitors-column">
                                            <TotalVisitors />
                                        </div>
                                </div>

                                {/* removed standalone clients button; now placed next to the visitor-data button */}
            </div>
        </div>
    )
}

export default Home
