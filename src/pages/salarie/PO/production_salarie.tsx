import React, { useEffect, useState, useMemo, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

type FamilleProduit = {
  id: string | number
  nom?: string
  famille?: string
  categorie?: string
  category?: string
}
export type DLCEnum = 'J' | 'J+1' | 'J+2' | 'J+3' | 'J+4' | 'J+5' | 'J+6' | 'J+7'

type ProductionItem = {
  id: string
  famille_id?: string | number | null
  label?: string
  nom?: string
  name?: string
  libelle?: string
  quantity?: number
  quantite?: number
  dlc_date?: string | null
  dlc?: DLCEnum | null // <-- Remplacement de dlc_date par dlc
  unit?: string
  unite?: string
  famille_produits?: FamilleProduit | null
}

type SuiviItem = {
  id?: string
  production_id: string
  date_suivi: string
  relance: number
  perte: number
}

type CatalogItem = {
  id: string
  category: string
  family: string
  name: string
  dlc?: string
  defaultUnit?: string
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

const productionEndpoint = `${supabaseUrl}/rest/v1/production`
const suiviEndpoint = `${supabaseUrl}/rest/v1/suivi_production`

const getItemLabel = (p: ProductionItem): string => {
  return p.label || p.nom || p.name || p.libelle || `Produit #${p.id}`
}

const getItemCategory = (p: ProductionItem): string => {
  return p.famille_produits?.categorie || p.famille_produits?.category || 'Non classé'
}

const getItemFamily = (p: ProductionItem): string => {
  return p.famille_produits?.nom || p.famille_produits?.famille || 'Général'
}

const ProductionSalarie: React.FC = () => {
  const { session, loading: authLoading } = useAuth()

  // Contrôle du filtre de date
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([])
  const [suiviMap, setSuiviMap] = useState<Record<string, SuiviItem>>({})

  const [loading, setLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [showSuccess, setShowSuccess] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // États pour les saisies utilisateur
  const [relances, setRelances] = useState<Record<string, number | string>>({})
  const [pertes, setPertes] = useState<Record<string, number | string>>({})

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    } else {
      headers['Authorization'] = `Bearer ${supabaseKey}`
    }
    return headers
  }, [session])

  // Chargement simultané des références et du suivi pour la date sélectionnée
  const fetchData = useCallback(async () => {
    if (!supabaseUrl || !supabaseKey) {
      setError('⚠️ Configuration Supabase manquante dans le fichier .env.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const headers = getHeaders()

      // 1. Charger la table de référence 'production'
      const prodRes = await axios.get<ProductionItem[]>(
        `${productionEndpoint}?select=*,famille_produits(*)&order=created_at.desc`,
        { headers }
      )
      const prods = prodRes.data || []
      setProductionItems(prods)

      const catalogMap = new Map<string, CatalogItem>()
      prods.forEach((p) => {
        const prodName = getItemLabel(p)
        const key = prodName.trim().toLowerCase()

        if (!catalogMap.has(key)) {
          const rawDlc = p.dlc_date || p.dlc
          catalogMap.set(key, {
            id: String(p.id),
            category: getItemCategory(p),
            family: getItemFamily(p),
            name: prodName,
            dlc: p.dlc || 'J', // <-- Utilisation directe de la valeur ENUM
            defaultUnit: p.unit || p.unite || 'unités',
          })
        }
      })
      const fetchedCatalog = Array.from(catalogMap.values())
      setCatalog(fetchedCatalog)

      // 2. Charger le suivi pour la date sélectionnée (sans filtre créneau)
      const suiviRes = await axios.get<SuiviItem[]>(
        `${suiviEndpoint}?date_suivi=eq.${selectedDate}`,
        { headers }
      )
      const suiviRecords = suiviRes.data || []

      const currentSuiviMap: Record<string, SuiviItem> = {}
      const initialRelances: Record<string, number | string> = {}
      const initialPertes: Record<string, number | string> = {}

      suiviRecords.forEach((record) => {
        currentSuiviMap[record.production_id] = record
        initialRelances[record.production_id] = record.relance
        initialPertes[record.production_id] = record.perte
      })

      setSuiviMap(currentSuiviMap)
      setRelances(initialRelances)
      setPertes(initialPertes)
    } catch (err: any) {
      console.error('Erreur chargement Supabase :', err)
      const message = err?.response?.data?.message || err?.message || 'Erreur lors du chargement.'
      setError(`Erreur (${err?.response?.status || 'Réseau'}) : ${message}`)
    } finally {
      setLoading(false)
    }
  }, [getHeaders, selectedDate])

  useEffect(() => {
    if (!authLoading) {
      fetchData()
    }
  }, [authLoading, fetchData])

  // Détection des modifications
  const modifiedIds = useMemo(() => {
    const ids = new Set<string>()

    catalog.forEach((prod) => {
      const existingSuivi = suiviMap[prod.id]
      const initialRelance = existingSuivi?.relance ?? ''
      const initialPerte = existingSuivi?.perte ?? ''

      const currentRelance = relances[prod.id] ?? ''
      const currentPerte = pertes[prod.id] ?? ''

      if (
        String(initialRelance) !== String(currentRelance) ||
        String(initialPerte) !== String(currentPerte)
      ) {
        ids.add(prod.id)
      }
    })

    return Array.from(ids)
  }, [catalog, suiviMap, relances, pertes])

  const hasChanges = modifiedIds.length > 0

  // Sauvegarde globale avec conflit géré sur (production_id, date_suivi)
  const handleSaveAll = async () => {
    if (modifiedIds.length === 0) return

    setIsSaving(true)
    setError(null)
    setShowSuccess(false)

    try {
      const headers = {
        ...getHeaders(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      }

      const payload = modifiedIds.map((id) => {
        const relanceVal = relances[id] ?? 0
        const perteVal = pertes[id] ?? 0
        const existingSuivi = suiviMap[id]

        const itemPayload: Record<string, any> = {
          production_id: id,
          date_suivi: selectedDate,
          relance: relanceVal === '' ? 0 : Number(relanceVal),
          perte: perteVal === '' ? 0 : Number(perteVal),
        }

        if (existingSuivi?.id) {
          itemPayload.id = existingSuivi.id
        }

        return itemPayload
      })

      // Résolution du conflit ajustée sans creneau
      const saveEndpoint = `${suiviEndpoint}?on_conflict=production_id,date_suivi`

      const response = await axios.post<SuiviItem[]>(saveEndpoint, payload, { headers })

      if (response.data) {
        const updatedSuiviMap = { ...suiviMap }
        response.data.forEach((item) => {
          updatedSuiviMap[item.production_id] = item
        })
        setSuiviMap(updatedSuiviMap)
      }

      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      console.error('Erreur enregistrement suivi_production :', err)
      const detail = err?.response?.data?.message || err?.message || 'Erreur inconnue'
      setError(`⚠️ Échec de l'enregistrement : ${detail}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (type: 'relance' | 'perte', prodId: string, value: string) => {
    const val = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0)
    if (type === 'relance') {
      setRelances((prev) => ({ ...prev, [prodId]: val }))
    } else {
      setPertes((prev) => ({ ...prev, [prodId]: val }))
    }
  }

  const productionMap = useMemo(() => {
    const map: Record<string, number> = {}
    productionItems.forEach((item) => {
      const label = getItemLabel(item)
      const qty = item.quantity ?? item.quantite ?? 0
      if (label) {
        const cleanLabel = label.trim().toLowerCase()
        map[cleanLabel] = (map[cleanLabel] || 0) + qty
      }
    })
    return map
  }, [productionItems])

  const totalProductionCount = useMemo(() => {
    return Object.values(productionMap).reduce((a, b) => a + b, 0)
  }, [productionMap])

  const groupedStructure = useMemo(() => {
    const hierarchy: Record<string, Record<string, CatalogItem[]>> = {}
    catalog.forEach((item) => {
      if (!hierarchy[item.category]) hierarchy[item.category] = {}
      if (!hierarchy[item.category][item.family]) hierarchy[item.category][item.family] = []
      hierarchy[item.category][item.family].push(item)
    })
    return hierarchy
  }, [catalog])

  if (authLoading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Vérification de l'accès...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ENTÊTE ET SÉLECTEUR DE DATE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
            📊 Suivi Annuel — Production & Relances
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: 14 }}>
            Historique du suivi journalier enregistré
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sélecteur de date */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              fontWeight: 600,
              color: '#0F172A',
              backgroundColor: '#FFFFFF',
            }}
          />

          {/* Bouton Actualiser */}
          <button
            type="button"
            onClick={fetchData}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            🔄 Actualiser
          </button>

          {/* Bouton Valider */}
          {hasChanges && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                backgroundColor: showSuccess ? '#10B981' : '#2563EB',
                color: '#FFFFFF',
                borderRadius: 8,
                border: 'none',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 13,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                transition: 'all 0.2s',
              }}
            >
              {isSaving ? '⏳ Enregistrement...' : showSuccess ? '✓ Validé !' : `💾 Valider (${modifiedIds.length})`}
            </button>
          )}
        </div>
      </div>

      {/* KPIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 10, border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Produit</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {totalProductionCount} <span style={{ fontSize: 13, color: '#64748B', fontWeight: 400 }}>unités</span>
          </div>
        </div>
      </div>

      {loading && <div style={{ marginBottom: 12, color: '#3B82F6', fontWeight: 500 }}>⏳ Chargement du suivi...</div>}
      {error && <div style={{ marginBottom: 12, color: '#DC2626', fontWeight: 500, padding: 12, background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}

      {/* TABLEAU */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Catégorie</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Famille</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Produit</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Production</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>DLC</th>
                <th style={{ padding: '12px 16px', color: '#0284C7', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Relance</th>
                <th style={{ padding: '12px 16px', color: '#DC2626', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Perte</th>
                <th style={{ padding: '12px 16px', color: '#059669', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Reste</th>
              </tr>
            </thead>

            <tbody>
              {!loading && catalog.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                    ⚠️ Aucun produit trouvé dans la base de données.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedStructure).map(([catName, families]) => {
                  const totalCatRows = Object.values(families).reduce((sum, items) => sum + items.length, 0)
                  let isFirstCatRow = true

                  return Object.entries(families).map(([familyName, itemsList]) => {
                    let isFirstFamilyRow = true

                    return itemsList.map((prod) => {
                      const qtyProduced = productionMap[prod.name.trim().toLowerCase()] || 0
                      const relanceNum = Number(relances[prod.id] || 0)
                      const perteNum = Number(pertes[prod.id] || 0)

                      const reste = Math.max(0, qtyProduced + relanceNum - perteNum)

                      const renderCategoryCell = isFirstCatRow
                      const renderFamilyCell = isFirstFamilyRow

                      isFirstCatRow = false
                      isFirstFamilyRow = false

                      return (
                        <tr key={prod.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          {renderCategoryCell && (
                            <td rowSpan={totalCatRows} style={{ padding: '16px', borderRight: '1px solid #E2E8F0', fontWeight: 700, fontSize: 12, color: '#1E293B', verticalAlign: 'top', background: '#FAFAFA' }}>
                              {catName}
                            </td>
                          )}

                          {renderFamilyCell && (
                            <td rowSpan={itemsList.length} style={{ padding: '12px 16px', borderRight: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13, color: '#475569', verticalAlign: 'top', background: '#F8FAFC' }}>
                              {familyName}
                            </td>
                          )}

                          <td style={{ padding: '10px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }}>{prod.name}</span>
                          </td>

                          <td style={{ padding: '10px 16px', textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>
                            {qtyProduced > 0 ? (
                              <span style={{ background: '#D1FAE5', color: '#065F46', padding: '4px 10px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
                                {qtyProduced} {prod.defaultUnit ?? ''}
                              </span>
                            ) : (
                              <span style={{ color: '#CBD5E1', fontSize: 13 }}>-</span>
                            )}
                          </td>

                          <td style={{ padding: '10px 16px', textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>
                            {prod.dlc ? <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{prod.dlc}</span> : <span style={{ color: '#CBD5E1' }}>-</span>}
                          </td>

                          {/* Champ Relance */}
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={relances[prod.id] ?? ''}
                              onChange={(e) => handleInputChange('relance', prod.id, e.target.value)}
                              style={{ width: '55px', padding: '6px', textAlign: 'center', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 600 }}
                            />
                          </td>

                          {/* Champ Perte */}
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={pertes[prod.id] ?? ''}
                              onChange={(e) => handleInputChange('perte', prod.id, e.target.value)}
                              style={{ width: '55px', padding: '6px', textAlign: 'center', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 600 }}
                            />
                          </td>

                          {/* Calcul du Reste */}
                          <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
                            <span style={{ color: reste === 0 ? '#94A3B8' : '#059669', background: reste === 0 ? '#F1F5F9' : '#ECFDF5', padding: '4px 8px', borderRadius: 6 }}>
                              {reste}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  })
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ProductionSalarie