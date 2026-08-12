import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

// Type de priorité possible
type Priority = 'Urgent' | 'High' | 'Medium' | 'Minor'

type Task = {
  id: number
  title?: string
  description?: string
  scope?: string
  shift?: string | null
  station_id?: string | null
  priority?: Priority // Nouveau champ de priorité
}

type Answer = 'yes' | 'no' | null

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const tasksEndpoint = `${supabaseUrl}/rest/v1/tasks`

const DashSalarie: React.FC = () => {
  const { profile, session, loading } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [comments, setComments] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const [hiddenTaskIds, setHiddenTaskIds] = useState<number[]>([])
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

    if (value === 'no') {
      setSubmitted((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  const handleCommentChange = (taskId: number, value: string) => {
    setComments((prev) => ({ ...prev, [taskId]: value }))
  }

  const handleSubmit = (taskId: number) => {
    const answer = answers[taskId]
    if (answer === 'no') {
      if (!comments[taskId]?.trim()) {
        setError('Merci de saisir un commentaire avant de soumettre.')
        return
      }
      setSubmitted((prev) => ({ ...prev, [taskId]: true }))
      setError(null)
      return
    }

    if (answer === 'yes') {
      setHiddenTaskIds((prev) => [...prev, taskId])
      setSubmitted((prev) => ({ ...prev, [taskId]: true }))
      setError(null)
    }
  }

  // Fonction pour afficher le badge de priorité avec la bonne couleur
 const renderPriorityBadge = (priority?: Priority) => {
  // Si la priorité est vide/null, on affiche "Medium" par défaut
  const activePriority: Priority = priority || 'Medium'

  const styles: Record<Priority, { bg: string; color: string }> = {
    Urgent: { bg: '#FEE2E2', color: '#DC2626' }, // Rouge
    High: { bg: '#FFEDD5', color: '#EA580C' },   // Orange
    Medium: { bg: '#DBEAFE', color: '#2563EB' }, // Bleu
    Minor: { bg: '#F1F5F9', color: '#64748B' },  // Gris
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

  const visibleTasks = tasks.filter((task) => !hiddenTaskIds.includes(task.id))

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
        {/* BOUTONS D'ACTION */}
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
          <button className="btn-primary" style={{ flex: 1, minWidth: '120px' }}>POINTAGE</button>
        </div>

        {/* LISTE DES TÂCHES */}
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
                    {/* LIGNE PRINCIPALE : TITRE + BADGE PRIORITÉ À CÔTÉ ET BOUTONS À DROITE */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: 16,
                        width: '100%' 
                      }}
                    >
                      {/* TITRE DE LA TÂCHE + BADGE DE PRIORITÉ */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <span style={{ fontWeight: 500, fontSize: 15 }}>
                          {task.title ?? task.description ?? `Tâche ${task.id}`}
                        </span>
                        {renderPriorityBadge(task.priority)}
                      </div>

                      {/* BOUTONS OUI / NON */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <button
                          type="button"
                          className={`task-chip ${answer === 'yes' ? 'task-chip-active' : ''}`}
                          onClick={() => toggleAnswer(task.id, 'yes')}
                          style={{ minWidth: '60px' }}
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          className={`task-chip ${answer === 'no' ? 'task-chip-active' : ''}`}
                          onClick={() => toggleAnswer(task.id, 'no')}
                          style={{ minWidth: '60px' }}
                        >
                          Non
                        </button>
                      </div>
                    </div>

                    {/* SAISIE DE COMMENTAIRE (ALIGNÉ EN BAS À DROITE) */}
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
                        >
                          Soumettre
                        </button>
                      </div>
                    )}

                    {/* AFFICHAGE DU COMMENTAIRE SOUMIS (ALIGNÉ EN BAS À DROITE) */}
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

                    {/* BOUTON VALIDER ET SUPPRIMER (ALIGNÉ EN BAS À DROITE) */}
                    {answer === 'yes' && !isSubmitted && (
                      <div style={{ alignSelf: 'flex-end' }}>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ width: '180px' }} 
                          onClick={() => handleSubmit(task.id)}
                        >
                          Valider et supprimer
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