import { useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { api } from './api/client'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Onboarding } from './pages/Onboarding'
import { Home } from './pages/Home'
import { Analytics } from './pages/Analytics'
import { Claims } from './pages/Claims'
import { ClaimDetail } from './pages/ClaimDetail'
import { NewClaimPage } from './pages/NewClaim'
import { Policies } from './pages/Policies'
import { Profile } from './pages/Profile'
import { Admin } from './pages/Admin'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

function AppInner() {
  const { user } = useAuth()
  const [queueCount, setQueueCount] = useState<number | undefined>(undefined)

  const refreshBadge = useCallback(() => {
    api.analytics().then((s) => setQueueCount(s.open_reviews)).catch(() => {})
  }, [])

  useEffect(() => { if (user) refreshBadge() }, [user, refreshBadge])

  if (!user) return <Landing />
  if (!user.profileComplete) return <Onboarding />

  return (
    <Layout queueCount={queueCount}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/claims" element={<Claims onChanged={refreshBadge} />} />
        <Route path="/claims/new" element={<NewClaimPage onChanged={refreshBadge} />} />
        <Route path="/claims/:id" element={<ClaimDetail onChanged={refreshBadge} />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  const inner = (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )

  // Only wrap with GoogleOAuthProvider when a real client ID is configured.
  // Passing a dummy ID causes Google's script to throw and breaks React's
  // event loop in development.
  if (CLIENT_ID) {
    return <GoogleOAuthProvider clientId={CLIENT_ID}>{inner}</GoogleOAuthProvider>
  }
  return inner
}
