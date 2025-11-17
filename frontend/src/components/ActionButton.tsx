import React from 'react'
import { Link } from 'react-router-dom'

// Reusable action button used across the app.
// - If `to` is provided it renders as a `Link` (react-router) so navigation is client-side.
// - Otherwise it renders as a regular `<button>` and accepts an onClick handler.
// - `className` allows reusing existing styles such as `get-clients-button`.
// Example usage:
// <ActionButton to="/get-clients" label="get clients" className="get-clients-button" icon={<svg>...</svg>} />

interface ActionButtonProps {
  to?: string
  onClick?: () => void
  label?: string
  className?: string
  icon?: React.ReactNode
  children?: React.ReactNode
}

const ActionButton: React.FC<ActionButtonProps> = ({ to, onClick, label, className = '', icon, children }) => {
  // If `to` is present, render a Link so the app navigates without a full page reload.
  if (to) {
    return (
      <Link to={to} className={className}>
        <span>{children || label}</span>
        {icon}
      </Link>
    )
  }

  // Otherwise render a semantic button element.
  return (
    <button type="button" className={className} onClick={onClick}>
      <span>{children || label}</span>
      {icon}
    </button>
  )
}

export default ActionButton
