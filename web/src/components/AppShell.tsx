import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

type AppShellProps = {
  children: ReactNode
  title?: string
  subtitle?: string
  badge?: string
}

export function AppShell({ children, title, subtitle, badge }: AppShellProps) {
  const { pathname } = useLocation()

  return (
    <div className="app-shell">
      <div className="app-bg" aria-hidden />
      <header className="app-nav">
        <Link to="/" className="brand">
          <span className="brand-mark" />
          <span className="brand-text">Photo Booth</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <Link
            to="/capture"
            className={`nav-link ${pathname === '/capture' ? 'active' : ''}`}
          >
            Capture
          </Link>
          <Link
            to="/station"
            className={`nav-link ${pathname === '/station' ? 'active' : ''}`}
          >
            Print station
          </Link>
        </nav>
      </header>

      {(title || subtitle) && (
        <div className="page-hero">
          {badge && <span className="badge">{badge}</span>}
          {title && <h1 className="page-title">{title}</h1>}
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      )}

      <main className="app-main">{children}</main>
    </div>
  )
}
