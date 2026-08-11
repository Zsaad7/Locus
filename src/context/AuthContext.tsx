import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Profile = {
  id: string
  full_name: string
  role: 'responsable' | 'salarie'
  shift: 'matin' | 'apres_midi' | 'nuit' | null
  points: number
  station_id: string | null
  access_code: string | null
}

const AuthContext = createContext<any>(null)

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [station, setStation] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    }).catch(() => setLoading(false))
    const listener = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => {
      try { listener?.data?.subscription?.unsubscribe() } catch (e) {}
    }
  }, [])

  useEffect(() => {
    async function loadProfile() {
      setError(null)
      if (!session?.user) {
        setProfile(null)
        setStation(null)
        return
      }
      const uid = session.user.id
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
      setProfile(data)
      if (data?.station_id) {
        const { data: s } = await supabase.from('stations').select('*').eq('id', data.station_id).single()
        setStation(s)
      }
    }
    loadProfile()
  }, [session])

  const signUp = async (fullName: string, password: string) => {
    setError(null)
    const { data: code, error: rpcError } = await supabase.rpc('next_access_code')
    if (rpcError || !code) {
      const message = rpcError?.message ?? 'Erreur de génération du code d\'accès.'
      setError(message)
      return { error: rpcError, code: null }
    }

    const email = `${code}@locus.local`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, access_code: code } }
    })
    if (error) {
      setError(error.message)
      return { error, code: null }
    }
    return { data, code }
  }

  const signInWithCode = async (code: string, password: string) => {
    setError(null)
    const email = `${code}@locus.local`
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      return { error }
    }
    return { data }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setStation(null)
  }

  return (
    <AuthContext.Provider value={{ session, profile, station, loading, error, signUp, signInWithCode, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
