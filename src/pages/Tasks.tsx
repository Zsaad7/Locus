import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const Tasks: React.FC = () => {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<any[]>([])
  const [completions, setCompletions] = useState<Record<string, any>>({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('tasks').select('*')
      setTasks(data || [])
      if (profile) {
        const { data: c } = await supabase.from('task_completions').select('*').eq('user_id', profile.id)
        const map: Record<string, any> = {};
        (c || []).forEach((cc:any)=> map[cc.task_id] = cc)
        setCompletions(map)
      }
    }
    load()
  }, [profile])

  const toggle = async (taskId: string) => {
    if (!profile) return
    if (completions[taskId]) {
      await supabase.from('task_completions').delete().eq('id', completions[taskId].id)
      const copy = {...completions}; delete copy[taskId]; setCompletions(copy)
    } else {
      const { data } = await supabase.from('task_completions').insert({ task_id: taskId, user_id: profile.id }).select().single()
      setCompletions({...completions, [taskId]: data})
    }
  }

  const common = tasks.filter(t=>t.scope === 'common')
  const specific = tasks.filter(t=>t.scope === 'specific' && t.shift === profile?.shift)

  return (
    <div className="app-container">
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Tâches communes</h3>
          <div className="small">{common.length} tâches</div>
        </div>
        <div style={{marginTop:12,display:'grid',gap:8}}>
          {common.map(t => (
            <label key={t.id} style={{display:'flex',alignItems:'center',gap:12}}>
              <span className={`checkbox ${completions[t.id]?'checkbox-checked':''}`} onClick={()=>toggle(t.id)} role="checkbox" aria-checked={!!completions[t.id]} tabIndex={0}></span>
              <span style={{textDecoration: completions[t.id]?'line-through':'none',color: completions[t.id]?'var(--text-soft)':undefined}}>{t.title}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Tâches du poste</h3>
          <div className="small">{specific.length} tâches</div>
        </div>
        <div style={{marginTop:12,display:'grid',gap:8}}>
          {specific.map(t => (
            <label key={t.id} style={{display:'flex',alignItems:'center',gap:12}}>
              <span className={`checkbox ${completions[t.id]?'checkbox-checked':''}`} onClick={()=>toggle(t.id)} role="checkbox" aria-checked={!!completions[t.id]} tabIndex={0}></span>
              <span style={{textDecoration: completions[t.id]?'line-through':'none',color: completions[t.id]?'var(--text-soft)':undefined}}>{t.title}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Tasks
