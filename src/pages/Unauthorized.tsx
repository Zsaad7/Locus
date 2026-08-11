import React from 'react'
import { Link } from 'react-router-dom'

const Unauthorized: React.FC = () => (
  <div style={{padding:24}}>
    <h2>Accès refusé</h2>
    <p>Vous n'êtes pas autorisé·e à accéder à cette page.</p>
    <p>
      Retourner au tableau de bord : <Link to="/dashboard">Tableau de bord</Link>
    </p>
  </div>
)

export default Unauthorized
