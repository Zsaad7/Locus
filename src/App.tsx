import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import ProductionPage from './pages/responsable/production/production'
import PertePage from './pages/responsable/perte/perte'
import ProfileCreation from './pages/responsable/creation/profile'

const AppInner: React.FC = () => {
  const { session, loading, signOut } = useAuth()
  const [tab, setTab] = useState<'dashboard'|'tasks'|'production'|'perte'|'profile'>('dashboard')

  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        Chargement...
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <div className="app-container">
      <header className="topbar">
        <div className="wordmark">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="10" r="3" fill="#0F6E56"/><path d="M12 2v7" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div>Locus <div className="small">l'accès, ancré au lieu</div></div>
        </div>
        <nav style={{display:'flex',gap:8}}>
          {/* <button className={`btn-ghost ${tab==='dashboard'?'ring-2 ring-brand':''}`} onClick={() => setTab('dashboard')}>Tableau de bord</button> */}
          {/* <button className={`btn-ghost ${tab==='tasks'?'ring-2 ring-brand':''}`} onClick={() => setTab('tasks')}>Tâches</button> */}
          <button className="btn-ghost" onClick={signOut}>Déconnexion</button>
          <button className="btn-ghost" onClick={() => setTab('production')}>Production</button>
          <button className="btn-ghost" onClick={() => setTab('perte')}>Pertes</button>
          <button className="btn-ghost" onClick={() => setTab('profile')}>Créer profil</button>
          <div className="action-icons">
                <button type="button" className="icon-btn" aria-label="Messages">✉</button>
                <button type="button" className="icon-btn" aria-label="Profil">P</button>
          </div>

        </nav>
      </header>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'tasks' && <Tasks />}
      {tab === 'production' && <ProductionPage />}
      {tab === 'perte' && <PertePage />}
      {tab === 'profile' && <ProfileCreation />}
    </div>
  )
}

const App: React.FC = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
)

export default App
