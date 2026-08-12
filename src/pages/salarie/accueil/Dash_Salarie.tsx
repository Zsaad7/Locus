import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

type Task = {
  id: number
  title?: string
  description?: string
  scope?: string
  shift?: string | null
  station_id?: string | null
}

type Answer = 'yes' | 'no' | null

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const tasksEndpoint = `${supabaseUrl}/rest/v1/tasks`

const DashSalarie: React.FC = () => {
  const { profile, session, loading } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [error, setError] = useState<string | null>(null)

  const getHeaders = () => ({
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  })

  useEffect(() => {
    if (!profile || !session) return

    const controller = new AbortController()

    async function loadTasks() {
      try {
        const response = await axios.get<Task[]>(`${tasksEndpoint}?select=*&order=created_at.desc`, {
          headers: getHeaders(),
          signal: controller.signal,
        })
        setTasks(response.data)
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.name === 'CanceledError') return
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.message ?? err.message
            : 'Erreur de chargement des tâches.'
        )
      }
    }

    loadTasks()
    return () => controller.abort()
  }, [profile, session])

  const toggleAnswer = (taskId: number, value: Answer) => {
    setAnswers((prev) => ({
      ...prev,
      [taskId]: prev[taskId] === value ? null : value,
    }))
  }

  if (loading || !profile) {
    return (
      <div className="app-container">
        <div className="card info-card">
          <h3>Chargement...</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{profile.full_name}</div>
          <div className="small">Salarié — {profile.shift}</div>
        </div>
      </div>

      <div className="dashboard-shell">
        {/* BOUTONS CÔTE À CÔTE */}
        <div 
          className="card button-stack-card" 
          style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            gap: 12, 
            flexWrap: 'wrap',
            marginBottom: 20 
          }}
        >
          <button className="btn-primary" style={{ flex: 1, minWidth: '120px' }}>DLC</button>
          <button className="btn-primary" style={{ flex: 1, minWidth: '120px' }}>PO</button>
          <button className="btn-primary" style={{ flex: 1, minWidth: '120px' }}>CAISSE</button>
        </div>

        {/* LISTE DES TÂCHES SIMPLIFIÉE */}
        <div className="card task-section">
          <h3 style={{ marginTop: 0 }}>Liste des tâches</h3>
          {error && <div style={{ color: '#C0392B', marginBottom: 12 }}>{error}</div>}
          
          <div className="task-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.length === 0 ? (
              <div className="small">Aucune tâche trouvée.</div>
            ) : (
              tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="task-row"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid #E2E8F0',
                    gap: 16
                  }}
                >
                  {/* TITRE SEUL */}
                  <div style={{ fontWeight: 500, fontSize: 15, flex: 1 }}>
                    {task.title ?? task.description ?? `Tâche ${task.id}`}
                  </div>

                  {/* BOUTONS OUI / NON A COTE */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      className={`task-chip ${answers[task.id] === 'yes' ? 'task-chip-active' : ''}`}
                      onClick={() => toggleAnswer(task.id, 'yes')}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      className={`task-chip ${answers[task.id] === 'no' ? 'task-chip-active' : ''}`}
                      onClick={() => toggleAnswer(task.id, 'no')}
                    >
                      Non
                    </button>
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

export default DashSalarie