import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'

const ProfileCreation: React.FC = () => {
  const { profile: me } = useAuth()
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    phone: '',
    anciennete: '',
    access_code: '',
    password: '',
    confirmPassword: '',
    email: '',
    station_id: ''
  })
  const [stations, setStations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('stations').select('*').then(({ data }) => setStations(data || []))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((s) => ({ ...s, [name]: value }))
  }

  const validate = () => {
    if (!form.nom || !form.prenom) return 'Nom et prénom obligatoires.'
    if (form.password && form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return null
  }

  const submit = async () => {
    setMessage(null)
    const err = validate()
    if (err) return setMessage(err)
    setLoading(true)
    try {
      const payload = {
        full_name: `${form.prenom} ${form.nom}`,
        first_name: form.prenom,
        last_name: form.nom,
        phone: form.phone || null,
        anciennete: form.anciennete || null,
        access_code: form.access_code || null,
        email: form.email || null,
        station_id: form.station_id || null,
        role: 'salarie'
      }
      const { error } = await supabase.from('profiles').insert(payload)
      if (error) throw error
      setMessage('Profil créé avec succès.')
      setForm({ nom: '', prenom: '', phone: '', anciennete: '', access_code: '', password: '', confirmPassword: '', email: '', station_id: '' })
    } catch (e: any) {
      setMessage(e.message || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div className="card">
        <h2>Création de profil salarié</h2>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label className="label">Prénom</label>
            <input className="control" name="prenom" value={form.prenom} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="control" name="nom" value={form.nom} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="control" name="phone" value={form.phone} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Ancienneté</label>
            <input className="control" name="anciennete" value={form.anciennete} onChange={handleChange} placeholder="Ex: Depuis août 2020" />
          </div>
          <div>
            <label className="label">Code d'accès</label>
            <input className="control" name="access_code" value={form.access_code} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="control" name="email" value={form.email} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input type="password" className="control" name="password" value={form.password} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Confirmer mot de passe</label>
            <input type="password" className="control" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} />
          </div>
          <div style={{gridColumn:'1 / -1'}}>
            <label className="label">Station</label>
            <select className="control" name="station_id" value={form.station_id} onChange={handleChange}>
              <option value="">-- Aucune --</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{marginTop:12,display:'flex',gap:8}}>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Enregistrement...' : 'Créer'}</button>
          <button className="btn-ghost" onClick={()=> setForm({nom:'',prenom:'',phone:'',anciennete:'',access_code:'',password:'',confirmPassword:'',email:'',station_id:''})}>Réinitialiser</button>
        </div>
        {message && <div style={{marginTop:12}} className="small">{message}</div>}
      </div>
    </div>
  )
}

export default ProfileCreation
