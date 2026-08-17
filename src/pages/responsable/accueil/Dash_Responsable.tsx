import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'

type PersonalTaskValue = 'yes' | 'no' | null

type Task = {
  id: number
  title?: string
  description?: string
  scope?: string
  type?: string
}

const DashResponsable: React.FC = () => {
  const { profile, station, refreshStationIp } = useAuth()
  const [attendanceOpen, setAttendanceOpen] = useState<any | null>(null)
  const [attendanceList, setAttendanceList] = useState<any[]>([])
  const [warnings, setWarnings] = useState<any[]>([])
  const [commonTasks, setCommonTasks] = useState<Task[]>([])
  const [personalTasks, setPersonalTasks] = useState<Task[]>([])
  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({})
  const [personalAnswers, setPersonalAnswers] = useState<Record<number, PersonalTaskValue>>({})

  useEffect(() => {
    async function load() {
      if (!profile) return

      // 1. Pointage
      const { data: attendanceData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile.id)

      if (attErr) console.error('Erreur Attendance:', attErr)
      else {
        const list = attendanceData || []
        setAttendanceList(list)
        setAttendanceOpen(list.find((a) => !a.clock_out) ?? null)
      }

      // 2. Avertissements
      const { data: warningsData, error: warnErr } = await supabase
        .from('warnings')
        .select('*')
        .eq('user_id', profile.id)

      if (warnErr) console.error('Erreur Warnings:', warnErr)
      else setWarnings(warningsData || [])

      // 3. Tâches
      const { data: tasksData, error: taskErr } = await supabase
        .from('tasks')
        .select('*')

      if (taskErr) {
        console.error('Erreur Tasks:', taskErr)
      } else {
        const tasks = tasksData || []
        console.log('Données brutes reçues pour TASKS :', tasks)

        setCommonTasks(
          tasks.filter((t: any) => {
            const s = String(t.scope || t.type || '').toLowerCase()
            return s.includes('commun') || s.includes('common')
          })
        )

        setPersonalTasks(
          tasks.filter((t: any) => {
            const s = String(t.scope || t.type || '').toLowerCase()
            return s.includes('spécifiques') || s.includes('perso') || s.includes('priv')
          })
        )
      }
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

  const toggleCommonTask = (taskId: number) => {
    setCheckedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  const togglePersonalTask = (taskId: number, value: PersonalTaskValue) => {
    setPersonalAnswers((prev) => ({
      ...prev,
      [taskId]: prev[taskId] === value ? null : value,
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

  const findAttendanceByDate = (date: Date) => {
    return attendanceList.find((a) => {
      if (!a?.clock_in) return false
      const d = new Date(a.clock_in)
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()
    })
  }

  const todayAttendance = findAttendanceByDate(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayAttendance = findAttendanceByDate(yesterdayDate)

  if (profile?.role !== 'responsable') {
    return (
      <div className="app-container">
        <div className="card info-card">
          <h3>Accès réservé aux responsables</h3>
          <p>Vous n'êtes pas autorisé à voir cette page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{profile?.full_name}</div>
          <div className="small">Responsable — {profile?.shift}</div>
        </div>
      </div>

      <div className="dashboard-shell">
         <div className="info-row">
          <div className="card info-card">
            <div className="info-p-header">
              <div>
                <div className="small">Information Personnelle</div>
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

          {/* <div className="card info-card">
            <div className="section-header">
              <h3 className="small">Pointage</h3>
              <button className="btn-primary compact-btn" onClick={toggleAttendance}>
                {attendanceOpen ? 'Pointage sortie' : 'Pointage entrée'}
              </button>
            </div>
            <div className="attendance-history">
              <div className="attendance-grid">
                <div className="attendance-card">
                  <div className="attendance-card-header">Aujourd'hui</div>
                  <div className="attendance-card-footer">
                    <div className="attendance-time"><strong>Entrée</strong> <span>{formatTime(todayAttendance?.clock_in ?? attendanceOpen?.clock_in)}</span></div>
                    <div className="attendance-time"><strong>Sortie</strong> <span>{formatTime(todayAttendance?.clock_out ?? attendanceOpen?.clock_out)}</span></div>
                  </div>
                </div>

                <div className="attendance-card">
                  <div className="attendance-card-header">Hier</div>
                  <div className="attendance-card-footer">
                    <div className="attendance-time"><strong>Entrée</strong> <span>{formatTime(yesterdayAttendance?.clock_in)}</span></div>
                    <div className="attendance-time"><strong>Sortie</strong> <span>{formatTime(yesterdayAttendance?.clock_out)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div> */}

          <div className="card info-card">
            <h3 className="small">Station</h3>
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
              <h3 className="small">Taches ecours</h3>
            </div>
            {warnings.length === 0 ? (
              <div className="empty-warning">
                <div className="empty-warning-icon">i</div>
                <div className="small">Aucune taches en cours</div>
              </div>
            ) : (
              warnings.map((w) => (
                <div key={w.id} className="warning-row">
                  <div>{w.reason}</div>
                  <div className={`badge ${w.severity === 'danger' ? 'badge-danger' : w.severity === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                    {w.severity}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* <div className="tasks-area">
          <div className="card task-section">
            <h3 style={{ marginTop: 0 }}>Tâches Communes</h3>
            <div className="task-list">
              {commonTasks.length === 0 ? (
                <div className="small">Aucune tâche commune</div>
              ) : (
                commonTasks.map((task) => (
                  <label key={task.id} className="task-row">
                    <span>{task.title || task.description}</span>
                    <input
                      type="checkbox"
                      checked={!!checkedTasks[task.id]}
                      onChange={() => toggleCommonTask(task.id)}
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="card task-section">
            <h3 style={{ marginTop: 0 }}>Tâches Spécifiques</h3>
            <div className="task-list">
              {personalTasks.length === 0 ? (
                <div className="small">Aucune tâche spécifique</div>
              ) : (
                personalTasks.map((task) => (
                  <div key={task.id} className="task-row task-row-personal">
                    <span>{task.title || task.description}</span>
                    <div className="task-options">
                      <button
                        type="button"
                        className={`task-chip ${personalAnswers[task.id] === 'yes' ? 'task-chip-active' : ''}`}
                        onClick={() => togglePersonalTask(task.id, 'yes')}
                      >
                        Oui
                      </button>
                      <button
                        type="button"
                        className={`task-chip ${personalAnswers[task.id] === 'no' ? 'task-chip-active' : ''}`}
                        onClick={() => togglePersonalTask(task.id, 'no')}
                      >
                        Non
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div> */}

       
      </div>
    </div>
  )
}

export default DashResponsable

