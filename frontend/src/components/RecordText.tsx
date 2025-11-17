import React from 'react'

// RecordText: small reusable text style for table records.
// Use this component for row text so style stays consistent across the app.
const RecordText: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`record-text ${className}`}>
      {children}
    </div>
  )
}

export default RecordText
