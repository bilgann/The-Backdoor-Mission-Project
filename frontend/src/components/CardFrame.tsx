import React from 'react'
import '../styles/CardFrame.css'

interface CardFrameProps {
  children: React.ReactNode
  className?: string
}

const CardFrame = ({ children, className = '' }: CardFrameProps) => {
  return (
    <div className={`card-frame ${className}`}>
      {children}
    </div>
  )
}

export default CardFrame
