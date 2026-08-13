import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'

type Priority = 'Urgent' | 'High' | 'Medium' | 'Minor'
type CreationMode = 'profile' | 'task'
type WorkShiftKey = 'matin' | 'apres-midi' | 'nuit'

// Type aligné strictement avec votre schéma de BDD
type TaskEntry = {
  id: string // UUID
  title: string
  scope: string
  shift: string | null
  station_id: string | null
  priority?: Priority | null
  due_date?: string | null
  recurrence_interval?: string | null
  created_at?: string
}

const staticShiftOptions: { key: WorkShiftKey; db: string; label: string }[] = [
  { key: 'matin', db: 'matin', label: 'Matin' },
  { key: 'apres-midi', db: 'apres_midi', label: 'Après-midi' },
  { key: 'nuit', db: 'nuit', label: 'Nuit' },
]

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const tasksEndpoint = `${supabaseUrl}/rest/v1/tasks`

const CreationPage: React.FC = () => {
  const { session, profile, station } = useAuth()

  // MODE DE CRÉATION SELECTIONNÉ
  const [mode, setMode] = useState<CreationMode>('profile')

  // ÉTATS FORMULAIRE PROFIL
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'salarie' | 'responsable'>('salarie')
  const [userShift, setUserShift] = useState('Matin')

  // ÉTATS FORMULAIRE TÂCHE
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState<Priority>('Medium')
  const [scope, setScope] = useState<'communes' | 'specifique'>('communes')
  const [shift, setShift] = useState<WorkShiftKey>('matin')
  const [recurrenceInterval, setRecurrenceInterval] = useState('1 day')

  // LISTE DES TÂCHES & GESTION DES SHIFTS
  const [tasks, setTasks] = useState<TaskEntry[]>([])
  const [shiftOptionsState, setShiftOptionsState] = useState(staticShiftOptions)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [shiftsError, setShiftsError] = useState<string | null>(null)

  // ÉTATS GLOBAUX
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getHeaders = () => ({
    apikey: supabaseKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  })

  const keyToDb = (k: string) => k.replace(/-/g, '_')
  
  const dbToLabel = (dbVal: string | null) => {
    if (!dbVal) return '—'
    const found = (shiftOptionsState || staticShiftOptions).find((s) => s.db === dbVal)
    if (found) return found.label
    return dbVal.replace(/_/g, ' ').replace(/(^|\s)\S/g, (t) => t.toUpperCase())
  }

  // Pré-sélection du shift selon le profil
  useEffect(() => {
    if (!profile?.shift) return
    const key = profile.shift.replace(/_/g, '-') as WorkShiftKey
    const found = (shiftOptionsState || staticShiftOptions).find((s) => s.key === key)
    if (found) setShift(found.key)
  }, [profile])

  // Récupération dynamique des enum de shift
  useEffect(() => {
    let cancelled = false
    async function fetchShifts() {
      setLoadingShifts(true)
      setShiftsError(null)
      try {
        const { data, error } = await supabase.rpc('get_work_shifts')
        if (cancelled) return
        if (error) throw error
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((dbVal: string) => ({
            key: dbVal.replace(/_/g, '-') as WorkShiftKey,
            db: dbVal,
            label: dbToLabel(dbVal),
          }))
          setShiftOptionsState(mapped)
          setLoadingShifts(false)
          return
        }
      } catch (e: any) {
        try {
          const resp = await axios.post<string[]>(`${supabaseUrl}/rpc/get_work_shifts`, {}, { headers: getHeaders() })
          if (cancelled) return
          if (Array.isArray(resp.data) && resp.data.length > 0) {
            const mapped = resp.data.map((dbVal) => ({
              key: dbVal.replace(/_/g, '-') as WorkShiftKey,
              db: dbVal,
              label: dbToLabel(dbVal),
            }))
            setShiftOptionsState(mapped)
            setLoadingShifts(false)
            return
          }
        } catch (e2: any) {
          setShiftsError(axios.isAxiosError(e2) ? e2.response?.data ?? e2.message : String(e2))
        }
      }
      setShiftOptionsState(staticShiftOptions)
      setLoadingShifts(false)
    }
    fetchShifts()
    return () => { cancelled = true }
  }, [session])

  // Chargement des tâches
  const loadTasks = async () => {
    try {
      const response = await axios.get<TaskEntry[]>(`${tasksEndpoint}?select=*&order=created_at.desc`, {
        headers: getHeaders(),
      })
      setTasks(response.data)
    } catch (err) {
      console.error('Erreur de chargement des tâches', err)
    }
  }

  useEffect(() => {
    if (mode === 'task') {
      loadTasks()
    }
  }, [session, mode])

  // SOUMISSION PROFIL
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      setMessage({ type: 'success', text: `Profil de ${fullName} créé avec succès !` })
      setFullName('')
      setEmail('')
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la création du profil.' })
    } finally {
      setLoading(false)
    }
  }

  // SOUMISSION TÂCHE (Paylaod adapté)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) {
      setMessage({ type: 'error', text: 'Le titre de la tâche est obligatoire.' })
      return
    }

    if (!session?.access_token) {
      setMessage({ type: 'error', text: 'Session invalide. Veuillez vous reconnecter.' })
      return
    }

    setLoading(true)
    setMessage(null)

    const payload = {
      title: taskTitle.trim(),
      scope,
      shift: keyToDb(shift),
      station_id: profile?.station_id ?? null,
      priority: taskPriority,
      due_date: new Date().toISOString(),
      recurrence_interval: recurrenceInterval,
    }

    try {
      await axios.post(tasksEndpoint, payload, { headers: getHeaders() })

      setMessage({ type: 'success', text: 'Tâche créée avec succès !' })
      setTaskTitle('')
      setTaskPriority('Medium')
      setScope('communes')

      await loadTasks()
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: axios.isAxiosError(err)
          ? err.response?.data?.message ?? err.message
          : 'Erreur lors de la création de la tâche.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Espace Création</div>
          <div className="small">Ajoutez un nouveau membre ou configurez des tâches récurrentes</div>
        </div>
      </div>

      <div className="dashboard-shell">
        {/* SÉLECTEUR RADIO DE MODE */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            padding: '16px 20px',
          }}
        >
          <span style={{ fontWeight: 600, color: '#475569', marginRight: 8 }}>
            Type de création :
          </span>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontWeight: mode === 'profile' ? 600 : 400,
              color: mode === 'profile' ? '#0F172A' : '#64748B',
            }}
          >
            <input
              type="radio"
              name="creationMode"
              value="profile"
              checked={mode === 'profile'}
              onChange={() => {
                setMode('profile')
                setMessage(null)
              }}
              style={{ accentColor: '#2563EB', cursor: 'pointer' }}
            />
            Créer un Profil
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontWeight: mode === 'task' ? 600 : 400,
              color: mode === 'task' ? '#0F172A' : '#64748B',
            }}
          >
            <input
              type="radio"
              name="creationMode"
              value="task"
              checked={mode === 'task'}
              onChange={() => {
                setMode('task')
                setMessage(null)
              }}
              style={{ accentColor: '#2563EB', cursor: 'pointer' }}
            />
            Créer une Tâche
          </label>
        </div>

        {/* MESSAGES DE SUCCÈS OU D'ERREUR */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 20,
              fontWeight: 500,
              backgroundColor: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: message.type === 'success' ? '#15803D' : '#B91C1C',
              border: `1px solid ${message.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
            }}
          >
            {message.text}
          </div>
        )}

        {/* 1. CRÉATION PROFIL */}
        {mode === 'profile' && (
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Nouveau Profil Utilisateur</h3>
            <form onSubmit={handleCreateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Nom complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Adresse Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@exemple.com"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  >
                    <option value="salarie">Salarié</option>
                    <option value="responsable">Responsable</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Shift attribué</label>
                  <select
                    value={userShift}
                    onChange={(e) => setUserShift(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  >
                    <option value="Matin">Matin</option>
                    <option value="Après-midi">Après-midi</option>
                    <option value="Nuit">Nuit</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                {loading ? 'Création...' : 'Créer le profil'}
              </button>
            </form>
          </div>
        )}

        {/* 2. CRÉATION & LISTE DES TÂCHES */}
        {mode === 'task' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* CARD FORMULAIRE TÂCHE */}
            <div className="card taches-card">
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Créer une nouvelle tâche</h3>
              <p style={{ marginTop: 0, marginBottom: 16, color: '#64748B', fontSize: 14 }}>
                Ajoutez une tâche commune ou spécifique attribuée à une station ou un shift.
              </p>

              <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Titre de la tâche *
                  </label>
                  <input
                    className="control"
                    placeholder="Ex. Vérifier les stocks"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Type de tâche (Scope)
                    </label>
                    <select
                      className="control"
                      value={scope}
                      onChange={(e) => setScope(e.target.value as 'communes' | 'specifique')}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      <option value="communes">Commune</option>
                      <option value="specifique">Spécifique</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Shift
                    </label>
                    <select
                      className="control"
                      value={shift}
                      onChange={(e) => setShift(e.target.value as WorkShiftKey)}
                      disabled={loadingShifts}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      {shiftOptionsState.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {loadingShifts && <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>Chargement des shifts…</div>}
                    {shiftsError && <div style={{ fontSize: 13, color: '#C0392B', marginTop: 6 }}>{String(shiftsError)}</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Priorité
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as Priority)}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">Haute</option>
                      <option value="Medium">Moyenne</option>
                      <option value="Minor">Mineure</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Intervalle de récurrence
                    </label>
                    <select
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      <option value="1 day">Tous les jours (1 day)</option>
                      <option value="2 day">Tous les 2 jours (2 day)</option>
                      <option value="7 day">Toutes les semaines (7 day)</option>
                    </select>
                  </div>

                  {profile?.station_id && (
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                        Station ID
                      </label>
                      <input
                        className="control"
                        value={station?.name ?? profile.station_id}
                        readOnly
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9' }}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ alignSelf: 'flex-start', marginTop: 8 }}
                >
                  {loading ? 'Enregistrement...' : 'Ajouter la tâche'}
                </button>
              </form>
            </div>

            {/* CARD LISTE DES TÂCHES */}
            <div className="card taches-card">
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>Liste des tâches enregistrées</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {tasks.length === 0 ? (
                  <div style={{ color: '#64748B' }}>Aucune tâche trouvée.</div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '12px 16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 12, alignItems: 'center' }}>
                        <strong style={{ fontSize: 15, color: '#0F172A' }}>{task.title}</strong>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#E2E8F0', fontSize: 12, fontWeight: 500 }}>
                          Scope: {task.scope}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ color: '#64748B', fontSize: 13 }}>Shift: <strong>{dbToLabel(task.shift)}</strong></span>
                        <span style={{ color: '#64748B', fontSize: 13 }}>Station: <strong>{task.station_id ?? '—'}</strong></span>
                        {task.priority && <span style={{ color: '#64748B', fontSize: 13 }}>Priorité: <strong>{task.priority}</strong></span>}
                        {task.recurrence_interval && <span style={{ color: '#64748B', fontSize: 13 }}>Récurrence: <strong>{task.recurrence_interval}</strong></span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreationPage