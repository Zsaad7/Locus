import React, { useEffect, useState, useMemo, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

// Type de la table 'famille_produits'
type FamilleProduit = {
  id: string | number
  nom?: string          // Ex: "Sandwich"
  famille?: string      // Ex: "Sandwich"
  categorie?: string    // Ex: "Sandwich et Pizza"
  category?: string
}

// Type de la table 'production' avec la jointure Supabase
type ProductionItem = {
  id: string | number
  famille_id?: string | number | null
  label?: string
  nom?: string
  name?: string
  libelle?: string
  quantity?: number
  quantite?: number
  dlc_date?: string | null
  dlc?: string | null
  relance?: number | null
  perte?: number | null
  created_at?: string
  unit?: string
  unite?: string
  // Relation venant de la table famille_produits
  famille_produits?: FamilleProduit | null
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

// Helpers pour extraire dynamiquement les valeurs
const getItemLabel = (p: ProductionItem): string => {
  return p.label || p.nom || p.name || p.libelle || `Produit #${p.id}`
}

const getItemCategory = (p: ProductionItem): string => {
  return (
    p.famille_produits?.categorie ||
    p.famille_produits?.category ||
    'Non classé'
  )
}

const getItemFamily = (p: ProductionItem): string => {
  return (
    p.famille_produits?.nom ||
    p.famille_produits?.famille ||
    'Général'
  )
}

const ProductionSalarie: React.FC = () => {
  const { session, loading: authLoading } = useAuth()

  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [items, setItems] = useState<ProductionItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [relances, setRelances] = useState<Record<string, number | string>>({})
  const [pertes, setPertes] = useState<Record<string, number | string>>({})

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    } else {
      headers['Authorization'] = `Bearer ${supabaseKey}`
    }
    return headers
  }, [session])

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

      // 🔍 MODIFICATION MAJEURE : On sélectionne tout depuis 'production'
      // + les champs liés dans 'famille_produits' via la clé étrangère famille_id
      const query = `${productionEndpoint}?select=*,famille_produits(*)&order=created_at.desc`

      const response = await axios.get<ProductionItem[]>(query, { headers })
      const allData = response.data || []

      console.log('📦 Données enrichies reçues depuis Supabase :', allData)

      setItems(allData)

      // Construction du catalogue basé sur les données de la jointure
      const catalogMap = new Map<string, CatalogItem>()

      allData.forEach((p) => {
        const prodName = getItemLabel(p)
        const key = prodName.trim().toLowerCase()

        if (!catalogMap.has(key)) {
          const rawDlc = p.dlc_date || p.dlc
          catalogMap.set(key, {
            id: String(p.id),
            category: getItemCategory(p),
            family: getItemFamily(p),
            name: prodName,
            dlc: rawDlc ? new Date(rawDlc).toLocaleDateString('fr-FR') : '',
            defaultUnit: p.unit || p.unite || 'unités',
          })
        }
      })

      const fetchedCatalog = Array.from(catalogMap.values())
      setCatalog(fetchedCatalog)

      // Initialisation des relances et pertes
      const initialRelances: Record<string, number | string> = {}
      const initialPertes: Record<string, number | string> = {}

      allData.forEach((row) => {
        const rowName = getItemLabel(row)
        const prod = fetchedCatalog.find(
          (p) => p.name.trim().toLowerCase() === rowName.trim().toLowerCase()
        )
        if (prod) {
          if (row.relance !== undefined && row.relance !== null) initialRelances[prod.id] = row.relance
          if (row.perte !== undefined && row.perte !== null) initialPertes[prod.id] = row.perte
        }
      })

      setRelances(initialRelances)
      setPertes(initialPertes)

    } catch (err: any) {
      console.error('Erreur Supabase/Axios :', err)
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Erreur lors du chargement des données.'
      setError(`Erreur (${err?.response?.status || 'Réseau'}) : ${message}`)
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  useEffect(() => {
    if (!authLoading) {
      fetchData()
    }
  }, [authLoading, fetchData])

  const productionMap = useMemo(() => {
    const map: Record<string, number> = {}
    items.forEach((item) => {
      const label = getItemLabel(item)
      const qty = item.quantity ?? item.quantite ?? 0
      if (label) {
        const cleanLabel = label.trim().toLowerCase()
        map[cleanLabel] = (map[cleanLabel] || 0) + qty
      }
    })
    return map
  }, [items])

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

  const handleInputChange = (type: 'relance' | 'perte', prodId: string, value: string) => {
    const val = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0)
    if (type === 'relance') {
      setRelances((prev) => ({ ...prev, [prodId]: val }))
    } else {
      setPertes((prev) => ({ ...prev, [prodId]: val }))
    }
  }

  if (authLoading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Vérification de l'accès...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ENTÊTE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
            📊 Suivi de Production & Relances
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: 14 }}>
            Saisie du {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

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
      </div>

      {/* KPIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 10, border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Produit aujourd'hui</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {totalProductionCount} <span style={{ fontSize: 13, color: '#64748B', fontWeight: 400 }}>unités</span>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: 10, border: '1px solid #E2E8F0', borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Références Traitées</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {Object.keys(productionMap).length} <span style={{ fontSize: 13, color: '#64748B', fontWeight: 400 }}>/ {catalog.length}</span>
          </div>
        </div>
      </div>

      {loading && <div style={{ marginBottom: 12, color: '#3B82F6', fontWeight: 500 }}>⏳ Chargement des données...</div>}
      {error && <div style={{ marginBottom: 12, color: '#DC2626', fontWeight: 500, padding: 12, background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}

      {/* TABLEAU */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 850 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Catégorie</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Famille</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Produit</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight : 700, textTransform: 'uppercase', textAlign: 'center' }}>Production</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>DLC</th>
                <th style={{ padding: '12px 16px', color: '#0284C7', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Relance</th>
                <th style={{ padding: '12px 16px', color: '#DC2626', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Perte</th>
              </tr>
            </thead>

            <tbody>
              {!loading && catalog.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: 14 }}>
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
                      const qtyProduced = productionMap[prod.name.trim().toLowerCase()]
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
                            {qtyProduced !== undefined && qtyProduced > 0 ? (
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

                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={pertes[prod.id] ?? ''}
                              onChange={(e) => handleInputChange('perte', prod.id, e.target.value)}
                              style={{ width: '55px', padding: '6px', textAlign: 'center', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 600 }}
                            />
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