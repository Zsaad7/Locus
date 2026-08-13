import React, { useEffect, useState, useMemo, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

type ProductionItem = {
  id: string
  user_id: string
  station_id?: string | null
  type: string
  quantity: number
  created_at: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const productionEndpoint = `${supabaseUrl}/rest/v1/production`

const ProductionSalarie: React.FC = () => {
  const { session, loading: authLoading } = useAuth() // <-- Récupération du chargement d'auth
  const [items, setItems] = useState<ProductionItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState<string>('')

  const getHeaders = useCallback(() => ({
    apikey: supabaseKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
    'Content-Type': 'application/json',
  }), [session])

  const fetchTodayProduction = useCallback(async () => {
    setLoading(true)
    setError(null)

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()

    try {
      const response = await axios.get<ProductionItem[]>(
        `${productionEndpoint}?created_at=gte.${startOfDay}&created_at=lte.${endOfDay}&order=created_at.desc`,
        { headers: getHeaders() }
      )
      setItems(response.data || [])
    } catch (err: any) {
      console.error('Erreur lors du chargement de la production du jour:', err)
      setError('Impossible de charger les données de production.')
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  useEffect(() => {
    // N'exécuter que si l'authentification a fini de charger et qu'une session existe
    if (!authLoading && session) {
      fetchTodayProduction()
    }
  }, [session, authLoading, fetchTodayProduction])

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.type.toLowerCase().includes(searchFilter.toLowerCase())
    )
  }, [items, searchFilter])

  const totalsByProduct = useMemo(() => {
    const map: { [product: string]: number } = {}
    items.forEach((item) => {
      map[item.type] = (map[item.type] || 0) + item.quantity
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [items])

  const totalQuantityToday = useMemo(() => {
    return items.reduce((acc, item) => acc + item.quantity, 0)
  }, [items])

  if (authLoading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Vérification de l'accès...</div>
  }

  return (
    <div className="app-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0F172A' }}>
            📊 Production du jour
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: 14 }}>
            Aperçu en temps réel des préparations du {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTodayProduction}
          className="btn-primary"
          style={{
            padding: '8px 16px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          🔄 Actualiser
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #10B981', backgroundColor: '#FFFFFF', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Total Unités Produites</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {totalQuantityToday} <span style={{ fontSize: 14, fontWeight: 400, color: '#64748B' }}>pcs</span>
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: '4px solid #3B82F6', backgroundColor: '#FFFFFF', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Variétés de Produits</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            {totalsByProduct.length} <span style={{ fontSize: 14, fontWeight: 400, color: '#64748B' }}>références</span>
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: '4px solid #8B5CF6', backgroundColor: '#FFFFFF', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Dernière Saisie</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginTop: 8 }}>
            {items.length > 0
              ? new Date(items[0].created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : 'Aucune'}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 24, backgroundColor: '#FFFFFF', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, color: '#0F172A' }}>
          📦 Total Cumulé par Produit
        </h3>

        {totalsByProduct.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 14 }}>Aucun produit préparé aujourd'hui.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {totalsByProduct.map(([productName, qty]) => (
              <div
                key={productName}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0'
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {productName}
                </span>
                <span
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 700
                  }}
                >
                  x{qty}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20, backgroundColor: '#FFFFFF', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>
            ⏱️ Historique des ajouts du jour
          </h3>

          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              fontSize: 14,
              minWidth: 220
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B' }}>Chargement des données...</div>
        ) : error ? (
          <div style={{ color: '#DC2626', padding: '12px', backgroundColor: '#FEE2E2', borderRadius: 6 }}>{error}</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 14, padding: '16px 0' }}>
            {searchFilter ? 'Aucun résultat trouvé pour cette recherche.' : 'Aucun enregistrement pour le moment aujourd’hui.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 15 }}>{item.type}</div>
                  <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
                    Saisi à{' '}
                    <strong>
                      {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#059669',
                    backgroundColor: '#D1FAE5',
                    padding: '6px 14px',
                    borderRadius: 20
                  }}
                >
                  +{item.quantity}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductionSalarie