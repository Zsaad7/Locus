import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

type TaskLog = {
  id: number
  task_id: string
  user_id: string
  user_name: string
  status: 'yes' | 'no'
  comment: string | null
  completed_at: string
  shift: string | null
  tasks?: {
    title?: string
    description?: string
    [key: string]: any
  } | null
}

type FilterStatus = 'all' | 'yes' | 'no'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const taskLogsEndpoint = `${supabaseUrl}/rest/v1/task_logs`

const TachesHistoriques: React.FC = () => {
  const { profile, session, loading: authLoading } = useAuth()
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // FILTRES ET RECHERCHE
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const getHeaders = () => ({
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  })

  useEffect(() => {
    if (!profile || !session) return

    const controller = new AbortController()

    async function fetchTaskLogs() {
      setLoading(true)
      try {
        // Utilisation de tasks(*) au lieu d'imposer des colonnes précises
        const response = await axios.get<TaskLog[]>(
          `${taskLogsEndpoint}?select=*,tasks(*)&order=completed_at.desc`,
          {
            headers: getHeaders(),
            signal: controller.signal,
          }
        )
        setLogs(response.data)
        setError(null)
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.name === 'CanceledError') return
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.message ?? err.message
            : "Erreur lors du chargement de l'historique."
        )
      } finally {
        setLoading(false)
      }
    }

    fetchTaskLogs()
    return () => controller.abort()
  }, [profile, session])

  // FILTRAGE DE LA LISTE
  const filteredLogs = logs.filter((log) => {
    if (filterStatus !== 'all' && log.status !== filterStatus) {
      return false
    }

    const taskTitle = log.tasks?.title ?? log.tasks?.description ?? ''
    const searchLower = searchTerm.toLowerCase()
    const matchUser = (log.user_name ?? '').toLowerCase().includes(searchLower)
    const matchTask = taskTitle.toLowerCase().includes(searchLower)

    return matchUser || matchTask
  })

  const formatDate = (isoString: string) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (authLoading || loading) {
    return (
      <div className="app-container">
        <div className="card info-card">
          <h3>Chargement de l'historique...</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Historique des Tâches</div>
          <div className="small">Suivi de l'exécution et des réponses du personnel</div>
        </div>
      </div>

      <div className="dashboard-shell">
        {/* BARRE DE RECHERCHE ET FILTRES */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* BARRE DE RECHERCHE */}
          <input
            type="text"
            placeholder="Rechercher par salarié ou tâche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              flex: '1',
              minWidth: '220px',
              fontSize: 14,
            }}
          />

          {/* BOUTONS DE FILTRE */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`task-chip ${filterStatus === 'all' ? 'task-chip-active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              Tous ({logs.length})
            </button>
            <button
              type="button"
              className={`task-chip ${filterStatus === 'yes' ? 'task-chip-active' : ''}`}
              onClick={() => setFilterStatus('yes')}
            >
              Fait ({logs.filter((l) => l.status === 'yes').length})
            </button>
            <button
              type="button"
              className={`task-chip ${filterStatus === 'no' ? 'task-chip-active' : ''}`}
              onClick={() => setFilterStatus('no')}
            >
              Non fait ({logs.filter((l) => l.status === 'no').length})
            </button>
          </div>
        </div>

        {/* ERREUR EVENTUELLE */}
        {error && <div style={{ color: '#C0392B', marginBottom: 16, fontWeight: 500 }}>{error}</div>}

        {/* TABLEAU DES LOGS */}
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>
              Aucun historique trouvé pour ces critères.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Date & Heure</th>
                  <th style={{ padding: '12px 16px' }}>Salarié</th>
                  <th style={{ padding: '12px 16px' }}>Shift</th>
                  <th style={{ padding: '12px 16px' }}>Tâche</th>
                  <th style={{ padding: '12px 16px' }}>Statut</th>
                  <th style={{ padding: '12px 16px' }}>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const shortTaskId = log.task_id ? log.task_id.slice(0, 8) : 'N/A'
                  const taskTitle = log.tasks?.title ?? log.tasks?.description ?? `Tâche ID: ${shortTaskId}...`

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {formatDate(log.completed_at)}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E293B' }}>
                        {log.user_name ?? 'Inconnu'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748B' }}>
                        {log.shift ? `Shift ${log.shift}` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0F172A' }}>
                        {taskTitle}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {log.status === 'yes' ? (
                          <span
                            style={{
                              backgroundColor: '#DCFCE7',
                              color: '#15803D',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            RÉALISÉ
                          </span>
                        ) : (
                          <span
                            style={{
                              backgroundColor: '#FEE2E2',
                              color: '#B91C1C',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            NON FAIT
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', maxWidth: '300px' }}>
                        {log.comment ? (
                          <span style={{ fontStyle: 'italic', background: '#F1F5F9', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                            "{log.comment}"
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default TachesHistoriques