import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

// Types de données Supabase
type ProductionItem = {
  id: string
  user_id: string
  station_id?: string | null
  type: string
  quantity: number
  created_at: string
  profiles?: {
    full_name?: string
    email?: string
  } | null
}

type PeriodFilter = 'day' | 'week' | 'month' | 'all'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const productionEndpoint = `${supabaseUrl}/rest/v1/production`

const PRODUCT_CATALOG = [
  'Sandwich Classique (Jambon/Beurre)',
  'Sandwich Poulet / Crudités',
  'Sandwich Thon / Mayonnaise',
  'Sandwich Végétarien',
  'Panini Chaud Formage/Jambon',
  'Salade Ceasar',
  'Croissant au beurre',
  'Pain au chocolat',
  'Chausson aux pommes',
  'Baguette fraîche',
  'Hot-dog',
  'Part de Pizza',
  'Quiche Lorraine',
  'Muffin Chocolat',
  'Donut Glacé',
  'Cookie Pépite de Chocolat',
]

const ProductionPage: React.FC = () => {
  const { session, profile } = useAuth()

  const [items, setItems] = useState<ProductionItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState(PRODUCT_CATALOG[0])
  const [quantity, setQuantity] = useState<number>(1)

  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>('day')
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getHeaders = () => ({
    apikey: supabaseKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  })

  // Chargement des productions (avec jointure optionnelle sur les profils si configurée)
  const loadProductionHistory = async () => {
    try {
      const response = await axios.get<ProductionItem[]>(
        `${productionEndpoint}?select=*,profiles(full_name,email)&order=created_at.desc&limit=200`,
        { headers: getHeaders() }
      )
      setItems(response.data || [])
    } catch (err: any) {
      console.error('Erreur chargement des productions:', err)
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setMessage({
          type: 'error',
          text: "La table 'production' est introuvable sur Supabase.",
        })
      }
    }
  }

  useEffect(() => {
    if (session) {
      loadProductionHistory()
    }
  }, [session])

  // Soumission d'une nouvelle production
  const handleAddProduction = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!profile) {
      setMessage({ type: 'error', text: 'Veuillez vous connecter pour enregistrer une production.' })
      return
    }

    if (quantity <= 0) {
      setMessage({ type: 'error', text: 'La quantité doit être supérieure à 0.' })
      return
    }

    setLoading(true)
    setMessage(null)

    const payload = {
      user_id: profile.id,
      station_id: profile.station_id ?? null,
      type: selectedProduct,
      quantity: Number(quantity),
    }

    try {
      await axios.post(productionEndpoint, payload, { headers: getHeaders() })
      setMessage({ type: 'success', text: `Enregistré : ${quantity}x ${selectedProduct}` })
      setQuantity(1)
      await loadProductionHistory()
    } catch (err: any) {
      const errorMsg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : 'Erreur lors de l’enregistrement'
      setMessage({ type: 'error', text: errorMsg })
    } finally {
      setLoading(false)
    }
  }

  // Calculs statistiques (Aujourd'hui, Semaine, Mois)
  const stats = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const startOfWeek = new Date(now)
    const dayOfWeek = now.getDay() || 7
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1)
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfWeekTime = startOfWeek.getTime()

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    let todayTotal = 0
    let weekTotal = 0
    let monthTotal = 0

    items.forEach((item) => {
      const itemTime = new Date(item.created_at).getTime()
      if (itemTime >= startOfDay) todayTotal += item.quantity
      if (itemTime >= startOfWeekTime) weekTotal += item.quantity
      if (itemTime >= startOfMonth) monthTotal += item.quantity
    })

    return { todayTotal, weekTotal, monthTotal }
  }, [items])

  // Filtrage des éléments selon la période choisie et la recherche
  const filteredItems = useMemo(() => {
    const now = new Date()

    return items.filter((item) => {
      const itemDate = new Date(item.created_at)

      // Filtre temporel
      if (filterPeriod === 'day') {
        const isToday =
          itemDate.getDate() === now.getDate() &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        if (!isToday) return false
      } else if (filterPeriod === 'week') {
        const startOfWeek = new Date(now)
        const dayOfWeek = now.getDay() || 7
        startOfWeek.setDate(now.getDate() - dayOfWeek + 1)
        startOfWeek.setHours(0, 0, 0, 0)
        if (itemDate.getTime() < startOfWeek.getTime()) return false
      } else if (filterPeriod === 'month') {
        const isThisMonth =
          itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()
        if (!isThisMonth) return false
      }

      // Filtre texte (recherche produit ou utilisateur)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase()
        const userName = item.profiles?.full_name?.toLowerCase() || ''
        const productName = item.type.toLowerCase()
        return productName.includes(query) || userName.includes(query)
      }

      return true
    })
  }, [items, filterPeriod, searchQuery])

  // Top produits fabriqués sur la période sélectionnée
  const topProducts = useMemo(() => {
    const map: Record<string, number> = {}
    filteredItems.forEach((item) => {
      map[item.type] = (map[item.type] || 0) + item.quantity
    })

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [filteredItems])

  const maxProductQty = topProducts[0]?.[1] || 1

  return (
    <div className="app-container" style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      {/* EN-TÊTE PAGE */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#0F172A' }}>
          Tableau de Bord Production
        </h1>
        <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: 14 }}>
          Saisie en temps réel et suivi analytique de la fabrication en station
        </p>
      </div>

      {/* 1. CARTES D'INDICATEURS CLÉS (KPIs) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
            Aujourd'hui
          </span>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#2563EB', marginTop: 4 }}>
            {stats.todayTotal}{' '}
            <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>unités</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
            Cette Semaine
          </span>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#059669', marginTop: 4 }}>
            {stats.weekTotal}{' '}
            <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>unités</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
            Ce Mois
          </span>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {stats.monthTotal}{' '}
            <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>unités</span>
          </div>
        </div>
      </div>

      {/* 2. FORMULAIRE DE SAISIE ET TOP PRODUITS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
          marginBottom: 28,
        }}
      >
        {/* FORMULAIRE DE SAISIE */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
            Nouvelle entrée de production
          </h3>

          <form onSubmit={handleAddProduction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#475569' }}>
                Sélectionner un produit
              </label>
              <select
                className="control"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              >
                {PRODUCT_CATALOG.map((prod, idx) => (
                  <option key={idx} value={prod}>
                    {prod}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#475569' }}>
                Quantité préparée
              </label>
              <input
                className="control"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                padding: '12px',
                borderRadius: 8,
                backgroundColor: '#2563EB',
                color: '#FFF',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              {loading ? 'Enregistrement en cours...' : 'Valider la fabrication'}
            </button>
          </form>

          {message && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: message.type === 'success' ? '#15803D' : '#B91C1C',
              }}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* CLASSEMENT VISUEL TOP PRODUITS */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
            Top 5 des fabrications ({filterPeriod === 'day' ? "Aujourd'hui" : filterPeriod === 'week' ? 'Cette semaine' : 'Ce mois'})
          </h3>

          {topProducts.length === 0 ? (
            <div style={{ color: '#64748B', fontSize: 14 }}>Aucune donnée disponible pour cette période.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topProducts.map(([name, qty]) => {
                const percentage = Math.round((qty / maxProductQty) * 100)
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, color: '#1E293B' }}>{name}</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{qty} u.</span>
                    </div>
                    <div style={{ height: 8, width: '100%', backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percentage}%`,
                          backgroundColor: '#2563EB',
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. HISTORIQUE AVEC FILTRES & RECHERCHE */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '20px',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Historique des relances ({filteredItems.length})
          </h3>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* BARRE DE RECHERCHE */}
            <input
              type="text"
              placeholder="Rechercher produit ou agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                minWidth: 200,
              }}
            />

            {/* BOUTONS FILTRE PÉRIODE */}
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: 3, borderRadius: 8 }}>
              {(
                [
                  { key: 'day', label: 'Jour' },
                  { key: 'week', label: 'Semaine' },
                  { key: 'month', label: 'Mois' },
                  { key: 'all', label: 'Tout' },
                ] as { key: PeriodFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterPeriod(tab.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: filterPeriod === tab.key ? 600 : 400,
                    backgroundColor: filterPeriod === tab.key ? '#FFFFFF' : 'transparent',
                    color: filterPeriod === tab.key ? '#0F172A' : '#64748B',
                    boxShadow: filterPeriod === tab.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TABLEAU / LISTE DES ENRAGISTREMENTS */}
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748B', fontSize: 14 }}>
            Aucune saisie trouvée pour les critères sélectionnés.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredItems.map((it) => {
              const operatorName = it.profiles?.full_name || `Utilisateur (${it.user_id.slice(0, 8)}...)`
              const formattedDate = new Date(it.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
              })
              const formattedTime = new Date(it.created_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: 8,
                    border: '1px solid #F1F5F9',
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontSize: 15 }}>
                      {it.type}
                    </span>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748B' }}>
                      <span>
                        Saisi par : <strong>{operatorName}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Le {formattedDate} à {formattedTime}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: '#1E40AF',
                      backgroundColor: '#DBEAFE',
                      padding: '4px 14px',
                      borderRadius: 20,
                    }}
                  >
                    +{it.quantity}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductionPage