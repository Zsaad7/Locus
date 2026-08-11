import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Link, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import ProductionPage from './pages/responsable/production/production'
import PertePage from './pages/responsable/perte/perte'
import ProfileCreation from './pages/responsable/creation/profile'
import TachesPage from './pages/responsable/taches/taches'
import ProtectedRoute from './components/ProtectedRoute'
import Unauthorized from './pages/Unauthorized'

import Navbar from './components/Navbar'

const Layout: React.FC = () => {
  return (
    <div className="app-container">
      <Navbar />
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
          { path: '/tasks', element: <Tasks /> },
          { path: '/responsable/perte', element: <PertePage /> },
          { path: '/responsable/creation/profile', element: <ProfileCreation /> },
          { path: '/responsable/taches', element: <TachesPage /> },
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
