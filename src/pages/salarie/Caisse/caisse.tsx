import React, { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

const INITIAL_FDJ_GAMES = [
  'X20',
  'CASH',
  'MOTS CROISES',
  'LA CIBLE',
  'MILLIONNAIRE',
  'GOAL',
  'ASTRO',
  'BLACK JACK',
  'TAROT DIVINATION',
  'EMERAUDE RUBIS',
]

type FdjItem = {
  game: string
  start: number
  end: number
  isCustom?: boolean
  isApproved?: boolean
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const shiftEndpoint = `${supabaseUrl}/rest/v1/shift_control`

const CaissePage: React.FC = () => {
  const { session, profile } = useAuth()

  const [employeeName, setEmployeeName] = useState(profile?.full_name || '')
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 16))

  const [fdjList, setFdjList] = useState<FdjItem[]>(
    INITIAL_FDJ_GAMES.map((game) => ({
      game,
      start: 0,
      end: 0,
      isCustom: false,
      isApproved: true,
    }))
  )

  const [newGameName, setNewGameName] = useState('')

  const [coffre1, setCoffre1] = useState<number>(0)
  const [coffre2, setCoffre2] = useState<number>(0)
  const [billetsCloture, setBilletsCloture] = useState<number>(0)
  const [monnaieCloture, setMonnaieCloture] = useState<number>(0)

  // Nouveaux états pour le PSP (Montant + Ticket Image)
  const [pspAmount, setPspAmount] = useState<number | ''>('')
  const [pspImageFile, setPspImageFile] = useState<File | null>(null)
  const [pspImagePreview, setPspImagePreview] = useState<string | null>(null)

  const [retourProduits, setRetourProduits] = useState<string>('')
  const [incidents, setIncidents] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleFdjChange = (index: number, field: 'start' | 'end', value: number) => {
    const updated = [...fdjList]
    updated[index][field] = Math.max(0, value)
    setFdjList(updated)
  }

  const handleAddGame = () => {
    const trimmed = newGameName.trim()
    if (!trimmed) return
    if (fdjList.some((item) => item.game.toLowerCase() === trimmed.toLowerCase())) {
      alert('Ce jeu existe déjà dans la liste.')
      return
    }

    setFdjList([
      ...fdjList,
      {
        game: trimmed.toUpperCase(),
        start: 0,
        end: 0,
        isCustom: true,
        isApproved: false,
      },
    ])
    setNewGameName('')
  }

  const handleRemoveGame = (index: number) => {
    setFdjList(fdjList.filter((_, idx) => idx !== index))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPspImageFile(file)
      setPspImagePreview(URL.createObjectURL(file))
    }
  }

  const uploadPspTicket = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_psp_${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${fileName}`

    try {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/tickets-psp/${filePath}`
      await axios.post(uploadUrl, file, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
          'Content-Type': file.type,
        },
      })

      return `${supabaseUrl}/storage/v1/object/public/tickets-psp/${filePath}`
    } catch (err) {
      console.error('Erreur lors de l upload du ticket PSP:', err)
      return null
    }
  }

  const getHeaders = () => ({
    apikey: supabaseKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      let pspTicketUrl: string | null = null

      if (pspImageFile) {
        pspTicketUrl = await uploadPspTicket(pspImageFile)
      }

      const payload = {
        user_id: profile?.id,
        station_id: profile?.station_id ?? null,
        employee_name: employeeName,
        shift_date: shiftDate,
        fdj_control: fdjList,
        remise_coffre_1: Number(coffre1),
        remise_coffre_2: Number(coffre2),
        montant_billets_cloture: Number(billetsCloture),
        montant_monnaie_cloture: Number(monnaieCloture),
        total_especes_cloture: Number(billetsCloture) + Number(monnaieCloture),
        psp_amount: pspAmount !== '' ? Number(pspAmount) : 0,
        psp_ticket_url: pspTicketUrl,
        retour_produit: retourProduits,
        incidents,
        created_at: new Date().toISOString(),
      }

      await axios.post(shiftEndpoint, payload, { headers: getHeaders() })
      setMessage({ type: 'success', text: 'Contrôle de quart et clôture validés avec succès !' })
    } catch (err: any) {
      console.error(err)
      setMessage({
        type: 'error',
        text: "Erreur lors de la validation. Vérifiez la connexion ou la table 'shift_control'.",
      })
    } finally {
      setLoading(false)
    }
  }

  const totalEspeces = Number(billetsCloture) + Number(monnaieCloture)
  const totalRemises = Number(coffre1) + Number(coffre2)
  const totalFdjVendus = fdjList.reduce((acc, curr) => acc + Math.max(0, curr.start - curr.end), 0)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#0F172A' }}>
      
      {/* En-tête principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📑</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Contrôle de Quart & Clôture de Caisse
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 34px', color: '#64748B', fontSize: 13.5 }}>
            Saisie numérique et contrôle de fin de service
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: '#F1F5F9', padding: '8px 14px', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0' }}>
            <span style={{ color: '#64748B' }}>Total Ventes FDJ : </span>
            <strong style={{ color: '#2563EB' }}>{totalFdjVendus} ticket{totalFdjVendus > 1 ? 's' : ''}</strong>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        
        {/* Section 1 : Informations Opérateur */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: 20,
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Nom & Prénom
            </label>
            <input
              type="text"
              required
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Ex: Jean Dupont"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 14,
                outline: 'none',
                backgroundColor: '#F8FAFC',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Date & Heure du Shift
            </label>
            <input
              type="datetime-local"
              required
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 14,
                outline: 'none',
                backgroundColor: '#F8FAFC',
              }}
            />
          </div>
        </div>

        {/* Section 2 : FDJ & Comptabilité */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20, marginBottom: 20 }}>
          
          {/* Bloc FDJ */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                🎰 Contrôle FDJ (Jeux à gratter)
              </h3>
              <span style={{ fontSize: 12, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                {fdjList.length} Jeux
              </span>
            </div>

            <div style={{ padding: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '8px 12px' }}>Jeu</th>
                    <th style={{ padding: '8px 12px', width: 95 }}>Début</th>
                    <th style={{ padding: '8px 12px', width: 95 }}>Fin</th>
                    <th style={{ padding: '8px 12px', width: 70, textAlign: 'right' }}>Vendus</th>
                    <th style={{ padding: '8px 4px', width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {fdjList.map((item, idx) => {
                    const vendus = Math.max(0, item.start - item.end)
                    return (
                      <tr key={`${item.game}-${idx}`} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: item.isCustom ? '#FEFCE8' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155' }}>
                          {item.game}
                          {item.isCustom && (
                            <span style={{ display: 'block', fontSize: 10, color: '#D97706', fontWeight: 500 }}>
                              ⏳ En attente de validation
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="number"
                            min={0}
                            value={item.start}
                            onChange={(e) => handleFdjChange(idx, 'start', parseInt(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 6,
                              border: '1px solid #CBD5E1',
                              fontSize: 13,
                              textAlign: 'center'
                            }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="number"
                            min={0}
                            value={item.end}
                            onChange={(e) => handleFdjChange(idx, 'end', parseInt(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 6,
                              border: '1px solid #CBD5E1',
                              fontSize: 13,
                              textAlign: 'center'
                            }}
                          />
                        </td>
                        <td style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: vendus > 0 ? '#2563EB' : '#94A3B8',
                          fontSize: 14
                        }}>
                          {vendus}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveGame(idx)}
                              style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontWeight: 700 }}
                              title="Supprimer ce jeu"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E2E8F0' }}>
                <input
                  type="text"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder="Nom du nouveau jeu..."
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={handleAddGame}
                  style={{
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </div>

          {/* Bloc Comptabilité & Divers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: 20 }}>
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 15, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💰</span> Remises Coffres & Espèces
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                    Remise Coffre 1 (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={coffre1}
                    onChange={(e) => setCoffre1(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                    Remise Coffre 2 (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={coffre2}
                    onChange={(e) => setCoffre2(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                    Billets Clôture (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={billetsCloture}
                    onChange={(e) => setBilletsCloture(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                    Monnaie Clôture (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={monnaieCloture}
                    onChange={(e) => setMonnaieCloture(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)', padding: '16px', borderRadius: 10, border: '1px solid #BFDBFE' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 6 }}>
                  <span>Total Remises Coffres :</span>
                  <strong style={{ color: '#0F172A' }}>{totalRemises.toFixed(2)} €</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 700, color: '#059669', paddingTop: 6 }}>
                  <span>Total Caisse Clôture (Espèces) :</span>
                  <span style={{ fontSize: 18, background: '#DCFCE7', padding: '2px 10px', borderRadius: 6, border: '1px solid #86EFAC' }}>
                    {totalEspeces.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>

            {/* Section Incidents & Remarques Mise à jour avec Montant PSP + Photo */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: 20 }}>
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 15, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📝</span> Incidents & Remarques
              </h3>

              {/* Bloc PSP amélioré */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
                  💳 JUSTIFICATIF PSP
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                      Montant PSP (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={pspAmount}
                      onChange={(e) => setPspAmount(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 600, backgroundColor: '#FFFFFF' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                      Ticket PSP (Photo/Image)
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      backgroundColor: '#FFFFFF',
                      border: '1px dashed #0284C7',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0284C7'
                    }}>
                      📷 {pspImageFile ? 'Changer l\'image' : 'Prendre photo / Fichier'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>

                {/* Prévisualisation de l'image */}
                {pspImagePreview && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={pspImagePreview}
                      alt="Aperçu du ticket PSP"
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #CBD5E1' }}
                    />
                    <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>✓ Image jointe</span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                  Retour Produits
                </label>
                <input
                  type="text"
                  value={retourProduits}
                  onChange={(e) => setRetourProduits(e.target.value)}
                  placeholder="Saisir..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                  Incidents à signaler / Écarts
                </label>
                <textarea
                  rows={3}
                  value={incidents}
                  onChange={(e) => setIncidents(e.target.value)}
                  placeholder="Notez ici les écarts de caisse, erreurs de frappe, problèmes matériels..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, resize: 'vertical' }}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Pied de page */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            {message ? (
              <div style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: message.type === 'success' ? '#15803D' : '#B91C1C',
                border: message.type === 'success' ? '1px solid #86EFAC' : '1px solid #FCA5A5'
              }}>
                {message.type === 'success' ? '✓ ' : '⚠ '} {message.text}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: '#64748B' }}>
                Vérifiez bien l'ensemble des données avant validation.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(15,23,42,0.15)',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Validation en cours...' : 'Valider la clôture du shift'}
          </button>
        </div>

      </form>
    </div>
  )
}

export default CaissePage