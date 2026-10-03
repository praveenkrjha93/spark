import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTheme } from '../lib/theme'
import { useAuth } from '../auth/AuthContext'

function Icon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

const NAV = [
  { to: '/home', label: 'Home', end: true, icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10' },
  { to: '/claims', label: 'Claims', end: false, icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h6' },
  { to: '/analytics', label: 'Analytics', end: false, icon: 'M3 3v18h18M18 17V9M13 17V5M8 17v-4' },
  { to: '/policies', label: 'Terms & Conditions', end: false, icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6' },
]

const SUN = 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4l1.4-1.4M17 7l1.4-1.4'
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'

function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <button className="icon-btn" onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`} aria-label={`Switch to ${next} mode`}>
      {theme === 'light' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d={SUN} /></svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={MOON} /></svg>
      )}
    </button>
  )
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function ProfileMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) return null
  const ini = initials(user.name)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="profile-chip" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        {user.picture ? (
          <img src={user.picture} alt={user.name} referrerPolicy="no-referrer"
               style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span className="avatar">{ini}</span>
        )}
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
          <span className="t-muted" style={{ fontSize: 11 }}>{user.role ?? user.email}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="panel" role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 256, padding: 8, zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
            {user.picture ? (
              <img src={user.picture} alt={user.name} referrerPolicy="no-referrer"
                   style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span className="avatar avatar-lg">{ini}</span>
            )}
            <div style={{ lineHeight: 1.3, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div className="t-muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              {user.role && (
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.role}
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); navigate('/profile') }}>
            <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /> My Profile
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          <button className="menu-item danger" role="menuitem" onClick={() => { setOpen(false); signOut() }}>
            <Icon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}


function Header() {
  return (
    <header className="app-header">
      <Link to="/home" className="brand-link" title="SPARK — Smart Platform for Automotive Repair Knowledge">
        <div style={{
          width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff',
          background: 'linear-gradient(140deg, #3987e5, #199e70)',
          boxShadow: '0 8px 24px -8px rgba(57,135,229,0.8)',
        }}>
          <Icon path="M13 2L4.5 13H11l-1 9 8.5-11H12z" />
        </div>
        <div>
          <div className="spark-logo">SPARK</div>
          <div className="t-muted" style={{ fontSize: 10.5, letterSpacing: '.06em' }}></div>
        </div>
      </Link>

      <div style={{ flex: 1 }} />

      <ThemeToggle />
      <ProfileMenu />
    </header>
  )
}

function Footer() {
  return (
    <footer className="app-footer">
      <span>© {new Date().getFullYear()} SPARK — Smart Platform for Automotive Repair Knowledge</span>
      <span>v1.0</span>
    </footer>
  )
}

export function Layout({ children, queueCount }: { children: ReactNode; queueCount?: number }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 240, flex: 'none', padding: '20px 16px',
            borderRight: '1px solid var(--border)',
            position: 'sticky', top: 62, height: 'calc(100vh - 62px)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon path={n.icon} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.to === '/claims' && queueCount ? (
                  <span className="badge badge-warning" style={{ padding: '1px 8px', fontSize: 11 }}>
                    {queueCount}
                  </span>
                ) : null}
              </NavLink>
            ))}
            {isSuperAdmin && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                <NavLink to="/admin" end={false}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  style={{ color: 'var(--accent)' }}>
                  <Icon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                  <span style={{ flex: 1 }}>User Management</span>
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: '28px 34px 48px' }}>{children}</main>
      </div>

      <Footer />
    </div>
  )
}
