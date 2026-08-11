import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'

const PertePage: React.FC = () => {
  const { profile } = useAuth()
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState<string>('')
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    if (!profile) return
    const { data } = await supabase.from('pertes').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    setList(data || [])
  }

  useEffect(() => { load() }, [profile])

  const submit = async () => {
    if (!profile) return setMessage('Connectez-vous')
    if (!desc) return setMessage('Décrire la perte')
    setLoading(true)
    try {
      const payload = { user_id: profile.id, description: desc, montant: amount ? Number(amount) : null }
      const { error } = await supabase.from('pertes').insert(payload)
      if (error) throw error
      setDesc('')
      setAmount('')
      setMessage('Perte signalée')
      load()
    } catch (e: any) {
      setMessage(e.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div className="card">
        <h2>Signaler une perte</h2>
        <div>
          <label className="label">Description</label>
          <input className="control" value={desc} onChange={e=>setDesc(e.target.value)} />
        </div>
        <div style={{marginTop:8}}>
          <label className="label">Montant (optionnel)</label>
          <input className="control" value={amount} onChange={e=>setAmount(e.target.value)} />
        </div>
        <div style={{marginTop:12,display:'flex',gap:8}}>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Envoi...' : 'Signaler'}</button>
        </div>
        {message && <div style={{marginTop:10}} className="small">{message}</div>}
      </div>

      <div className="card">
        <h3>Mes signalements récents</h3>
        {list.length === 0 ? <div className="small">Aucun signalement</div> : (
          list.map(l => (
            <div key={l.id} style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontWeight:700}}>{l.description}</div>
              <div className="small">Montant: {l.montant ?? '--'} — {new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default PertePage
