import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import ProductionPage from './pages/responsable/production/production'
import ProductionSalarie from './pages/salarie/PO/production_salarie'
import PertePage from './pages/responsable/perte/perte'
import CreationPage from './pages/responsable/creation/creation_page'
import TachesHistoriques from './pages/responsable/taches/taches_historiques'
import ProtectedRoute from './components/ProtectedRoute'
import Unauthorized from './pages/Unauthorized'
import PlanningPage from './pages/responsable/planning/planning'

import Navbar from './components/Navbar'

const Layout: React.FC = () => {
  return (
    <div className="app-container">
      <Navbar />
      <main style={{ padding: 16 }}>
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
          // Ajout de la route production-view accessible globalement une fois connecté
          { path: '/production-view', element: <ProductionSalarie /> },
          { path: '/', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["salarie"]} />,
    children: [
      {
        element: <Layout />,
        children: [
          // Vos routes spécifiques aux salariés si besoin
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["responsable"]} />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/responsable/production', element: <ProductionPage /> },
          { path: '/tasks', element: <Tasks /> },
          { path: '/responsable/perte', element: <PertePage /> },
          { path: '/responsable/creation/profile', element: <CreationPage /> },
          { path: '/responsable/taches', element: <TachesHistoriques /> },
          { path: '/responsable/planning', element: <PlanningPage /> },
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