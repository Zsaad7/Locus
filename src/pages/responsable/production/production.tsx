import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'

const ProductionPage: React.FC = () => {
  const { profile } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [type, setType] = useState('Sandwich classique')
  const [qty, setQty] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase.from('production').select('*').order('created_at', { ascending: false }).limit(50)
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!profile) return setMessage('Connectez-vous')
    setLoading(true)
    try {
      const payload = { user_id: profile.id, type, quantity: qty }
      const { error } = await supabase.from('production').insert(payload)
      if (error) throw error
      setMessage('Ajouté')
      setQty(1)
      load()
    } catch (e:any) {
      setMessage(e.message || 'Erreur')
    } finally { setLoading(false) }
  }

  return (
    <div className="app-container">
      <div className="card">
        <h2>Suivi de production</h2>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <select className="control" value={type} onChange={e=>setType(e.target.value)} style={{maxWidth:320}}>
            <option>Sandwich classique</option>
            <option>Sandwich végétarien</option>
            <option>Sandwich spécial</option>
          </select>
          <input className="control" type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} style={{width:100}} />
          <button className="btn-primary" onClick={add} disabled={loading}>{loading ? 'En cours...' : 'Ajouter'}</button>
        </div>
        {message && <div style={{marginTop:8}} className="small">{message}</div>}
      </div>

      <div className="card">
        <h3>Productions récentes</h3>
        {items.length === 0 ? <div className="small">Aucune production enregistrée</div> : (
          items.map(it => (
            <div key={it.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div>
                <div style={{fontWeight:700}}>{it.type}</div>
                <div className="small">par {it.user_id} — {new Date(it.created_at).toLocaleString()}</div>
              </div>
              <div style={{fontWeight:700,fontSize:18}}>{it.quantity}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ProductionPage
