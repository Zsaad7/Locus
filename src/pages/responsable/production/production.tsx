import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../context/AuthContext'

// Types
type ProductionItem = {
  id: string
  user_id: string
  station_id?: string | null
  type: string
  quantity: number
  created_at: string
}

// Variables d'environnement Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const productionEndpoint = `${supabaseUrl}/rest/v1/production`

// Catalogue des produits préparés en station
const PRODUCT_CATALOG = [
  // Sandwiches & Salades
  'Sandwich Classique (Jambon/Beurre)',
  'Sandwich Poulet / Crudités',
  'Sandwich Thon / Mayonnaise',
  'Sandwich Végétarien',
  'Panini Chaud Formage/Jambon',
  'Salade Ceasar',

  // Viennoiseries & Boulangerie
  'Croissant au beurre',
  'Pain au chocolat',
  'Chausson aux pommes',
  'Baguette fraîche',

  // Snacking Chaud
  'Hot-dog',
  'Part de Pizza',
  'Quiche Lorraine',

  // Pâtisseries & Desserts
  'Muffin Chocolat',
  'Donut Glacé',
  'Cookie Pépite de Chocolat'
]

const ProductionPage: React.FC = () => {
  const { session, profile } = useAuth()
  
  const [items, setItems] = useState<ProductionItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState(PRODUCT_CATALOG[0])
  const [quantity, setQuantity] = useState<number>(1)
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // En-têtes pour Axios (Supabase REST API)
  const getHeaders = () => ({
    apikey: supabaseKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  })

  // 1. Charger l'historique des productions enregistrées
  const loadProductionHistory = async () => {
    try {
      const response = await axios.get<ProductionItem[]>(
        `${productionEndpoint}?select=*&order=created_at.desc&limit=50`,
        { headers: getHeaders() }
      )
      setItems(response.data || [])
    } catch (err: any) {
      console.error('Erreur lors du chargement des productions:', err)
      // Si la table n'existe pas encore côté Supabase :
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setMessage({
          type: 'error',
          text: "La table 'production' n'a pas été trouvée dans la base de données. Pensez à la créer.",
        })
      }
    }
  }

  useEffect(() => {
    if (session) {
      loadProductionHistory()
    }
  }, [session])

  // 2. Enregistrer une nouvelle production via Axios
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

      setMessage({ type: 'success', text: `Production ajoutée : ${quantity}x ${selectedProduct}` })
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

  return (
    <div className="app-container">
      {/* Saisie de la production */}
      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Suivi de production</h2>

        <form onSubmit={handleAddProduction} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="control"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            style={{ maxWidth: 360, flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
          >
            {PRODUCT_CATALOG.map((prod, idx) => (
              <option key={idx} value={prod}>
                {prod}
              </option>
            ))}
          </select>

          <input
            className="control"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: 90, padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ padding: '10px 20px', minWidth: 120 }}
          >
            {loading ? 'Ajout...' : 'Ajouter'}
          </button>
        </form>

        {/* Message d'état */}
        {message && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 14,
              backgroundColor: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: message.type === 'success' ? '#15803D' : '#B91C1C',
            }}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Liste des productions récentes */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Productions récentes</h3>

        {items.length === 0 ? (
          <div className="small" style={{ color: '#64748B' }}>
            Aucune production enregistrée.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  borderRadius: 6,
                  borderBottom: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{it.type}</div>
                  <div className="small" style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                    Ajouté le {new Date(it.created_at).toLocaleDateString('fr-FR')} à{' '}
                    {new Date(it.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 18,
                    color: '#0F172A',
                    backgroundColor: '#E2E8F0',
                    padding: '4px 12px',
                    borderRadius: 20,
                  }}
                >
                  +{it.quantity}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductionPage