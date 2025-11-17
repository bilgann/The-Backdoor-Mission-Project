import { Link, useLocation, useNavigate } from 'react-router-dom'
import blockIcon from '../assets/icons/block.svg'

const Sidebar = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated')
        localStorage.removeItem('loginTime')
        navigate('/login')
    }

    const menuLinks = [
        { name: 'Home', path: '/', icon: 'home' },
        { name: 'Clients', path: '/clients', icon: 'clients' },
        { name: 'Analytics', path: '/analytics', icon: 'analytics' },
    ]

    const dataEntryLinks = [
        { name: 'Coat Check', path: '/coat-check', color: '#FF9898', iconColor: '#FE2323' },
        { name: 'Washroom', path: '/washroom', color: '#A4E5FF', iconColor: '#6ECAEE' },
        { name: 'Sanctuary', path: '/sanctuary', color: '#F1FFB8', iconColor: '#D9F373' },
        { name: 'Safe Sleep', path: '/safe-sleep', color: '#8B9AFF', iconColor: '#2C3B9C' },
        { name: 'Clinic', path: '/clinic', color: '#FFACCD', iconColor: '#FA488F' },
        { name: 'Activity', path: '/activity', color: '#FFD968', iconColor: '#F07D0B' },
    ]

    // Icon SVG components
    const HomeIcon = () => (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6L8 1L14 6V14C14 14.5304 13.7893 15.0391 13.4142 15.4142C13.0391 15.7893 12.5304 16 12 16H4C3.46957 16 2.96086 15.7893 2.58579 15.4142C2.21071 15.0391 2 14.5304 2 14V6Z" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 16V10H10V16" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )

    const ClientsIcon = () => (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.3333 14V12.6667C11.3333 11.9594 11.0524 11.2811 10.5523 10.781C10.0522 10.281 9.37391 10 8.66667 10H3.33333C2.62609 10 1.94781 10.281 1.44772 10.781C0.947619 11.2811 0.666667 11.9594 0.666667 12.6667V14" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 7.33333C7.47276 7.33333 8.66667 6.13943 8.66667 4.66667C8.66667 3.19391 7.47276 2 6 2C4.52724 2 3.33333 3.19391 3.33333 4.66667C3.33333 6.13943 4.52724 7.33333 6 7.33333Z" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15.3333 14V12.6667C15.3329 12.0758 15.1368 11.5019 14.7741 11.0264C14.4114 10.5509 13.9007 10.1971 13.32 10.0133" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.6667 2.01333C11.2487 2.19733 11.7607 2.55173 12.1244 3.02807C12.4881 3.50441 12.6848 4.07954 12.6848 4.67C12.6848 5.26046 12.4881 5.83559 12.1244 6.31193C11.7607 6.78827 11.2487 7.14267 10.6667 7.32667" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )

    const AnalyticsIcon = () => (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2V14H14" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.33333 10L7.33333 6L9.33333 8L13.3333 4" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.3333 4H13.3333V6" stroke="#454545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )

    const getIcon = (iconName: string) => {
        switch (iconName) {
            case 'home':
                return <HomeIcon />
            case 'clients':
                return <ClientsIcon />
            case 'analytics':
                return <AnalyticsIcon />
            default:
                return null
        }
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-content">
                {/* Logo and App Name */}
                <div className="sidebar-logo-container">
                    <div className="sidebar-logo"></div>
                    <h2 className="sidebar-app-name">The Backdoor Mission</h2>
                </div>

                {/* User Info */}
                <div className="user-info-card">
                    <img src={blockIcon} className="user-avatar-box" alt="User avatar" />
                    <div className="user-info-text">
                        <div className="user-name">Dan Laffin</div>
                        <div className="user-email">dlaffin@backdoormission.ca</div>
                    </div>
                </div>

                {/* Menu Section */}
                <nav className="sidebar-nav">
                    <p className="menu-title">Menu</p>
                    <div className="menu-links">
                        {menuLinks.map(link => (
                            <Link 
                                key={link.name} 
                                to={link.path}
                                className={`menu-link ${location.pathname === link.path ? 'active' : ''}`}
                            >
                                {getIcon(link.icon)}
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Data Entry Section */}
                    <p className="data-entry-title">Data Entry</p>
                    <div className="data-entry-links">
                        {dataEntryLinks.map(link => (
                            <Link 
                                key={link.name} 
                                to={link.path}
                                className="data-entry-link"
                                style={{ backgroundColor: link.color }}
                            >
                                <div className="data-entry-icon" style={{ backgroundColor: link.iconColor }}></div>
                                {link.name}
                            </Link>
                        ))}
                    </div>
                </nav>

                {/* Logout Button */}
                <button className="logout-button" onClick={handleLogout}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M13.3333 17.5V15.8333C13.3333 14.9493 12.9821 14.1014 12.357 13.4763C11.7319 12.8512 10.8841 12.5 10 12.5H4.16667C3.28261 12.5 2.43477 12.8512 1.80964 13.4763C1.18452 14.1014 0.833334 14.9493 0.833334 15.8333V17.5M19.1667 9.16667H14.1667M10.4167 5.83333C10.4167 7.67428 8.92428 9.16667 7.08333 9.16667C5.24238 9.16667 3.75 7.67428 3.75 5.83333C3.75 3.99238 5.24238 2.5 7.08333 2.5C8.92428 2.5 10.4167 3.99238 10.4167 5.83333Z" stroke="#FF7373" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Log out</span>
                </button>
            </div>
        </aside>
    )
}

export default Sidebar
