import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom' // <-- Ajout de useNavigate
import { useAuth } from '../../../context/AuthContext'

type Priority = 'Urgent' | 'High' | 'Medium' | 'Minor'

// TYPE TASK AJUSTÉ AVEC ID EN STRING (UUID)
type Task = {
  id: string
  title?: string
  description?: string
  scope?: string
  shift?: string | null
  station_id?: string | null
  priority?: Priority
  due_date?: string
  recurrence_interval?: string
}

type Answer = 'yes' | 'no' | null

const PRIORITY_ORDER: Record<Priority, number> = {
  Urgent: 1,
  High: 2,
  Medium: 3,
  Minor: 4,
}

const sortTasksByPriority = (tasksList: Task[]): Task[] => {
  return [...tasksList].sort((a, b) => {
    const priorityA = a.priority || 'Medium'
    const priorityB = b.priority || 'Medium'
    return PRIORITY_ORDER[priorityA] - PRIORITY_ORDER[priorityB]
  })
}

const formatRecurrence = (interval?: string) => {
  if (!interval) return 'Ponctuelle'
  if (interval.includes('1 day')) return 'Tous les jours'
  if (interval.includes('2 day')) return 'Tous les 2 jours'
  if (interval.includes('3 day')) return 'Tous les 3 jours'
  if (interval.includes('7 day') || interval.includes('1 week')) return 'Chaque semaine'
  return interval
}

const getDueDateStatus = (dueDateStr?: string) => {
  if (!dueDateStr) return { label: '', color: '#64748B' }

  const dueDate = new Date(dueDateStr)
  const now = new Date()
  const isToday = dueDate.toDateString() === now.toDateString()
  const isPast = dueDate < now && !isToday

  if (isPast) {
    return { label: 'En retard', color: '#DC2626' }
  }
  if (isToday) {
    return { label: "Aujourd'hui (Jour J)", color: '#059669' }
  }

  const formattedDate = dueDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  return { label: `Échéance le ${formattedDate}`, color: '#2563EB' }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const tasksEndpoint = `${supabaseUrl}/rest/v1/tasks`
const taskLogsEndpoint = `${supabaseUrl}/rest/v1/task_logs`

const DashSalarie: React.FC = () => {
  const { profile, session, loading } = useAuth()
  const navigate = useNavigate() // <-- Initialisation du hook de navigation

  // ÉTATS CORRIGÉS (UUID = string)
  const [tasks, setTasks] = useState<Task[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({})
  const [hiddenTaskIds, setHiddenTaskIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null)

  const [clockInTime, setClockInTime] = useState<string | null>(null)

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
        const response = await axios.get<Task[]>(`${tasksEndpoint}?select=*&order=due_date.asc`, {
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

  const handlePointage = () => {
    const now = new Date()
    const formattedTime = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setClockInTime(formattedTime)
  }

  // Redirection au clic du bouton PO
  const handleGoToProductionView = () => {
    navigate('/production-view') // Changez cette URL par votre route réelle (ex: '/production-salarie')
  }

 const handleGoToCaisse = () => {
  navigate('/salarie/Caisse') // Ou '/salarie/caisse' selon votre App.tsx
}

  const handleGoToTemperature =() => {
    navigate('/salarie/TMP') // Ou '/salarie/TMP' selon votre App.tsx
  }

  const toggleAnswer = (taskId: string, value: Answer) => {
    setAnswers((prev) => ({
      ...prev,
      [taskId]: prev[taskId] === value ? null : value,
    }))

    if (value === 'no') {
      setSubmitted((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  const handleCommentChange = (taskId: string, value: string) => {
    setComments((prev) => ({ ...prev, [taskId]: value }))
  }

  const handleSubmit = async (taskId: string) => {
    const answer = answers[taskId]
    if (!answer) return

    const comment = comments[taskId]?.trim() ?? ''

    if (answer === 'no' && !comment) {
      setError('Merci de saisir un commentaire avant de soumettre.')
      return
    }

    setSubmittingTaskId(taskId)
    setError(null)

    try {
      // Enregistrement dans task_logs
      await axios.post(
        taskLogsEndpoint,
        {
          task_id: taskId,
          user_id: session?.user?.id,
          user_name: profile?.full_name ?? 'Inconnu',
          status: answer,
          comment: answer === 'no' ? comment : null,
          shift: profile?.shift ?? null,
          completed_at: new Date().toISOString(),
        },
        { headers: getHeaders() }
      )

      setSubmitted((prev) => ({ ...prev, [taskId]: true }))

      if (answer === 'yes') {
        setHiddenTaskIds((prev) => [...prev, taskId])
      }
    } catch (err: any) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message ?? err.message
          : "Erreur lors de l'enregistrement de la tâche."
      )
    } finally {
      setSubmittingTaskId(null)
    }
  }

  const renderPriorityBadge = (priority?: Priority) => {
    const activePriority: Priority = priority || 'Medium'

    const styles: Record<Priority, { bg: string; color: string }> = {
      Urgent: { bg: '#FEE2E2', color: '#DC2626' },
      High: { bg: '#FFEDD5', color: '#EA580C' },
      Medium: { bg: '#DBEAFE', color: '#2563EB' },
      Minor: { bg: '#F1F5F9', color: '#64748B' },
    }

    const currentStyle = styles[activePriority]

    return (
      <span
        style={{
          backgroundColor: currentStyle.bg,
          color: currentStyle.color,
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'inline-block',
        }}
      >
        {activePriority}
      </span>
    )
  }

  const visibleTasks = sortTasksByPriority(
    tasks.filter((task) => !hiddenTaskIds.includes(task.id))
  )

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
          <div style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{profile.full_name}</span>
            {clockInTime && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid #86EFAC',
                }}
              >
                Pointé à {clockInTime}
              </span>
            )}
          </div>
          <div className="small">Salarié — {profile.shift}</div>
        </div>
      </div>

      <div className="dashboard-shell">
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
          <button className="btn-primary" style={{ flex: 1, minWidth: '120px' }}
            onClick={handleGoToTemperature}
          >TMP</button>
          
          {/* BOUTON PO AVEC REDIRECTION */}
          <button 
            className="btn-primary" 
            style={{ flex: 1, minWidth: '120px' }}
            onClick={handleGoToProductionView}
          >
            PO
          </button>
          
          <button className="btn-primary" style={{ flex: 1, minWidth: '120px' }}
            onClick={handleGoToCaisse}
          >
          CAISSE
          </button>
          <button 
            className="btn-primary" 
            style={{ flex: 1, minWidth: '120px' }}
            onClick={handlePointage}
          >
            POINTAGE
          </button>
        </div>

        <div className="card task-section">
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Liste des tâches</h3>
          {error && <div style={{ color: '#C0392B', marginBottom: 12, fontWeight: 500 }}>{error}</div>}
          
          <div className="task-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleTasks.length === 0 ? (
              <div className="small">Aucune tâche trouvée.</div>
            ) : (
              visibleTasks.map((task) => {
                const answer = answers[task.id]
                const isSubmitted = submitted[task.id]
                const comment = comments[task.id] ?? ''
                const dueDateStatus = getDueDateStatus(task.due_date)
                const isSubmitting = submittingTaskId === task.id

                return (
                  <div 
                    key={task.id} 
                    className="task-row" 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 12, 
                      padding: '14px 12px', 
                      borderBottom: '1px solid #E2E8F0' 
                    }}
                  >
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: 16,
                        width: '100%' 
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontWeight: 500, fontSize: 15 }}>
                            {task.title ?? task.description ?? `Tâche ${task.id}`}
                          </span>
                          {renderPriorityBadge(task.priority)}
                        </div>

                        <div style={{ display: 'flex', gap: 12, fontSize: '12px', marginTop: 2 }}>
                          <span style={{ color: '#64748B', fontWeight: 500 }}>
                            🔄 {formatRecurrence(task.recurrence_interval)}
                          </span>
                          {dueDateStatus.label && (
                            <span style={{ color: dueDateStatus.color, fontWeight: 600 }}>
                              📅 {dueDateStatus.label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <button
                          type="button"
                          className={`task-chip ${answer === 'yes' ? 'task-chip-active' : ''}`}
                          onClick={() => toggleAnswer(task.id, 'yes')}
                          style={{ minWidth: '60px' }}
                          disabled={isSubmitting}
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          className={`task-chip ${answer === 'no' ? 'task-chip-active' : ''}`}
                          onClick={() => toggleAnswer(task.id, 'no')}
                          style={{ minWidth: '60px' }}
                          disabled={isSubmitting}
                        >
                          Non
                        </button>
                      </div>
                    </div>

                    {answer === 'no' && !isSubmitted && (
                      <div 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 8, 
                          alignSelf: 'flex-end', 
                          width: '100%', 
                          maxWidth: '400px' 
                        }}
                      >
                        <textarea
                          rows={3}
                          value={comment}
                          placeholder="Expliquez pourquoi vous ne pouvez pas réaliser cette tâche..."
                          onChange={(event) => handleCommentChange(task.id, event.target.value)}
                          style={{ 
                            width: '100%', 
                            padding: 10, 
                            borderRadius: 8, 
                            border: '1px solid #CBD5E1', 
                            resize: 'vertical',
                            fontSize: 14 
                          }}
                        />
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ width: '140px', alignSelf: 'flex-end' }} 
                          onClick={() => handleSubmit(task.id)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Envoi...' : 'Soumettre'}
                        </button>
                      </div>
                    )}

                    {answer === 'no' && isSubmitted && (
                      <div 
                        style={{ 
                          background: '#F8FAFC', 
                          borderRadius: 8, 
                          padding: '10px 14px', 
                          borderLeft: '4px solid #E11D48',
                          alignSelf: 'flex-end',
                          minWidth: '280px',
                          maxWidth: '400px'
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                          Commentaire envoyé par {profile.full_name} :
                        </div>
                        <div className="small" style={{ color: '#1E293B' }}>{comment}</div>
                      </div>
                    )}

                    {answer === 'yes' && !isSubmitted && (
                      <div style={{ alignSelf: 'flex-end' }}>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ width: '180px' }} 
                          onClick={() => handleSubmit(task.id)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Envoi...' : 'Valider et supprimer'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashSalarie