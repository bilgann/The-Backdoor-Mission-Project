import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SideBar from './SideBar'

interface LayoutProps {
    children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
    const location = useLocation()

    // Build breadcrumb segments from the current location path and their paths.
    // Example: "/get-clients" -> [{name: 'Home', path: '/'}, {name: 'Get Clients', path: '/get-clients'}]
    const parts = location.pathname.split('/').filter(p => p.length > 0)
    const breadcrumbs: { name: string; path: string }[] = [{ name: 'Home', path: '/' }]
    parts.forEach((p, idx) => {
        const pretty = p
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        const path = '/' + parts.slice(0, idx + 1).join('/')
        breadcrumbs.push({ name: pretty, path })
    })

    return (
        <div className="main-layout">
            <SideBar />
            <main className="main-content">
                <div className="main-content-container">
                    <div className="top-bar">
                        <div className="breadcrumb">
                            <svg className="breadcrumb-home-icon" width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 6L6 1L11 6" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2.5 6V10.5C2.5 10.7761 2.72386 11 3 11H9C9.27614 11 9.5 10.7761 9.5 10.5V6" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {/* First breadcrumb (Home) is shown as text after the home icon and is clickable. */}
                            <svg className="breadcrumb-separator-icon" xmlns="http://www.w3.org/2000/svg" width="6" height="9" viewBox="0 0 6 9" fill="none">
                                <path d="M0.353546 0.353554L4.35355 4.35355L0.353546 8.35355" stroke="#5A5A5A"/>
                            </svg>
                            <Link to={breadcrumbs[0].path} className="breadcrumb-link">{breadcrumbs[0].name}</Link>
                            {breadcrumbs.slice(1).map((crumb, idx) => {
                                const isLast = idx === breadcrumbs.slice(1).length - 1
                                return (
                                    <span key={idx} className="breadcrumb-segment">
                                        <svg className="breadcrumb-separator-icon" xmlns="http://www.w3.org/2000/svg" width="6" height="9" viewBox="0 0 6 9" fill="none">
                                            <path d="M0.353546 0.353554L4.35355 4.35355L0.353546 8.35355" stroke="#5A5A5A"/>
                                        </svg>
                                        {isLast ? (
                                            <span>{crumb.name}</span>
                                        ) : (
                                            <Link to={crumb.path} className="breadcrumb-link">{crumb.name}</Link>
                                        )}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                    <div className="main-content-inner">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Layout