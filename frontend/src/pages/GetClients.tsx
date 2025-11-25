/**
 * GetClients Page
 * 
 * This page displays detailed client statistics.
 * It uses the TotalClients component to show client data
 * with time range selection and service breakdown.
 */

import TotalServicesUsed from '../components/TotalServicesUsed'
import '../styles/GetClients.css'

const GetClients = () => {
    return (
        <div className="get-clients-page">
            <h1 className="page-title">Get Clients</h1>
            <div className="get-clients-content">
                <TotalServicesUsed />
            </div>
        </div>
    )
}

export default GetClients

