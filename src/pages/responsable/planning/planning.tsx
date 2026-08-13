import React, { useState, useMemo } from 'react'

// --- TYPES ---
type ViewMode = 'month' | 'week' | 'day'

type Employee = {
  id: string
  name: string
  role: string
  avatarColor: string
}

type Shift = {
  id: string
  employeeId: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  type: 'Matin' | 'Aprem' | 'Nuit' | 'Repos'
}

// --- DONNÉES DE DÉMONSTRATION ---
const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Jean Dupont', role: 'Salarié Cuisine', avatarColor: '#3B82F6' },
  { id: '2', name: 'Marie Martin', role: 'Salarié Caisse', avatarColor: '#10B981' },
  { id: '3', name: 'Lucas Bernard', role: 'Salarié Polyvalent', avatarColor: '#8B5CF6' },
  { id: '4', name: 'Sophie Petit', role: 'Salarié DLC', avatarColor: '#F59E0B' },
]

const MOCK_SHIFTS: Shift[] = [
  { id: 's1', employeeId: '1', date: '2026-08-10', startTime: '06:00', endTime: '14:00', type: 'Matin' },
  { id: 's2', employeeId: '2', date: '2026-08-10', startTime: '14:00', endTime: '22:00', type: 'Aprem' },
  { id: 's3', employeeId: '3', date: '2026-08-10', startTime: '08:00', endTime: '16:00', type: 'Matin' },
  { id: 's4', employeeId: '4', date: '2026-08-10', startTime: '00:00', endTime: '00:00', type: 'Repos' },
  { id: 's5', employeeId: '1', date: '2026-08-11', startTime: '06:00', endTime: '14:00', type: 'Matin' },
]

// COULEURS DES SHIFTS EN STYLE BADGE EXCEL
const SHIFT_COLORS: Record<Shift['type'], { bg: string; color: string; border: string }> = {
  Matin: { bg: '#E0F2FE', color: '#0369A1', border: '#BAE6FD' },
  Aprem: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  Nuit: { bg: '#F3E8FF', color: '#6B21A8', border: '#E9D5FF' },
  Repos: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' },
}

const PlanningPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState<Date>(new Date('2026-08-10')) // Date pivot pour l'exemple
  const [shifts, setShifts] = useState<Shift[]>(MOCK_SHIFTS)
  
  // État pour la modale d'édition
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; date: string } | null>(null)
  const [modalShiftType, setModalShiftType] = useState<Shift['type']>('Matin')
  const [modalStart, setModalStart] = useState('08:00')
  const [modalEnd, setModalEnd] = useState('16:00')

  // --- LOGIQUE DE NAVIGATION DE DATE ---
  const handleNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  // Helper pour formater la date en YYYY-MM-DD
  const formatDateKey = (date: Date) => date.toISOString().split('T')[0]

  // Générer les jours de la semaine courante
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Lundi comme 1er jour
    startOfWeek.setDate(diff)

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [currentDate])

  // Enregistrer ou Mettre à jour un Shift
  const handleSaveShift = () => {
    if (!selectedCell) return

    const existingIndex = shifts.findIndex(
      (s) => s.employeeId === selectedCell.employeeId && s.date === selectedCell.date
    )

    const newShift: Shift = {
      id: existingIndex >= 0 ? shifts[existingIndex].id : Date.now().toString(),
      employeeId: selectedCell.employeeId,
      date: selectedCell.date,
      startTime: modalShiftType === 'Repos' ? '00:00' : modalStart,
      endTime: modalShiftType === 'Repos' ? '00:00' : modalEnd,
      type: modalShiftType,
    }

    if (existingIndex >= 0) {
      const updated = [...shifts]
      updated[existingIndex] = newShift
      setShifts(updated)
    } else {
      setShifts([...shifts, newShift])
    }

    setSelectedCell(null)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* 1. ENTÊTE & CONTRÔLES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
            📅 Planning des Salariés
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: 14 }}>
            Gestion de l'emploi du temps et des rotations d'équipe.
          </p>
        </div>

        {/* CONTROLES DE VUE & NAVIGATION */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* SÉLECTEUR DE VUE (Mois/Semaine/Jour) */}
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
                  boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize',
                }}
              >
                {mode === 'month' ? 'Mois' : mode === 'week' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>

          {/* FLÈCHES DE NAVIGATION */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: '2px 8px' }}>
            <button
              type="button"
              onClick={() => handleNavigate('prev')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 8px' }}
            >
              ◀
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#334155', minWidth: 140, textAlign: 'center' }}>
              {currentDate.toLocaleDateString('fr-FR', {
                month: 'long',
                year: 'numeric',
                ...(viewMode === 'day' ? { day: 'numeric' } : {}),
              })}
            </span>
            <button
              type="button"
              onClick={() => handleNavigate('next')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 8px' }}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* 2. STATISTIQUES RAPIDES (KPIS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 8, border: '1px solid #E2E8F0', borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>EFFECTIF ACTIF</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {MOCK_EMPLOYEES.length} <span style={{ fontSize: 13, fontWeight: 400, color: '#64748B' }}>salariés</span>
          </div>
        </div>
        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 8, border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>HEURES PLANIFIÉES (SEMAINE)</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            112 h
          </div>
        </div>
        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 8, border: '1px solid #E2E8F0', borderLeft: '4px solid #F59E0B' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>REPOS PRÉVUS</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {shifts.filter((s) => s.type === 'Repos').length} <span style={{ fontSize: 13, fontWeight: 400, color: '#64748B' }}>jours</span>
          </div>
        </div>
      </div>

      {/* 3. TABLEAU GRID STYLE EXCEL */}
      <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        {/* --- VUE SEMAINE (TABLEUR DÉTAILLÉ) --- */}
        {viewMode === 'week' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1' }}>
                  <th style={{ padding: '12px 16px', width: 220, borderRight: '1px solid #CBD5E1', color: '#475569', fontSize: 13, fontWeight: 700 }}>
                    SALARIÉ
                  </th>
                  {weekDays.map((day) => {
                    const isToday = formatDateKey(day) === formatDateKey(new Date())
                    return (
                      <th
                        key={day.toISOString()}
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          borderRight: '1px solid #E2E8F0',
                          background: isToday ? '#EFF6FF' : 'transparent',
                          color: isToday ? '#1D4ED8' : '#334155',
                        }}
                      >
                        <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: isToday ? '#2563EB' : '#64748B' }}>
                          {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          {day.getDate()}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {MOCK_EMPLOYEES.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    {/* Nom du salarié */}
                    <td style={{ padding: '12px 16px', borderRight: '1px solid #CBD5E1', background: '#FAFAFA' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: emp.avatarColor, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{emp.name}</div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>{emp.role}</div>
                        </div>
                      </div>
                    </td>

                    {/* Cellules des jours */}
                    {weekDays.map((day) => {
                      const dateKey = formatDateKey(day)
                      const shift = shifts.find((s) => s.employeeId === emp.id && s.date === dateKey)
                      const style = shift ? SHIFT_COLORS[shift.type] : null

                      return (
                        <td
                          key={dateKey}
                          onClick={() => setSelectedCell({ employeeId: emp.id, date: dateKey })}
                          style={{
                            padding: 8,
                            borderRight: '1px solid #E2E8F0',
                            textAlign: 'center',
                            cursor: 'pointer',
                            verticalAlign: 'middle',
                            height: 60,
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {shift ? (
                            <div
                              style={{
                                background: style?.bg,
                                color: style?.color,
                                border: `1px solid ${style?.border}`,
                                padding: '6px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                              }}
                            >
                              <span>{shift.type}</span>
                              {shift.type !== 'Repos' && (
                                <span style={{ fontSize: 10, opacity: 0.8 }}>
                                  {shift.startTime} - {shift.endTime}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 18, color: '#CBD5E1' }}>+</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- VUE JOURNÉE (DÉTAILS TIMELINE) --- */}
        {viewMode === 'day' && (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, color: '#0F172A' }}>
              Détail de la journée du {currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MOCK_EMPLOYEES.map((emp) => {
                const dateKey = formatDateKey(currentDate)
                const shift = shifts.find((s) => s.employeeId === emp.id && s.date === dateKey)
                const style = shift ? SHIFT_COLORS[shift.type] : null

                return (
                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: emp.avatarColor, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{emp.name}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{emp.role}</div>
                      </div>
                    </div>

                    <div>
                      {shift ? (
                        <span style={{ background: style?.bg, color: style?.color, border: `1px solid ${style?.border}`, padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                          {shift.type} {shift.type !== 'Repos' && `(${shift.startTime} - ${shift.endTime})`}
                        </span>
                      ) : (
                            <span style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>Non planifié</span>                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* --- VUE MOIS (SYNTHÈSE EN BREF) --- */}
        {viewMode === 'month' && (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Vue synthétique mensuelle</p>
            <p style={{ fontSize: 14 }}>Sélectionnez la vue <strong>Semaine</strong> pour éditer les créneaux avec précision.</p>
          </div>
        )}

      </div>

      {/* 4. MODALE DE SAISIE DE SHIFT */}
      {selectedCell && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, color: '#0F172A' }}>
              Affecter un créneau
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  TYPE DE CRENEAU
                </label>
                <select
                  value={modalShiftType}
                  onChange={(e) => setModalShiftType(e.target.value as Shift['type'])}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14 }}
                >
                  <option value="Matin">Matin</option>
                  <option value="Aprem">Après-midi</option>
                  <option value="Nuit">Nuit</option>
                  <option value="Repos">Repos</option>
                </select>
              </div>

              {modalShiftType !== 'Repos' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>DÉBUT</label>
                    <input
                      type="time"
                      value={modalStart}
                      onChange={(e) => setModalStart(e.target.value)}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>FIN</label>
                    <input
                      type="time"
                      value={modalEnd}
                      onChange={(e) => setModalEnd(e.target.value)}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  style={{ flex: 1, padding: 10, border: '1px solid #CBD5E1', background: '#FFF', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveShift}
                  style={{ flex: 1, padding: 10, border: 'none', background: '#0F172A', color: '#FFF', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
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