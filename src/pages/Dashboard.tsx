import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const Dashboard: React.FC = () => {
  const { profile, station, refreshStationIp, signOut } = useAuth()
  const [attendanceOpen, setAttendanceOpen] = useState<any | null>(null)
  const [warnings, setWarnings] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      if (!profile) return
      const { data } = await supabase.from('attendance').select('*').eq('user_id', profile.id)
      setAttendanceOpen(data?.find((a:any)=>!a.clock_out) ?? null)
      const { data: w } = await supabase.from('warnings').select('*').eq('user_id', profile.id)
      setWarnings(w || [])
    }
    load()
  }, [profile])

  const toggleAttendance = async () => {
    if (!profile) return
    if (attendanceOpen) {
      // clock out
      await supabase.from('attendance').update({ clock_out: new Date().toISOString() }).eq('id', attendanceOpen.id)
    } else {
      await supabase.from('attendance').insert({ user_id: profile.id })
    }
    const { data } = await supabase.from('attendance').select('*').eq('user_id', profile.id)
    setAttendanceOpen(data?.find((a:any)=>!a.clock_out) ?? null)
  }

  return (
    <div className="app-container">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:600}}>{profile?.full_name}</div>
          <div className="small">{profile?.role} — {profile?.shift}</div>
        </div>
        <div>
          <button className="btn-ghost" onClick={signOut}>Déconnexion</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="stat-card">
          <div>
            <div className="small">Points</div>
            <div style={{fontSize:28,fontWeight:600,color:'var(--text)'}}>{profile?.points ?? 0}</div>
          </div>
          <div style={{background:'var(--accent)',color:'#fff',padding:'8px 12px',borderRadius:8,fontWeight:700}}>Score</div>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <h3 style={{marginTop:0}}>Pointage</h3>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:1}}>
            <div className="small">{attendanceOpen ? `En poste depuis ${new Date(attendanceOpen.clock_in).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'Non pointé'}</div>
          </div>
          <div style={{width:160}}>
            <button className="btn-primary" onClick={toggleAttendance}>{attendanceOpen ? 'Pointage sortie' : 'Pointage entrée'}</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <h3 style={{marginTop:0}}>Avertissements</h3>
        {warnings.length === 0 ? (
          <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:36,height:36,background:'#fff',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid var(--border)'}}>i</div><div className="small">Aucun avertissement</div></div>
        ) : warnings.map(w=> (
          <div key={w.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0'}}>
            <div>{w.reason}</div>
            <div className={`badge ${w.severity==='danger'?'badge-danger':w.severity==='warning'?'badge-warning':'badge-info'}`}>{w.severity}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{marginTop:0}}>Station</h3>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:600}}>{station?.name ?? 'Aucune'}</div>
            <div className="small">IP autorisée: {station?.allowed_ip ?? 'Non définie'}</div>
          </div>
          {profile?.role === 'responsable' && (
            <div>
              <button className="btn-ghost" onClick={refreshStationIp}>Définir l'IP actuelle</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
