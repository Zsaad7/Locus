import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type NavLinkItem = {
  label: string
  to: string
  roles: Array<'responsable' | 'salarie'>
}

const navLinks: NavLinkItem[] = [
  { label: 'Tableau de bord', to: '/dashboard', roles: ['responsable'] },
  { label: 'Tâches', to: '/responsable/taches', roles: ['responsable'] },
  { label: 'Production', to: '/responsable/production', roles: ['responsable'] },
  { label: 'Pertes', to: '/responsable/perte', roles: ['responsable'] },
  { label: 'Créer profil', to: '/responsable/creation/profile', roles: ['responsable'] },
]

const Navbar: React.FC = () => {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const role = profile?.role ?? 'salarie'
  const displayLinks = navLinks.filter((link) => link.roles.includes(role))
  const location = useLocation()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="topbar navbar">
      <div className="navbar-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="10" r="3" fill="#0F6E56"/><path d="M12 2v7" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <div>
          <div className="navbar-title">Locus</div>
          <div className="navbar-subtitle">l'accès, ancré au lieu</div>
        </div>
      </div>

      {displayLinks.length > 0 && (
        <nav className="navbar-links">
          {displayLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`navbar-link ${location.pathname === link.to ? 'navbar-link-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="navbar-actions">
        <button type="button" className="icon-btn" aria-label="Messages">✉</button>
        <div className="profile-menu" ref={menuRef}>
          <button type="button" className="avatar-btn" onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'P'}
          </button>
          <div className={`profile-dropdown ${open ? 'open' : ''}`}>
            <div className="profile-card">
              <div className="profile-card-title">Profil connecté</div>
              <div className="profile-info-row"><span>Nom</span><strong>{profile?.full_name ?? 'Utilisateur'}</strong></div>
              <div className="profile-info-row"><span>Rôle</span><strong>{profile?.role ?? 'salarie'}</strong></div>
            </div>
            <div className="profile-links">
              <Link to="/dashboard" className="profile-link" onClick={() => setOpen(false)}>Tableau de bord</Link>
              {role === 'responsable' && (
                <Link to="/taches" className="profile-link" onClick={() => setOpen(false)}>Tâches</Link>              )}
              {role === 'responsable' && (
                <Link to="/responsable/creation/profile" className="profile-link" onClick={() => setOpen(false)}>Créer profil</Link>
              )}
              {role === 'responsable' && (
                <Link to="/responsable/production" className="profile-link" onClick={() => setOpen(false)}>Production</Link>
              )}
                {role === 'responsable' && (
                <Link to="/responsable/perte" className="profile-link" onClick={() => setOpen(false)}>Pertes</Link>
              )}

            </div>
            <button type="button" className="btn-ghost profile-logout" onClick={signOut}>Déconnexion</button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
