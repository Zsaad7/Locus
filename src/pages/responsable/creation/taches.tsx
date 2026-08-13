import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'

type WorkShiftKey = 'matin' | 'apres-midi' | 'nuit'

type TaskEntry = {
  id: number
  title: string
  scope: string
  shift: string | null // DB may store underscored values (apres_midi)
  station_id: string | null
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

const TachesPage: React.FC = () => {
  const { session, profile, station } = useAuth()
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState<'communes' | 'specifique'>('communes')
  const [shift, setShift] = useState<WorkShiftKey>('matin')
  const [tasks, setTasks] = useState<TaskEntry[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [shiftOptionsState, setShiftOptionsState] = useState(staticShiftOptions)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [shiftsError, setShiftsError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.shift) return
    // profile.shift may use underscores (apres_midi). Convert to UI key (apres-midi)
    const key = profile.shift.replace(/_/g, '-') as WorkShiftKey
    const found = (shiftOptionsState || staticShiftOptions).find((s) => s.key === key)
    if (found) setShift(found.key)
  }, [profile])

  // Try fetching enum values from the DB via the Supabase RPC. Prefer `supabase.rpc`, fallback to axios POST.
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
          const mapped = data.map((dbVal: string) => {
            const key = dbVal.replace(/_/g, '-') as WorkShiftKey
            const label = dbToLabel(dbVal)
            return { key, db: dbVal, label }
          })
          setShiftOptionsState(mapped)
          setLoadingShifts(false)
          return
        }
      } catch (e: any) {
        // fallback to axios RPC call if supabase client fails
        try {
          const resp = await axios.post<string[]>(`${supabaseUrl}/rpc/get_work_shifts`, {}, { headers: getHeaders() })
          if (cancelled) return
          if (Array.isArray(resp.data) && resp.data.length > 0) {
            const mapped = resp.data.map((dbVal) => {
              const key = dbVal.replace(/_/g, '-') as WorkShiftKey
              const label = dbToLabel(dbVal)
              return { key, db: dbVal, label }
            })
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

  const keyToDb = (k: string) => k.replace(/-/g, '_')
  const dbToLabel = (dbVal: string | null) => {
    if (!dbVal) return '—'
    const found = (shiftOptionsState || staticShiftOptions).find((s) => s.db === dbVal)
    if (found) return found.label
    // fallback: replace underscore with space and capitalize
    return dbVal.replace(/_/g, ' ').replace(/(^|\s)\S/g, (t) => t.toUpperCase())
  }

  const getHeaders = () => ({
    apikey: supabaseKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  })

  useEffect(() => {
    async function loadTasks() {
      try {
        const response = await axios.get<TaskEntry[]>(`${tasksEndpoint}?select=*&order=created_at.desc`, {
          headers: getHeaders(),
        })
        setTasks(response.data)
      } catch (err) {
        const message = axios.isAxiosError(err)
          ? err.response?.data?.message ?? err.message
          : 'Erreur de chargement des tâches.'
        setError(message)
      }
    }

    loadTasks()
  }, [session])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!title.trim()) {
      setError('Le titre est requis.')
      return
    }

    if (!session?.access_token) {
      setError('Session invalide. Veuillez vous reconnecter.')
      return
    }

    setSaving(true)
    const payload = {
      title: title.trim(),
      scope,
      // convert UI key (apres-midi) to DB enum form (apres_midi)
      shift: keyToDb(shift),
      station_id: profile?.station_id ?? null,
    }

    try {
      await axios.post(tasksEndpoint, payload, {
        headers: getHeaders(),
      })
      setTitle('')
      setScope('communes')
      setMessage('Tâche ajoutée avec succès.')

      const response = await axios.get<TaskEntry[]>(`${tasksEndpoint}?select=*&order=created_at.desc`, {
        headers: getHeaders(),
      })
      setTasks(response.data)
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? err.message
        : 'Erreur lors de la création de la tâche.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-container">
      <div className="taches-grid">
        <div className="card taches-card">
          <h2>Créer une nouvelle tâche</h2>
          <p>Utilisez ce formulaire pour ajouter une tâche commune ou spécifique.</p>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label className="label">Titre de la tâche</label>
              <input
                className="control"
                placeholder="Ex. Vérifier les stocks"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Type de tâche</label>
              <select className="control" value={scope} onChange={(e) => setScope(e.target.value as 'communes' | 'specifique')}>
                <option value="communes">Commune</option>
                <option value="specifique">Spécifique</option>
              </select>
            </div>
            <div>
              <label className="label">Shift</label>
              <select className="control" value={shift} onChange={(e) => setShift(e.target.value as WorkShiftKey)} disabled={loadingShifts}>
                {shiftOptionsState.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              {loadingShifts && <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>Chargement des shifts…</div>}
              {shiftsError && <div style={{ fontSize: 13, color: '#C0392B', marginTop: 6 }}>{String(shiftsError)}</div>}
            </div>
            {profile?.station_id && (
              <div>
                <label className="label">Station</label>
                <input className="control" value={station?.name ?? profile.station_id} readOnly />
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Ajouter la tâche'}
            </button>
          </form>
          {message && <div style={{ marginTop: 12, color: '#0F6E56' }}>{message}</div>}
          {error && <div style={{ marginTop: 12, color: '#C0392B' }}>{error}</div>}
        </div>

        <div className="card taches-card">
          <h3>Liste des tâches</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {tasks.length === 0 ? (
              <div>Aucune tâche trouvée.</div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="task-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 12 }}>
                    <strong>{task.title}</strong>
                    <span className="badge" style={{ padding: '6px 10px' }}>{task.scope}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                    <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>Shift: {dbToLabel(task.shift)}</span>
                    <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>Station: {task.station_id ?? '—'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TachesPage
