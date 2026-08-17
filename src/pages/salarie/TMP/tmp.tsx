import React, { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

const DEFAULT_EQUIPMENTS = Array.from({ length: 19 }, (_, i) => ({
  id: i + 1,
  name: `Frigo / Équipement ${i + 1}`,
  minTemp: 2,
  maxTemp: 8,
}))

type ShiftType = 'MATIN' | 'SOIR'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const TemperaturePage: React.FC = () => {
  const { session, profile } = useAuth()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState<ShiftType>('MATIN')
  const [employeeName, setEmployeeName] = useState(profile?.full_name || '')
  
  const [readings, setReadings] = useState<Record<number, string>>({})
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleTempChange = (id: number, val: string) => {
    setReadings((prev) => ({ ...prev, [id]: val }))
  }

  const getHeaders = () => ({
    apikey: supabaseKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Détermination de la table cible selon le shift sélectionné
    const targetTable = shift === 'MATIN' ? 'temp_matin' : 'temp_soir'
    const endpoint = `${supabaseUrl}/rest/v1/${targetTable}`

    // Association explicite de user_id (compte ayant validé)
    const formattedPayload = DEFAULT_EQUIPMENTS.map((eq) => ({
      user_id: profile?.id ?? session?.user?.id ?? null,
      station_id: profile?.station_id ?? null,
      employee_name: employeeName,
      log_date: date,
      equipment_id: eq.id,
      equipment_name: eq.name,
      temperature: readings[eq.id] !== undefined && readings[eq.id] !== '' ? parseFloat(readings[eq.id]) : null,
      created_at: new Date().toISOString(),
    }))

    try {
      await axios.post(endpoint, formattedPayload, { headers: getHeaders() })
      setMessage({ type: 'success', text: `Relevé enregistrer avec succès dans la table '${targetTable}' !` })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: `Erreur lors de l'enregistrement dans la table '${targetTable}'.` })
    } finally {
      setLoading(false)
    }
  }

  const totalFilled = Object.values(readings).filter((v) => v !== '').length

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: "'Inter', -apple-system, sans-serif", color: '#0F172A' }}>
      
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🌡️</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0F172A' }}>
              Relevé des Températures
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 34px', color: '#64748B', fontSize: 13.5 }}>
            Contrôle Sanitaire & Chaîne du Froid
          </p>
        </div>

        {/* Sélecteur MATIN / SOIR */}
        <div style={{ display: 'flex', background: '#E2E8F0', padding: 4, borderRadius: 10 }}>
          <button
            type="button"
            onClick={() => setShift('MATIN')}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              backgroundColor: shift === 'MATIN' ? '#FACC15' : 'transparent',
              color: shift === 'MATIN' ? '#713F12' : '#64748B',
              transition: 'all 0.2s',
            }}
          >
            ☀️ MATIN (temp_matin)
          </button>
          <button
            type="button"
            onClick={() => setShift('SOIR')}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              backgroundColor: shift === 'SOIR' ? '#1E40AF' : 'transparent',
              color: shift === 'SOIR' ? '#FFFFFF' : '#64748B',
              transition: 'all 0.2s',
            }}
          >
            🌙 SOIR (temp_soir)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Métadonnées */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: 20,
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
              Date du Relevé
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
              Employé responsable
            </label>
            <input
              type="text"
              required
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Ex: Jean Dupont"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div style={{ background: '#F8FAFC', padding: '10px 16px', borderRadius: 8, border: '1px solid #E2E8F0', textAlign: 'right' }}>
              <span style={{ fontSize: 12, color: '#64748B', display: 'block' }}>Progression</span>
              <strong style={{ fontSize: 16, color: totalFilled === 19 ? '#16A34A' : '#2563EB' }}>
                {totalFilled} / {DEFAULT_EQUIPMENTS.length} renseignés
              </strong>
            </div>
          </div>
        </div>

        {/* Grille des équipements */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          {DEFAULT_EQUIPMENTS.map((eq) => {
            const rawVal = readings[eq.id]
            const val = parseFloat(rawVal)
            const isFilled = rawVal !== undefined && rawVal !== ''
            const isOutOfRange = isFilled && (val < eq.minTemp || val > eq.maxTemp)

            return (
              <div
                key={eq.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 16,
                  border: isOutOfRange
                    ? '2px solid #EF4444'
                    : isFilled
                    ? '1px solid #86EFAC'
                    : '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>N° {eq.id}</span>
                  <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
                    {eq.minTemp}°C à {eq.maxTemp}°C
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={readings[eq.id] || ''}
                    onChange={(e) => handleTempChange(eq.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 32px 10px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 18,
                      fontWeight: 700,
                      color: isOutOfRange ? '#DC2626' : '#0F172A',
                      outline: 'none',
                      backgroundColor: isOutOfRange ? '#FEF2F2' : '#FFFFFF'
                    }}
                  />
                  <span style={{ position: 'absolute', right: 12, top: 12, color: '#94A3B8', fontWeight: 600 }}>
                    °C
                  </span>
                </div>

                {isOutOfRange && (
                  <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ⚠️ Température hors norme !
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pied de page */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            {message ? (
              <div style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: message.type === 'success' ? '#15803D' : '#B91C1C',
                border: message.type === 'success' ? '1px solid #86EFAC' : '1px solid #FCA5A5'
              }}>
                {message.type === 'success' ? '✓ ' : '⚠ '} {message.text}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: '#64748B' }}>
                Cible : Table <strong style={{ color: '#0F172A' }}>temp_{shift.toLowerCase()}</strong> | Compte connecté : {profile?.full_name || session?.user?.email}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(15,23,42,0.15)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Enregistrement...' : `Valider dans temp_${shift.toLowerCase()}`}
          </button>
        </div>
      </form>
    </div>
  )
}

export default TemperaturePage