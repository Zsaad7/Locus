import React, { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'

type Priority = 'Urgent' | 'High' | 'Medium' | 'Minor'
type CreationMode = 'profile' | 'task' | 'product'
type WorkShiftKey = 'matin' | 'apres-midi' | 'nuit'

// Type pour les catégories et familles depuis BDD
type FamilleProduit = {
  id: string
  famille?: string
  categorie?: string
}

// TYPE CORRIGÉ : Retrait de user_id et station_id
type ProductionEntry = {
  id?: string
  label: string
  quantity: number
  famille_id: string
  created_at?: string
}

// Type aligné strictement avec le schéma BDD pour les tâches
type TaskEntry = {
  id: string // UUID
  title: string
  scope: string
  shift: string | null
  station_id: string | null
  priority?: Priority | null
  due_date?: string | null
  recurrence_interval?: string | null
  created_at?: string
}

const staticShiftOptions: { key: WorkShiftKey; db: string; label: string }[] = [
  { key: 'matin', db: 'matin', label: 'Matin' },
  { key: 'apres-midi', db: 'apres_midi', label: 'Après-midi' },
  { key: 'nuit', db: 'nuit', label: 'Nuit' },
]

const CreationPage: React.FC = () => {
  const { session, profile, station } = useAuth()

  // MODE DE CRÉATION SÉLECTIONNÉ
  const [mode, setMode] = useState<CreationMode>('profile')

  // ÉTATS FORMULAIRE PROFIL
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'salarie' | 'responsable'>('salarie')
  const [userShift, setUserShift] = useState('Matin')

  // ÉTATS FORMULAIRE TÂCHE
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState<Priority>('Medium')
  const [scope, setScope] = useState<'communes' | 'specifique'>('communes')
  const [shift, setShift] = useState<WorkShiftKey>('matin')
  const [recurrenceInterval, setRecurrenceInterval] = useState('1 day')

  // ÉTATS FORMULAIRE PRODUIT À PRODUIRE (PRODUCTION)
  const [prodProduit, setProdProduit] = useState('')
  const [prodCategorie, setProdCategorie] = useState('')
  const [prodFamilleId, setProdFamilleId] = useState<string>('')
  const [prodQuantite, setProdQuantite] = useState<number>(10)
  const [prodShift, setProdShift] = useState<WorkShiftKey>('matin')

  // DONNÉES CATÉGORIES & FAMILLES (DEPUIS BDD famille_produits)
  const [familleProduitsList, setFamilleProduitsList] = useState<FamilleProduit[]>([])
  const [categoriesList, setCategoriesList] = useState<string[]>([])
  const [availableFamilles, setAvailableFamilles] = useState<FamilleProduit[]>([])
  const [loadingFamilles, setLoadingFamilles] = useState(false)

  // LISTE DES TÂCHES & GESTION DES SHIFTS
  const [tasks, setTasks] = useState<TaskEntry[]>([])
  const [shiftOptionsState, setShiftOptionsState] = useState(staticShiftOptions)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [shiftsError, setShiftsError] = useState<string | null>(null)

  // ÉTATS GLOBAUX
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const keyToDb = (k: string) => k.replace(/-/g, '_')

  const dbToLabel = (dbVal: string | null) => {
    if (!dbVal) return '—'
    const found = (shiftOptionsState || staticShiftOptions).find((s) => s.db === dbVal)
    if (found) return found.label
    return dbVal.replace(/_/g, ' ').replace(/(^|\s)\S/g, (t) => t.toUpperCase())
  }

  // Pré-sélection du shift selon le profil
  useEffect(() => {
    if (!profile?.shift) return
    const key = profile.shift.replace(/_/g, '-') as WorkShiftKey
    const found = (shiftOptionsState || staticShiftOptions).find((s) => s.key === key)
    if (found) {
      setShift(found.key)
      setProdShift(found.key)
    }
  }, [profile])

  // 1. Charger les catégories et familles via le client Supabase
  useEffect(() => {
    const fetchFamilleProduits = async () => {
      setLoadingFamilles(true)
      try {
        const { data, error } = await supabase
          .from('famille_produits')
          .select('id, categorie, famille')

        if (error) throw error

        if (data && data.length > 0) {
          setFamilleProduitsList(data as FamilleProduit[])

          const uniqueCategories = Array.from(
            new Set(data.map((item) => item.categorie).filter(Boolean) as string[])
          )

          setCategoriesList(uniqueCategories)

          if (uniqueCategories.length > 0) {
            setProdCategorie(uniqueCategories[0])
          }
        }
      } catch (err: any) {
        console.error('Erreur chargement famille_produits:', err)
      } finally {
        setLoadingFamilles(false)
      }
    }

    fetchFamilleProduits()
  }, [])

  // 2. Mettre à jour la liste des familles dynamiquement selon la catégorie sélectionnée
  useEffect(() => {
    if (!prodCategorie) {
      setAvailableFamilles([])
      setProdFamilleId('')
      return
    }

    const filteredFamilles = familleProduitsList.filter(
      (item) => item.categorie === prodCategorie && item.id
    )

    setAvailableFamilles(filteredFamilles)

    if (filteredFamilles.length > 0 && filteredFamilles[0].id) {
      setProdFamilleId(filteredFamilles[0].id)
    } else {
      setProdFamilleId('')
    }
  }, [prodCategorie, familleProduitsList])

  // Récupération dynamique des enum de shift
  useEffect(() => {
    let cancelled = false
    async function fetchShifts() {
      setLoadingShifts(true)
      setShiftsError(null)
      try {
        const { data, error } = await supabase.rpc('get_work_shifts')
        if (cancelled) return
        if (error) throw error
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((dbVal: string) => ({
            key: dbVal.replace(/_/g, '-') as WorkShiftKey,
            db: dbVal,
            label: dbToLabel(dbVal),
          }))
          setShiftOptionsState(mapped)
          setLoadingShifts(false)
          return
        }
      } catch (e: any) {
        if (!cancelled) {
          setShiftsError(e.message || String(e))
          setShiftOptionsState(staticShiftOptions)
        }
      } finally {
        if (!cancelled) setLoadingShifts(false)
      }
    }
    fetchShifts()
    return () => {
      cancelled = true
    }
  }, [session])

  // Chargement des tâches via le client Supabase
  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data as TaskEntry[])
    } catch (err) {
      console.error('Erreur de chargement des tâches', err)
    }
  }

  useEffect(() => {
    if (mode === 'task') {
      loadTasks()
    }
  }, [session, mode])

  // SOUMISSION PROFIL
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const tempPassword = Math.random().toString(36).slice(-10) + '!A1'
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: tempPassword,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            shift: keyToDb(userShift.toLowerCase()),
          },
        },
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            full_name: fullName.trim(),
            email: email.trim(),
            role,
            shift: keyToDb(userShift.toLowerCase()),
            station_id: profile?.station_id ?? null,
          },
        ])

        if (profileError && profileError.code !== '23505') {
          throw profileError
        }
      }

      setMessage({ type: 'success', text: `Profil de ${fullName} créé avec succès !` })
      setFullName('')
      setEmail('')
      setRole('salarie')
      setUserShift('Matin')
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la création du profil.' })
    } finally {
      setLoading(false)
    }
  }

  // SOUMISSION TÂCHE
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) {
      setMessage({ type: 'error', text: 'Le titre de la tâche est obligatoire.' })
      return
    }

    if (!session?.access_token) {
      setMessage({ type: 'error', text: 'Session invalide. Veuillez vous reconnecter.' })
      return
    }

    setLoading(true)
    setMessage(null)

    const payload = {
      title: taskTitle.trim(),
      scope,
      shift: keyToDb(shift),
      station_id: profile?.station_id ?? null,
      priority: taskPriority,
      due_date: new Date().toISOString(),
      recurrence_interval: recurrenceInterval,
    }

    try {
      const { error } = await supabase.from('tasks').insert([payload])

      if (error) throw error

      setMessage({ type: 'success', text: 'Tâche créée avec succès !' })
      setTaskTitle('')
      setTaskPriority('Medium')
      setScope('communes')

      await loadTasks()
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Erreur lors de la création de la tâche.',
      })
    } finally {
      setLoading(false)
    }
  }

  // SOUMISSION PRODUIT À PRODUIRE (ÉCRITURE DANS TABLE PRODUCTION)
  const handleCreateProduction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prodProduit.trim()) {
      setMessage({ type: 'error', text: 'Le nom du produit est obligatoire.' })
      return
    }
    if (!prodFamilleId) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner une famille de produit valide.' })
      return
    }

    setLoading(true)
    setMessage(null)

    // CORRIGÉ : Retrait de `user_id` qui n'existe pas dans la table `production`
    const newProduction: ProductionEntry = {
      label: prodProduit.trim(),
      quantity: Number(prodQuantite),
      famille_id: prodFamilleId,
    }

    try {
      const { error } = await supabase.from('production').insert([newProduction])

      if (error) throw error

      setMessage({ type: 'success', text: `Produit "${prodProduit}" ajouté à la production avec succès !` })
      setProdProduit('')
      setProdQuantite(10)
    } catch (err: any) {
      console.error('Erreur création production:', err)
      setMessage({
        type: 'error',
        text: err.message || 'Erreur lors de l’ajout du produit en production.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Espace Création</div>
          <div className="small">Ajoutez un nouveau membre, une tâche ou un produit à produire</div>
        </div>
      </div>

      <div className="dashboard-shell">
        {/* SÉLECTEUR RADIO DE MODE */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            padding: '16px 20px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 600, color: '#475569', marginRight: 8 }}>
            Type de création :
          </span>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontWeight: mode === 'profile' ? 600 : 400,
              color: mode === 'profile' ? '#0F172A' : '#64748B',
            }}
          >
            <input
              type="radio"
              name="creationMode"
              value="profile"
              checked={mode === 'profile'}
              onChange={() => {
                setMode('profile')
                setMessage(null)
              }}
              style={{ accentColor: '#2563EB', cursor: 'pointer' }}
            />
            Créer un Profil
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontWeight: mode === 'task' ? 600 : 400,
              color: mode === 'task' ? '#0F172A' : '#64748B',
            }}
          >
            <input
              type="radio"
              name="creationMode"
              value="task"
              checked={mode === 'task'}
              onChange={() => {
                setMode('task')
                setMessage(null)
              }}
              style={{ accentColor: '#2563EB', cursor: 'pointer' }}
            />
            Créer une Tâche
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontWeight: mode === 'product' ? 600 : 400,
              color: mode === 'product' ? '#0F172A' : '#64748B',
            }}
          >
            <input
              type="radio"
              name="creationMode"
              value="product"
              checked={mode === 'product'}
              onChange={() => {
                setMode('product')
                setMessage(null)
              }}
              style={{ accentColor: '#2563EB', cursor: 'pointer' }}
            />
            Ajouter un Produit à Produire
          </label>
        </div>

        {/* MESSAGES DE SUCCÈS OU D'ERREUR */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 20,
              fontWeight: 500,
              backgroundColor: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: message.type === 'success' ? '#15803D' : '#B91C1C',
              border: `1px solid ${message.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
            }}
          >
            {message.text}
          </div>
        )}

        {/* 1. CRÉATION PROFIL */}
        {mode === 'profile' && (
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Nouveau Profil Utilisateur</h3>
            <form onSubmit={handleCreateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Nom complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Adresse Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@exemple.com"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'salarie' | 'responsable')}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  >
                    <option value="salarie">Salarié</option>
                    <option value="responsable">Responsable</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Shift attribué</label>
                  <select
                    value={userShift}
                    onChange={(e) => setUserShift(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  >
                    <option value="Matin">Matin</option>
                    <option value="Après-midi">Après-midi</option>
                    <option value="Nuit">Nuit</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                {loading ? 'Création...' : 'Créer le profil'}
              </button>
            </form>
          </div>
        )}

        {/* 2. CRÉATION & LISTE DES TÂCHES */}
        {mode === 'task' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card taches-card">
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Créer une nouvelle tâche</h3>
              <p style={{ marginTop: 0, marginBottom: 16, color: '#64748B', fontSize: 14 }}>
                Ajoutez une tâche commune ou spécifique attribuée à une station ou un shift.
              </p>

              <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Titre de la tâche *
                  </label>
                  <input
                    className="control"
                    placeholder="Ex. Vérifier les stocks"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Type de tâche (Scope)
                    </label>
                    <select
                      className="control"
                      value={scope}
                      onChange={(e) => setScope(e.target.value as 'communes' | 'specifique')}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      <option value="communes">Commune</option>
                      <option value="specifique">Spécifique</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Shift
                    </label>
                    <select
                      className="control"
                      value={shift}
                      onChange={(e) => setShift(e.target.value as WorkShiftKey)}
                      disabled={loadingShifts}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      {shiftOptionsState.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {loadingShifts && <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>Chargement des shifts…</div>}
                    {shiftsError && <div style={{ fontSize: 13, color: '#C0392B', marginTop: 6 }}>{String(shiftsError)}</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Priorité
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as Priority)}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">Haute</option>
                      <option value="Medium">Moyenne</option>
                      <option value="Minor">Mineure</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                      Intervalle de récurrence
                    </label>
                    <select
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                    >
                      <option value="1 day">Tous les jours (1 day)</option>
                      <option value="2 day">Tous les 2 jours (2 day)</option>
                      <option value="7 day">Toutes les semaines (7 day)</option>
                    </select>
                  </div>

                  {profile?.station_id && (
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label className="label" style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                        Station ID
                      </label>
                      <input
                        className="control"
                        value={station?.name ?? profile.station_id}
                        readOnly
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9' }}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ alignSelf: 'flex-start', marginTop: 8 }}
                >
                  {loading ? 'Enregistrement...' : 'Ajouter la tâche'}
                </button>
              </form>
            </div>

            {/* LISTE DES TÂCHES */}
            <div className="card taches-card">
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>Liste des tâches enregistrées</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {tasks.length === 0 ? (
                  <div style={{ color: '#64748B' }}>Aucune tâche trouvée.</div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '12px 16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 12, alignItems: 'center' }}>
                        <strong style={{ fontSize: 15, color: '#0F172A' }}>{task.title}</strong>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#E2E8F0', fontSize: 12, fontWeight: 500 }}>
                          Scope: {task.scope}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ color: '#64748B', fontSize: 13 }}>Shift: <strong>{dbToLabel(task.shift)}</strong></span>
                        <span style={{ color: '#64748B', fontSize: 13 }}>Station: <strong>{task.station_id ?? '—'}</strong></span>
                        {task.priority && <span style={{ color: '#64748B', fontSize: 13 }}>Priorité: <strong>{task.priority}</strong></span>}
                        {task.recurrence_interval && <span style={{ color: '#64748B', fontSize: 13 }}>Récurrence: <strong>{task.recurrence_interval}</strong></span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. CRÉATION D'UN PRODUIT À PRODUIRE (TABLE PRODUCTION) */}
        {mode === 'product' && (
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Ajouter un produit à produire</h3>
            <p style={{ marginTop: 0, marginBottom: 16, color: '#64748B', fontSize: 14 }}>
              Planifiez la fabrication d'un produit. Les familles sont extraites directement de la base.
            </p>

            <form onSubmit={handleCreateProduction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Nom du produit *
                </label>
                <input
                  type="text"
                  value={prodProduit}
                  onChange={(e) => setProdProduit(e.target.value)}
                  placeholder="Ex: Baguette Tradition, Croissant Beurre..."
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {/* SÉLECTION DE LA CATÉGORIE */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Catégorie * {loadingFamilles && <span style={{ fontSize: 12, color: '#64748B' }}>(Chargement...)</span>}
                  </label>
                  <select
                    value={prodCategorie}
                    onChange={(e) => setProdCategorie(e.target.value)}
                    disabled={loadingFamilles || categoriesList.length === 0}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  >
                    {categoriesList.length === 0 ? (
                      <option value="">{loadingFamilles ? 'Chargement...' : 'Aucune catégorie trouvée'}</option>
                    ) : (
                      categoriesList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* SÉLECTION DE LA FAMILLE (FILTRÉE PAR CATÉGORIE) */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Famille *
                  </label>
                  <select
                    value={prodFamilleId}
                    onChange={(e) => setProdFamilleId(e.target.value)}
                    disabled={loadingFamilles || availableFamilles.length === 0}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  >
                    {availableFamilles.length === 0 ? (
                      <option value="">Aucune famille disponible</option>
                    ) : (
                      availableFamilles.map((fam) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.famille || 'Sans nom'}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {/* QUANTITÉ PRÉVUE */}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Quantité prévue *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={prodQuantite}
                    onChange={(e) => setProdQuantite(Number(e.target.value))}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !prodFamilleId}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                {loading ? 'Ajout en cours...' : 'Ajouter à la production'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreationPage