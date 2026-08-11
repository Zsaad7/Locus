import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Props = {
  allowedRoles?: string[]
}

const ProtectedRoute: React.FC<Props> = ({ allowedRoles }) => {
  const { session, loading, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div style={{padding:20}}>Chargement...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = profile?.role
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <Outlet />
}

export default ProtectedRoute
