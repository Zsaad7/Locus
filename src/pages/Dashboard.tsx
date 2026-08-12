import React from 'react'
import { useAuth } from '../context/AuthContext'
import DashResponsable from './responsable/accueil/Dash_Responsable'
import DashSalarie from './salarie/accueil/Dash_Salarie'

const Dashboard: React.FC = () => {
  const { profile, loading } = useAuth()

  if (loading || !profile) {
    return (
      <div className="app-container">
        <div className="card info-card">
          <h3>Chargement...</h3>
        </div>
      </div>
    )
  }

  if (profile.role === 'responsable') {
    return <DashResponsable />
  }

  if (profile.role === 'salarie') {
    return <DashSalarie />
  }

  return (
    <div className="app-container">
      <div className="card info-card">
        <h3>Accès non autorisé</h3>
        <p>Votre rôle ne permet pas d'accéder à ce tableau de bord.</p>
      </div>
    </div>
  )
}

export default Dashboard
                 