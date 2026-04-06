'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const AUTH_KEY = 'magaza-auth-v1'

export type MagazaAuthState = {
  phone: string
  name?: string
  email?: string
}

export type MagazaAuthModalMode = 'login' | 'register'

export type OpenAuthModalArg =
  | undefined
  | (() => void)
  | { onSuccess?: () => void; mode?: MagazaAuthModalMode }

export type MagazaAuthContextValue = {
  isAuthenticated: boolean
  phone: string | null
  name: string | null
  email: string | null
  login: (phone: string, profile?: { name?: string; email?: string }) => void
  logout: () => void
  showAuthModal: boolean
  authModalMode: MagazaAuthModalMode
  switchAuthModalMode: (mode: MagazaAuthModalMode) => void
  openAuthModal: (arg?: OpenAuthModalArg) => void
  closeAuthModal: () => void
  finishLoginFromModal: (phone: string) => void
  finishRegisterFromModal: (
    phone: string,
    profile: { name: string; email: string },
  ) => void
}

const MagazaAuthContext = createContext<MagazaAuthContextValue | null>(null)

function loadStored(): MagazaAuthState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { phone?: string; name?: string; email?: string }
    if (p?.phone && typeof p.phone === 'string' && p.phone.length > 5) {
      return {
        phone: p.phone,
        ...(typeof p.name === 'string' ? { name: p.name } : {}),
        ...(typeof p.email === 'string' ? { email: p.email } : {}),
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function MagazaAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MagazaAuthState | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<MagazaAuthModalMode>('login')
  const onSuccessRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    setSession(loadStored())
  }, [])

  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(session))
      } else {
        localStorage.removeItem(AUTH_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [session])

  const login = useCallback((phone: string, profile?: { name?: string; email?: string }) => {
    setSession({
      phone,
      ...(profile?.name ? { name: profile.name } : {}),
      ...(profile?.email ? { email: profile.email } : {}),
    })
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const openAuthModal = useCallback((arg?: OpenAuthModalArg) => {
    if (typeof arg === 'function') {
      onSuccessRef.current = arg
      setAuthModalMode('login')
    } else if (arg && typeof arg === 'object') {
      onSuccessRef.current = arg.onSuccess
      setAuthModalMode(arg.mode ?? 'login')
    } else {
      onSuccessRef.current = undefined
      setAuthModalMode('login')
    }
    setShowAuthModal(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false)
    setAuthModalMode('login')
    onSuccessRef.current = undefined
  }, [])

  const switchAuthModalMode = useCallback((mode: MagazaAuthModalMode) => {
    setAuthModalMode(mode)
  }, [])

  const finishLoginFromModal = useCallback(
    (phone: string) => {
      login(phone, undefined)
      const cb = onSuccessRef.current
      onSuccessRef.current = undefined
      setShowAuthModal(false)
      setAuthModalMode('login')
      cb?.()
    },
    [login],
  )

  const finishRegisterFromModal = useCallback(
    (phone: string, profile: { name: string; email: string }) => {
      login(phone, profile)
      const cb = onSuccessRef.current
      onSuccessRef.current = undefined
      setShowAuthModal(false)
      setAuthModalMode('login')
      cb?.()
    },
    [login],
  )

  const value = useMemo(
    (): MagazaAuthContextValue => ({
      isAuthenticated: !!session,
      phone: session?.phone ?? null,
      name: session?.name ?? null,
      email: session?.email ?? null,
      login,
      logout,
      showAuthModal,
      authModalMode,
      switchAuthModalMode,
      openAuthModal,
      closeAuthModal,
      finishLoginFromModal,
      finishRegisterFromModal,
    }),
    [
      session,
      login,
      logout,
      showAuthModal,
      authModalMode,
      switchAuthModalMode,
      openAuthModal,
      closeAuthModal,
      finishLoginFromModal,
      finishRegisterFromModal,
    ],
  )

  return <MagazaAuthContext.Provider value={value}>{children}</MagazaAuthContext.Provider>
}

export function useMagazaAuth(): MagazaAuthContextValue {
  const ctx = useContext(MagazaAuthContext)
  if (!ctx) {
    throw new Error('useMagazaAuth must be used within MagazaAuthProvider')
  }
  return ctx
}
