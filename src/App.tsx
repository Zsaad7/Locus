import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Link, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import ProductionPage from './pages/responsable/production/production'
import PertePage from './pages/responsable/perte/perte'
import ProfileCreation from './pages/responsable/creation/profile'
import ProtectedRoute from './components/ProtectedRoute'
import Unauthorized from './pages/Unauthorized'

const Layout: React.FC = () => {
  const { signOut } = useAuth()
  return (
    <div className="app-container">
      <header className="topbar">
        <div className="wordmark">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="10" r="3" fill="#0F6E56"/><path d="M12 2v7" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div>Locus <div className="small">l'accès, ancré au lieu</div></div>
        </div>
        <nav style={{display:'flex',gap:8}}>
          <Link to="/dashboard" className="btn-ghost">Tableau de bord</Link>
          <Link to="/tasks" className="btn-ghost">Tâches</Link>
          <Link to="/responsable/production" className="btn-ghost">Production</Link>
          <Link to="/responsable/perte" className="btn-ghost">Pertes</Link>
          <Link to="/responsable/creation/profile" className="btn-ghost">Créer profil</Link>
          <button className="btn-ghost" onClick={signOut}>Déconnexion</button>
          <div className="action-icons">
            <button type="button" className="icon-btn" aria-label="Messages">✉</button>
            <button type="button" className="icon-btn" aria-label="Profil">P</button>
          </div>
        </nav>
      </header>
      <main style={{padding:16}}>
        <Outlet />
      </main>
    </div>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/tasks', element: <Tasks /> },
          { path: '/profile', element: <ProfileCreation /> },
          { path: '/', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["salarie"]} />,
    children: [
      // salaried-only routes go here
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["responsable"]} />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/responsable/production', element: <ProductionPage /> },
          { path: '/responsable/perte', element: <PertePage /> },
          { path: '/responsable/creation/profile', element: <ProfileCreation /> },
        ],
      },
    ],
  },
  { path: '/unauthorized', element: <Unauthorized /> },
  { path: '*', element: <Navigate to='/' replace /> },
])

const AppRoutes: React.FC = () => (
  <RouterProvider router={router} future={{ v7_startTransition: true }} />
)

const App: React.FC = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
)

export default App
