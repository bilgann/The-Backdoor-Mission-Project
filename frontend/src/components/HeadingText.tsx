import React from 'react'

// HeadingText: reusable heading typography component.
// Name chosen: `HeadingText` — use this for page section headings that
// follow the Satoshi Variable 20px / 400 weight style described in Figma.
// Usage: <HeadingText>Search Client</HeadingText>
const HeadingText: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`heading-text ${className}`}>
      {children}
    </div>
  )
}

export default HeadingText
