export interface AllowedUser {
  email: string
  name: string
  role: string
  dealer: string
  zone: string
  location_type: string
  addedAt: string
}

const KEY = 'spark_allowlist'
const PROFILES_KEY = 'spark_profiles'

function load(): AllowedUser[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(list: AllowedUser[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function getAllowlist(): AllowedUser[] {
  return load()
}

// Returns true when at least one user has been added — signup becomes restricted
export function isAllowlistActive(): boolean {
  return load().length > 0
}

// Returns true if the email is allowed to sign up
// When allowlist is empty (not yet configured), everyone is allowed
export function isEmailAllowed(email: string): boolean {
  if (!isAllowlistActive()) return true
  return load().some(u => u.email.toLowerCase() === email.toLowerCase().trim())
}

export function addUsers(
  users: Omit<AllowedUser, 'addedAt'>[],
): { added: number; skipped: number } {
  const existing = load()
  const knownEmails = new Set(existing.map(u => u.email.toLowerCase()))
  const toAdd: AllowedUser[] = []
  let skipped = 0

  for (const u of users) {
    const email = u.email?.trim().toLowerCase()
    if (!email || !email.includes('@')) { skipped++; continue }
    if (knownEmails.has(email)) { skipped++; continue }
    toAdd.push({ ...u, email, addedAt: new Date().toISOString() })
    knownEmails.add(email)
  }

  save([...existing, ...toAdd])
  return { added: toAdd.length, skipped }
}

export function removeUser(email: string): void {
  save(load().filter(u => u.email.toLowerCase() !== email.toLowerCase()))
}

export function updateUser(email: string, updates: Partial<Omit<AllowedUser, 'email' | 'addedAt'>>): void {
  save(load().map(u => u.email.toLowerCase() === email.toLowerCase() ? { ...u, ...updates } : u))
}

// 'active' = user has completed onboarding; 'invited' = not yet signed up
export function getUserStatus(email: string): 'active' | 'invited' {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '{}')
    return profiles[email.toLowerCase()]?.profileComplete ? 'active' : 'invited'
  } catch { return 'invited' }
}
