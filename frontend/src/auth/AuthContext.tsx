import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export interface AuthUser {
  name: string
  email: string
  picture?: string
  // Profile fields — set during onboarding
  role?: string
  dealer?: string
  location_type?: string
  zone?: string
  phone?: string
  profileComplete?: boolean
}

// Profile fields that should survive sign-out and be restored on next sign-in
type SavedProfile = Pick<AuthUser, 'name' | 'role' | 'dealer' | 'location_type' | 'zone' | 'phone' | 'profileComplete' | 'picture'>

interface AuthCtx {
  user: AuthUser | null
  signIn: (u: AuthUser) => void
  signOut: () => void
  updateProfile: (updates: Partial<AuthUser>) => void
}

const Ctx = createContext<AuthCtx>({
  user: null,
  signIn: () => {},
  signOut: () => {},
  updateProfile: () => {},
})

const SESSION_KEY = 'spark_auth_user'
const PROFILES_KEY = 'spark_profiles' // persists across sign-out, keyed by email

// Emails that are always granted Super Admin regardless of saved profile
const SEED_ADMINS = new Set(['pkumarjha10@gmail.com'])

function loadProfiles(): Record<string, SavedProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveProfile(email: string, profile: SavedProfile) {
  const all = loadProfiles()
  all[email] = { ...all[email], ...profile }
  localStorage.setItem(PROFILES_KEY, JSON.stringify(all))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch { return null }
  })

  function signIn(u: AuthUser) {
    // Restore any previously saved profile for this email (survives sign-out)
    const saved = loadProfiles()[u.email]
    const merged: AuthUser = saved
      ? {
          ...u,
          // Prefer the name the user explicitly set over Google's display name
          name: saved.name ?? u.name,
          role: saved.role,
          dealer: saved.dealer,
          location_type: saved.location_type,
          zone: saved.zone,
          phone: saved.phone,
          profileComplete: saved.profileComplete,
          // Keep custom-uploaded picture (base64); fall back to provider's
          picture: saved.picture?.startsWith('data:') ? saved.picture : u.picture,
        }
      : u

    // Seed admins always get Super Admin role
    if (SEED_ADMINS.has(u.email)) {
      merged.role = 'Super Admin'
      merged.profileComplete = merged.profileComplete ?? true
      saveProfile(u.email, { ...merged })
    }

    setUser(merged)
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged))
  }

  function signOut() {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
    // PROFILES_KEY is intentionally kept — profile survives sign-out
  }

  function updateProfile(updates: Partial<AuthUser>) {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      // Also persist to the durable profiles store
      saveProfile(next.email, {
        name: next.name,
        role: next.role,
        dealer: next.dealer,
        location_type: next.location_type,
        zone: next.zone,
        phone: next.phone,
        profileComplete: next.profileComplete,
        picture: next.picture?.startsWith('data:') ? next.picture : undefined,
      })
      return next
    })
  }

  return <Ctx.Provider value={{ user, signIn, signOut, updateProfile }}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }

// Decode a Google JWT credential payload without verifying the signature.
// We trust Google's signing — this is safe for client-side profile extraction.
export function decodeGoogleCredential(token: string): AuthUser {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(b64))
  return { name: payload.name, email: payload.email, picture: payload.picture }
}
