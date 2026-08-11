import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const Login: React.FC = () => {
  const { signInWithCode, signUp, error } = useAuth()
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setLocalErr(null)
    setAccessCode(null)

    if (mode === 'signup') {
      if (!fullName || !password || !confirmPassword) {
        setLocalErr('Tous les champs sont requis.')
        setBusy(false)
        return
      }
      if (password.length < 6) {
        setLocalErr('Le mot de passe doit contenir au moins 6 caractères.')
        setBusy(false)
        return
      }
      if (password !== confirmPassword) {
        setLocalErr('Les mots de passe ne correspondent pas.')
        setBusy(false)
        return
      }
      const { error, code } = await signUp(fullName, password)
      if (error) {
        setLocalErr(error.message ?? String(error))
      } else {
        setAccessCode(code)
      }
    } else {
      if (!code || !password) {
        setLocalErr('Tous les champs sont requis.')
        setBusy(false)
        return
      }
      const { error } = await signInWithCode(code, password)
      if (error) setLocalErr(error.message ?? String(error))
    }

    setBusy(false)
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{maxWidth:420,width:'100%'}}>
        <div className="card" aria-labelledby="login-title">
          <div style={{textAlign:'center',marginBottom:12}}>
            <div className="wordmark" style={{justifyContent:'center'}}>Locus</div>
            <div className="small">l'accès, ancré au lieu</div>
          </div>
          <h2 id="login-title" style={{fontSize:20,marginBottom:8}}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
          <form onSubmit={submit} style={{display:'grid',gap:12}}>
            {mode === 'signup' ? (
              <>
                <div>
                  <label className="label">Nom complet</label>
                  <input className="control" placeholder="Nom complet" value={fullName} onChange={e => setFullName(e.target.value)} aria-label="Nom complet" />
                </div>
                <div>
                  <label className="label">Mot de passe</label>
                  <input className="control" placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} aria-label="Mot de passe" />
                </div>
                <div>
                  <label className="label">Confirmer le mot de passe</label>
                  <input className="control" placeholder="Confirmer le mot de passe" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} aria-label="Confirmer le mot de passe" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Code d'accès</label>
                  <input className="control" placeholder="100001" value={code} onChange={e => setCode(e.target.value)} aria-label="Code d'accès" />
                </div>
                <div>
                  <label className="label">Mot de passe</label>
                  <input className="control" placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} aria-label="Mot de passe" />
                </div>
              </>
            )}
            <div style={{display:'grid',gap:8}}>
              <button className="btn-primary" type="submit" disabled={busy}>{mode==='login'?'Se connecter':'Créer un compte'}</button>
              <button type="button" className="btn-ghost" onClick={() => { setMode(mode==='login'?'signup':'login'); setLocalErr(null); setAccessCode(null) }}>
                {mode==='login'?'Créer un compte':'Se connecter'}
              </button>
            </div>
          </form>
          {accessCode && (
            <div className="card" style={{marginTop:16}}>
              <div style={{fontWeight:600,marginBottom:8}}>Ton code d'accès :</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                <div style={{fontSize:24,fontWeight:700,color:'var(--brand)'}}>{accessCode}</div>
                <button type="button" className="btn-ghost" onClick={() => navigator.clipboard.writeText(accessCode)}>
                  Copier
                </button>
              </div>
              <div className="small" style={{marginTop:8}}>Note-le, il te servira à te connecter.</div>
            </div>
          )}
          <div style={{marginTop:12}}>
            <div style={{color:'#C0392B'}}>{localErr ?? error}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
