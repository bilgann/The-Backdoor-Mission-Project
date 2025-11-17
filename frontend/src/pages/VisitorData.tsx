import React from 'react'
import TotalVisitors from '../components/TotalVisitors'
import '../styles/GetClients.css'

// VisitorData page: displays page title and the TotalVisitors frame with a
// time-range selector so users can view daily/weekly/monthly/yearly data.
const VisitorData: React.FC = () => {
  return (
    <div className="get-clients-page">
      <h1 className="page-title">See Visitor Data</h1>
      <div className="get-clients-content">
        {/* Show the TotalVisitors card with a time range selector enabled */}
        <TotalVisitors showRangeSelector />
      </div>
    </div>
  )
}

export default VisitorData
