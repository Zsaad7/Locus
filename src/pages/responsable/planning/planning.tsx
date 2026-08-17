import React, { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { useAuth } from '../../../context/AuthContext' // Ajustez le chemin si nécessaire

// --- TYPES ---
type ViewMode = 'month' | 'week' | 'day'

type Employee = {
  id: string
  name: string
  role: string
  avatarColor?: string
}

type Shift = {
  id: string
  employee_id: string
  date: string // YYYY-MM-DD
  start_time: string // HH:mm:ss ou HH:mm
  end_time: string // HH:mm:ss ou HH:mm
  type: 'Matin' | 'Aprem' | 'Nuit' | 'Repos' | 'Congé'
  break_minutes?: number
}

const SHIFT_COLORS: Record<Shift['type'], { bg: string; color: string; border: string }> = {
  Matin: { bg: '#E0F2FE', color: '#0369A1', border: '#BAE6FD' },
  Aprem: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  Nuit: { bg: '#F3E8FF', color: '#6B21A8', border: '#E9D5FF' },
  Repos: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' },
  Congé: { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' },
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

const getAvatarColor = (id: string) => {
  const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4']
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// Calcul d'heures nettes (moins pause)
const calculateShiftHours = (start: string, end: string, breakMins: number = 0) => {
  if (!start || !end) return 0
  const [sH, sM] = start.split(':').map(Number)
  const [eH, eM] = end.split(':').map(Number)
  let diff = (eH * 60 + eM) - (sH * 60 + sM)
  if (diff < 0) diff += 24 * 60
  diff -= breakMins
  return Math.max(0, diff / 60)
}

const PlanningPage: React.FC = () => {
  const { session, loading: authLoading } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [, setLoading] = useState<boolean>(true)
  const [, setError] = useState<string | null>(null)

  // Édition de créneau
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; date: string; existingShift?: Shift } | null>(null)
  const [modalShiftType, setModalShiftType] = useState<Shift['type']>('Matin')
  const [modalStart, setModalStart] = useState('08:00')
  const [modalEnd, setModalEnd] = useState('16:00')
  const [modalBreak, setModalBreak] = useState(0)

  // Modale d'envoi Email / Export
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [isSending, setIsSending] = useState(false)

  const getHeaders = useCallback(() => {
    const token = session?.access_token || supabaseKey
    return {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    }
  }, [session])

  const formatDateKey = (d: Date) => d.toISOString().split('T')[0]

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [currentDate])

  // --- CHARGEMENT DONNÉES ---
  const fetchData = useCallback(async () => {
    if (!supabaseUrl || !supabaseKey) return

    setLoading(true)
    setError(null)

    try {
      const headers = getHeaders()

      const profilesRes = await axios.get(
        `${supabaseUrl}/rest/v1/profiles?select=id,full_name,role&order=full_name.asc`,
        { headers }
      )
      
      const mappedEmployees: Employee[] = (profilesRes.data || [])
        .filter((p: any) => {
          if (!p.role) return true
          const r = String(p.role).toLowerCase()
          return !r.includes('admin') && !r.includes('resp') && !r.includes('manager')
        })
        .map((p: any) => ({
          id: p.id,
          name: p.full_name || 'Salarié sans nom',
          role: p.role || 'Salarié',
          avatarColor: getAvatarColor(p.id),
        }))

      setEmployees(mappedEmployees)

      const startDate = formatDateKey(weekDays[0])
      const endDate = formatDateKey(weekDays[6])

      const shiftsRes = await axios.get(
        `${supabaseUrl}/rest/v1/shifts?date=gte.${startDate}&date=lte.${endDate}&select=*`,
        { headers }
      )

      setShifts(shiftsRes.data || [])

    } catch (err: any) {
      console.error('Erreur Supabase :', err)
      setError(err?.response?.data?.message || err?.message || 'Erreur au chargement du planning.')
    } finally {
      setLoading(false)
    }
  }, [getHeaders, weekDays])

  useEffect(() => {
    if (!authLoading) {
      fetchData()
    }
  }, [authLoading, fetchData])

  // --- NAVIGATION DATES ---
  const handleNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    else newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    setCurrentDate(newDate)
  }

  // --- ÉDITION DE SHIFT ---
  const handleCellClick = (employeeId: string, date: string) => {
    const existing = shifts.find((s) => s.employee_id === employeeId && s.date === date)
    
    if (existing) {
      setModalShiftType(existing.type)
      setModalStart(existing.start_time ? existing.start_time.substring(0, 5) : '08:00')
      setModalEnd(existing.end_time ? existing.end_time.substring(0, 5) : '16:00')
      setModalBreak(existing.break_minutes || 0)
    } else {
      setModalShiftType('Matin')
      setModalStart('08:00')
      setModalEnd('16:00')
      setModalBreak(0)
    }

    setSelectedCell({ employeeId, date, existingShift: existing })
  }

  const handleSaveShift = async () => {
    if (!selectedCell) return

    try {
      const headers = getHeaders()
      const payload = {
        employee_id: selectedCell.employeeId,
        date: selectedCell.date,
        type: modalShiftType,
        start_time: modalShiftType === 'Repos' || modalShiftType === 'Congé' ? '00:00:00' : `${modalStart}:00`,
        end_time: modalShiftType === 'Repos' || modalShiftType === 'Congé' ? '00:00:00' : `${modalEnd}:00`,
        break_minutes: modalBreak,
      }

      if (selectedCell.existingShift) {
        // Modification
        const res = await axios.patch(
          `${supabaseUrl}/rest/v1/shifts?id=eq.${selectedCell.existingShift.id}`,
          payload,
          { headers }
        )
        
        // Validation sécurisée du retour de l'API Supabase REST
        const updatedShift = Array.isArray(res.data) && res.data.length > 0
          ? res.data[0]
          : { ...selectedCell.existingShift, ...payload }

        setShifts((prev) => prev.map((s) => (s.id === selectedCell.existingShift!.id ? updatedShift : s)))
      } else {
        // Création
        const res = await axios.post(
          `${supabaseUrl}/rest/v1/shifts`,
          payload,
          { headers }
        )

        if (Array.isArray(res.data) && res.data.length > 0) {
          setShifts((prev) => [...prev, res.data[0]])
        } else {
          // Si Supabase ne renvoie pas l'enregistrement créé, re-fetch pour resynchroniser
          await fetchData()
        }
      }

      setSelectedCell(null)
    } catch (err: any) {
      console.error("Erreur Supabase lors de la sauvegarde :", err?.response?.data || err?.message || err)
      const errorMsg = err?.response?.data?.message || err?.message || "Impossible d'enregistrer le créneau."
      alert(`Erreur : ${errorMsg}`)
    }
  }

  // --- GÉNÉRATION FICHIER EXCEL ---
  const generateExcelBuffer = () => {
    const data: any[] = []

    // En-têtes du fichier Excel
    const headers = [
      'Salarié',
      'Rôle',
      ...weekDays.map(d => `${d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase()} ${d.getDate()}/${d.getMonth() + 1}`),
      'Total Heures'
    ]
    data.push(headers)

    // Lignes par salarié
    employees.forEach((emp) => {
      let empTotal = 0
      const row: any[] = [emp.name, emp.role]

      weekDays.forEach((day) => {
        const dateKey = formatDateKey(day)
        const shift = shifts.find((s) => s.employee_id === emp.id && s.date === dateKey)

        if (!shift || shift.type === 'Repos') {
          row.push('Repos')
        } else if (shift.type === 'Congé') {
          row.push('Congé')
        } else {
          const hours = calculateShiftHours(shift.start_time, shift.end_time, shift.break_minutes)
          empTotal += hours
          row.push(`${shift.type} (${shift.start_time.substring(0, 5)}-${shift.end_time.substring(0, 5)})`)
        }
      })

      row.push(`${empTotal.toFixed(1)} h`)
      data.push(row)
    })

    const worksheet = XLSX.utils.aoa_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Planning')

    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  }

  // Téléchargement direct d'Excel
  const handleDownloadExcel = () => {
    const buffer = generateExcelBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Planning_Semaine_${formatDateKey(weekDays[0])}.xlsx`
    link.click()
  }

  // Envoi par email via Supabase Edge Function ou Backend
  const handleSendEmail = async () => {
    if (!recipientEmail) return alert('Veuillez entrer une adresse e-mail valide.')

    setIsSending(true)
    try {
      const buffer = generateExcelBuffer()
      const base64Excel = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      )

      await axios.post(
        `${supabaseUrl}/functions/v1/send-planning-email`,
        {
          to: recipientEmail,
          subject: `Planning de la semaine du ${weekDays[0].toLocaleDateString('fr-FR')}`,
          fileName: `Planning_${formatDateKey(weekDays[0])}.xlsx`,
          fileBase64: base64Excel,
        },
        { headers: getHeaders() }
      )

      alert('Planning envoyé avec succès par e-mail !')
      setIsEmailModalOpen(false)
      setRecipientEmail('')
    } catch (err) {
      console.error("Erreur d'envoi d'email :", err)
      alert("L'envoi automatique a échoué. Téléchargement du fichier Excel à la place.")
      handleDownloadExcel()
    } finally {
      setIsSending(false)
    }
  }

  // Calcul du total global d'heures
  const totalPlannedHours = useMemo(() => {
    return shifts.reduce((acc, shift) => {
      if (shift.type === 'Repos' || shift.type === 'Congé') return acc
      return acc + calculateShiftHours(shift.start_time, shift.end_time, shift.break_minutes)
    }, 0)
  }, [shifts])

  if (authLoading) return <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Chargement...</div>

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
            📅 Planning des Salariés
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: 14 }}>
            Vue restreinte aux salariés uniquement (hors responsables).
          </p>
        </div>

        {/* BOUTONS ACTIONS (EXCEL / MAIL & NAV) */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            📊 Export & Email
          </button>

          {/* SÉLECTEUR DE VUE */}
          <div style={{ display: 'flex', background: '#E2E8F0', padding: 3, borderRadius: 8 }}>
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: viewMode === mode ? '#FFFFFF' : 'transparent',
                  color: viewMode === mode ? '#0F172A' : '#64748B',
                }}
              >
                {mode === 'month' ? 'Mois' : mode === 'week' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>

          {/* MOIS & NAVIGATION */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: '2px 8px' }}>
            <button type="button" onClick={() => handleNavigate('prev')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>◀</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#334155', minWidth: 120, textAlign: 'center' }}>
              {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => handleNavigate('next')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>▶</button>
          </div>
        </div>
      </div>

      {/* KPIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 8, border: '1px solid #E2E8F0', borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>SALARIÉS ACTIFS</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {employees.length} <span style={{ fontSize: 13, fontWeight: 400, color: '#64748B' }}>personnes</span>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 8, border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>HEURES PLANIFIÉES</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {Math.round(totalPlannedHours)} h
          </div>
        </div>
      </div>

      {/* TABLEAU PLANNING */}
      <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #CBD5E1', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 950 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1' }}>
              <th style={{ padding: '12px 16px', width: 200, borderRight: '1px solid #CBD5E1', color: '#475569', fontSize: 13, fontWeight: 700 }}>
                SALARIÉ
              </th>
              {weekDays.map((day) => (
                <th key={day.toISOString()} style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: '#64748B' }}>
                    {day.toLocaleDateString('fr-FR', { weekday: 'short' })}.
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                    {day.getDate()}
                  </div>
                </th>
              ))}
              <th style={{ padding: '12px', width: 90, textAlign: 'center', color: '#475569', fontSize: 12, fontWeight: 700 }}>
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              let empTotalHours = 0

              return (
                <tr key={emp.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 16px', borderRight: '1px solid #CBD5E1', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: emp.avatarColor, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{emp.name}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{emp.role}</div>
                      </div>
                    </div>
                  </td>

                  {weekDays.map((day) => {
                    const dateKey = formatDateKey(day)
                    const shift = shifts.find((s) => s.employee_id === emp.id && s.date === dateKey)
                    const style = shift ? SHIFT_COLORS[shift.type] : null

                    if (shift && shift.type !== 'Repos' && shift.type !== 'Congé') {
                      empTotalHours += calculateShiftHours(shift.start_time, shift.end_time, shift.break_minutes)
                    }

                    return (
                      <td
                        key={dateKey}
                        onClick={() => handleCellClick(emp.id, dateKey)}
                        style={{ padding: 6, borderRight: '1px solid #E2E8F0', textAlign: 'center', cursor: 'pointer', height: 60 }}
                      >
                        {shift ? (
                          <div
                            style={{
                              background: style?.bg,
                              color: style?.color,
                              border: `1px solid ${style?.border}`,
                              padding: '4px 6px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                            }}
                          >
                            <span>{shift.type}</span>
                            {shift.type !== 'Repos' && shift.type !== 'Congé' && (
                              <span style={{ fontSize: 10, opacity: 0.85 }}>
                                {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 18, color: '#CBD5E1' }}>+</span>
                        )}
                      </td>
                    )
                  })}

                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#0F172A', background: '#F8FAFC' }}>
                    {empTotalHours.toFixed(1)} h
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL EXPORT & EMAIL */}
      {isEmailModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 12, width: '100%', maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, color: '#0F172A' }}>Exporter ou envoyer le planning</h3>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              Générez le fichier Excel de la semaine du {weekDays[0].toLocaleDateString('fr-FR')}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                type="button"
                onClick={handleDownloadExcel}
                style={{ padding: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#0F172A' }}
              >
                📥 Télécharger directement l'Excel
              </button>

              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #E2E8F0' }} />

              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>ENVOYER PAR E-MAIL</label>
              <input
                type="email"
                placeholder="destinataire@exemple.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                style={{ padding: 10, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14 }}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  style={{ flex: 1, padding: 10, border: '1px solid #CBD5E1', background: '#FFF', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isSending}
                  style={{ flex: 1, padding: 10, border: 'none', background: '#10B981', color: '#FFF', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  {isSending ? 'Envoi...' : 'Envoyer Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ÉDITION SHIFT */}
      {selectedCell && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 12, width: '100%', maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, color: '#0F172A' }}>
              {selectedCell.existingShift ? 'Modifier le créneau' : 'Affecter un créneau'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>TYPE DE CRENEAU</label>
                <select
                  value={modalShiftType}
                  onChange={(e) => setModalShiftType(e.target.value as Shift['type'])}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CBD5E1' }}
                >
                  <option value="Matin">Matin</option>
                  <option value="Aprem">Après-midi</option>
                  <option value="Nuit">Nuit</option>
                  <option value="Repos">Repos</option>
                  <option value="Congé">Congé</option>
                </select>
              </div>

              {modalShiftType !== 'Repos' && modalShiftType !== 'Congé' && (
                <>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>DÉBUT</label>
                      <input type="time" value={modalStart} onChange={(e) => setModalStart(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>FIN</label>
                      <input type="time" value={modalEnd} onChange={(e) => setModalEnd(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>PAUSE (MINUTES)</label>
                    <input type="number" value={modalBreak} onChange={(e) => setModalBreak(Number(e.target.value))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setSelectedCell(null)} style={{ flex: 1, padding: 10, border: '1px solid #CBD5E1', background: '#FFF', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  Annuler
                </button>
                <button type="button" onClick={handleSaveShift} style={{ flex: 1, padding: 10, border: 'none', background: '#0F172A', color: '#FFF', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default PlanningPage