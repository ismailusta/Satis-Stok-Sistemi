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

import { getMagazaSessionAction, logoutMagazaAction } from './auth-otp-actions'

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
  finishLoginFromModal: (phone: string, profile?: { name?: string; email?: string }) => void
  finishRegisterFromModal: (
    phone: string,
    profile: { name: string; email: string },
  ) => void
  sessionReady: boolean
}

const MagazaAuthContext = createContext<MagazaAuthContextValue | null>(null)

export function MagazaAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MagazaAuthState | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<MagazaAuthModalMode>('login')
  const onSuccessRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await getMagazaSessionAction()
        if (cancelled) return
        if (r.ok) {
          setSession({
            phone: r.user.phoneDisplay,
            ...(r.user.name ? { name: r.user.name } : {}),
            ...(r.user.email ? { email: r.user.email } : {}),
          })
        } else {
          setSession(null)
        }
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setSessionReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback((phone: string, profile?: { name?: string; email?: string }) => {
    setSession({
      phone,
      ...(profile?.name ? { name: profile.name } : {}),
      ...(profile?.email ? { email: profile.email } : {}),
    })
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    void logoutMagazaAction()
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
    (phone: string, profile?: { name?: string; email?: string }) => {
      login(phone, profile)
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
      sessionReady,
    }),
    [
      session,
      sessionReady,
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
