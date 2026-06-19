// Authentication state: holds the current user and exposes login/register/
// logout. On mount it validates any stored token by loading /auth/me.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from './api'
import type { User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  setUser: (user: User) => void
  login: (identifier: string, password: string) => Promise<void>
  register: (data: {
    email: string
    username: string
    password: string
    invite_code?: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // A 401 anywhere (expired/invalid token) drops us back to the login screen.
    api.setUnauthorizedHandler(() => setUser(null))
    if (!api.getToken()) {
      setLoading(false)
      return
    }
    api
      .getMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    setUser,
    login: async (identifier, password) => setUser(await api.login(identifier, password)),
    register: async (data) => setUser(await api.register(data)),
    logout: () => {
      api.logout()
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
