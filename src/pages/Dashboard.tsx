import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type PersonalTaskValue = 'yes' | 'no' | null

const Dashboard: React.FC = () => {
  const { profile, station, refreshStationIp, signOut } = useAuth()
  const [attendanceOpen, setAttendanceOpen] = useState<any | null>(null)
  const [warnings, setWarnings] = useState<any[]>([])
  const [commonTasks, setCommonTasks] = useState<Record<string, boolean>>({
    'Vérifier les messages': false,
    'Préparer l’ouverture': false,
    'Contrôler les stocks': false,
  })
  const [personalTasks, setPersonalTasks] = useState<Record<string, PersonalTaskValue>>({
    'Rappeler le client': null,
    'Finaliser le rapport': null,
  })

  useEffect(() => {
    async function load() {
      if (!profile) return
      const { data } = await supabase.from('attendance').select('*').eq('user_id', profile.id)
      setAttendanceOpen(data?.find((a: any) => !a.clock_out) ?? null)
      const { data: w } = await supabase.from('warnings').select('*').eq('user_id', profile.id)
      setWarnings(w || [])
    }
    load()
  }, [profile])

  const toggleAttendance = async () => {
    if (!profile) return
    if (attendanceOpen) {
      await supabase.from('attendance').update({ clock_out: new Date().toISOString() }).eq('id', attendanceOpen.id)
    } else {
      await supabase.from('attendance').insert({ user_id: profile.id })
    }
    const { data } = await supabase.from('attendance').select('*').eq('user_id', profile.id)
    setAttendanceOpen(data?.find((a: any) => !a.clock_out) ?? null)
  }

  const toggleCommonTask = (task: string) => {
    setCommonTasks((prev) => ({ ...prev, [task]: !prev[task] }))
  }

  const togglePersonalTask = (task: string, value: PersonalTaskValue) => {
    setPersonalTasks((prev) => ({
      ...prev,
      [task]: prev[task] === value ? null : value,
    }))
  }

  const formatTime = (value?: string | null) => {
    if (!value) return '--'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const fullName = profile?.full_name?.trim() || 'Utilisateur'
  const nameParts = fullName.split(/\s+/)
  const firstName = nameParts[0] || 'Utilisateur'
  const lastName = nameParts.slice(1).join(' ') || '-'
  const seniority = profile?.created_at
    ? `Depuis ${new Date(profile.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })}`
    : 'Non renseignée'

  return (
    <div className="app-container">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{profile?.full_name}</div>
          <div className="small">{profile?.role} — {profile?.shift}</div>
        </div>
        <div>
          <button className="btn-ghost" onClick={signOut}>Déconnexion</button>
        </div>
      </div>

      <div className="dashboard-shell">
        <div className="info-row">
          <div className="card info-card">
            <div className="info-p-header">
              <div>
                <div className="small">Info P</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{firstName}</div>
              </div>
              <div className="info-p-pill">{profile?.points ?? 0} pts</div>
            </div>
            <div className="info-p-list">
              <div><strong>Nom</strong><span>{lastName}</span></div>
              <div><strong>Prénom</strong><span>{firstName}</span></div>
              <div><strong>Ancienneté</strong><span>{seniority}</span></div>
            </div>
          </div>

          <div className="card info-card">
            <div className="section-header">
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>POINTAGE</h3>
              <button className="btn-primary compact-btn" onClick={toggleAttendance}>
                {attendanceOpen ? 'Pointage sortie' : 'Pointage entrée'}
              </button>
            </div>
            <div className="attendance-history">
              <div className="attendance-row">
                <span>Hier</span>
                <div>
                  <strong>Entrée</strong> <span>--</span>
                </div>
                <div>
                  <strong>Sortie</strong> <span>--</span>
                </div>
              </div>
              <div className="attendance-row">
                <span>Aujourd'hui</span>
                <div>
                  <strong>Entrée</strong> <span>{formatTime(attendanceOpen?.clock_in)}</span>
                </div>
                <div>
                  <strong>Sortie</strong> <span>{formatTime(attendanceOpen?.clock_out)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card info-card">
            <h3 style={{ marginTop: 0 }}>Station</h3>
            <div className="station-block">
              <div>
                <div style={{ fontWeight: 600 }}>{station?.name ?? 'Aucune'}</div>
                <div className="small">IP autorisée: {station?.allowed_ip ?? 'Non définie'}</div>
              </div>
              {profile?.role === 'responsable' && (
                <button className="btn-ghost" onClick={refreshStationIp}>Définir l'IP actuelle</button>
              )}
            </div>
          </div>

          <div className="card info-card warnings-card">
            <div className="section-header">
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>AVERTISSEMENT</h3>
              <div className="action-icons">
                <button type="button" className="icon-btn" aria-label="Messages">✉</button>
                <button type="button" className="icon-btn" aria-label="Profil">P</button>
              </div>
            </div>
            {warnings.length === 0 ? (
              <div className="empty-warning">
                <div className="empty-warning-icon">i</div>
                <div className="small">Aucun avertissement</div>
              </div>
            ) : warnings.map((w) => (
              <div key={w.id} className="warning-row">
                <div>{w.reason}</div>
                <div className={`badge ${w.severity === 'danger' ? 'badge-danger' : w.severity === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                  {w.severity}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tasks-area">
          <div className="card task-section">
            <h3 style={{ marginTop: 0 }}>TACHES Commune</h3>
            <div className="task-list">
              {Object.entries(commonTasks).map(([task, checked]) => (
                <label key={task} className="task-row">
                  <span>{task}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCommonTask(task)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="card task-section">
            <h3 style={{ marginTop: 0 }}>TACHES Personnel</h3>
            <div className="task-list">
              {Object.entries(personalTasks).map(([task, value]) => (
                <div key={task} className="task-row task-row-personal">
                  <span>{task}</span>
                  <div className="task-options">
                    <button
                      type="button"
                      className={`task-chip ${value === 'yes' ? 'task-chip-active' : ''}`}
                      onClick={() => togglePersonalTask(task, 'yes')}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      className={`task-chip ${value === 'no' ? 'task-chip-active' : ''}`}
                      onClick={() => togglePersonalTask(task, 'no')}
                    >
                      Non
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
