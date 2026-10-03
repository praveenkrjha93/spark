import { useEffect, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth, decodeGoogleCredential } from '../auth/AuthContext'
import { isEmailAllowed, isAllowlistActive } from '../lib/allowlist'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

const FEATURES = [
  {
    icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
    title: 'Smart Claims',
    body: 'Guided claim wizard with structured data capture and enrichment from connected sources.',
  },
  {
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    title: 'AI Decisioning',
    body: 'Reasoning engine evaluates each claim against policy rules and available data — consistent verdicts, every time.',
  },
  {
    icon: 'M3 3v18h18M18 17V9M13 17V5M8 17v-4',
    title: 'Warranty Trends',
    body: 'Dashboards for failure trends, recurring issues, and distribution analytics across teams and regions.',
  },
  {
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
    title: 'Policy Manager',
    body: 'Upload and version warranty policy documents. The AI engine interprets coverage rules and applies them to each claim.',
  },
]

const STEPS = [
  { n: '01', label: 'Raise a claim', detail: 'Enter the VIN — the wizard auto-populates vehicle details and service history from connected sources.' },
  { n: '02', label: 'AI reviews policy', detail: 'The reasoning engine checks the claim against policy rules, flags anomalies, and suggests a verdict.' },
  { n: '03', label: 'Approve or escalate', detail: 'High-confidence claims are approved instantly. Edge cases route to a human queue with a full audit trail.' },
]

const SLIDES = ['/image1.jpg', '/image2.jpg']
const SLIDE_INTERVAL = 5000

function SvgIcon({ path, size = 22 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

// ── Shared input style ────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px', borderRadius: 10,
  border: '1.5px solid var(--border)',
  background: 'var(--surface-1)', color: 'var(--text-primary)',
  fontSize: 14, outline: 'none',
  transition: 'border-color .15s',
}

// ── Auth card ─────────────────────────────────────────────────────────────────
type Mode = 'signin' | 'signup'

function AuthCard() {
  const { signIn } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)

  function switchMode(m: Mode) {
    setMode(m); setErr(''); setName(''); setEmail(''); setPassword(''); setConfirm('')
  }

  function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setErr('')

    if (mode === 'signup' && !name.trim()) { setErr('Please enter your full name.'); return }
    if (!email.trim() || !email.includes('@')) { setErr('Enter a valid email address.'); return }
    if (!password) { setErr('Enter a password.'); return }
    if (mode === 'signup' && password !== confirm) { setErr('Passwords do not match.'); return }

    // Allowlist check for new sign-ups
    if (mode === 'signup' && !isEmailAllowed(email.trim().toLowerCase())) {
      setErr('Your email is not on the access list. Contact your administrator to request access.')
      return
    }

    setBusy(true)
    const displayName = mode === 'signup'
      ? name.trim()
      : email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    signIn({ name: displayName, email: email.trim().toLowerCase(), picture: undefined })
    setBusy(false)
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 18,
      padding: '28px 28px 24px',
      width: '100%', maxWidth: 380,
      backdropFilter: 'blur(12px)',
      boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
    }}>

      {/* Mode tabs */}
      <div style={{
        display: 'flex', borderRadius: 10, padding: 3,
        background: 'rgba(0,0,0,0.25)', marginBottom: 22, gap: 2,
      }}>
        {(['signin', 'signup'] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 600, transition: 'all .15s',
              background: mode === m ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: mode === m ? '#f0f6ff' : 'rgba(240,246,255,0.45)',
            }}>
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {/* Google button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        {CLIENT_ID ? (
          <div style={{ transform: 'scale(1.06)', transformOrigin: 'center' }}>
            <GoogleLogin
              onSuccess={(res) => {
                if (!res.credential) return
                const decoded = decodeGoogleCredential(res.credential)
                // Check allowlist for new accounts (returning users always allowed)
                const profiles = (() => { try { return JSON.parse(localStorage.getItem('spark_profiles') ?? '{}') } catch { return {} } })()
                const isReturning = !!profiles[decoded.email]?.profileComplete
                if (!isReturning && isAllowlistActive() && !isEmailAllowed(decoded.email)) {
                  setErr('Your Google account is not on the access list. Contact your administrator.')
                  return
                }
                signIn(decoded)
              }}
              onError={() => {}}
              shape="pill" size="large" text="signin_with" logo_alignment="left"
            />
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              background: 'rgba(250,180,50,0.1)', border: '1px solid rgba(250,180,50,0.25)',
              borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'rgba(250,210,100,0.85)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>
              </svg>
              Google OAuth not configured — add <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>VITE_GOOGLE_CLIENT_ID</code> to <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>.env</code>
            </div>
            <button
              type="button"
              disabled
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '10px 20px', borderRadius: 999,
                background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)',
                cursor: 'not-allowed', fontSize: 14, fontWeight: 600, color: 'rgba(240,246,255,0.3)',
                fontFamily: '"Google Sans", Roboto, sans-serif',
              }}
            >
              <GoogleG />
              Sign in with Google
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ fontSize: 12, color: 'rgba(240,246,255,0.4)', fontWeight: 500 }}>or with email</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mode === 'signup' && (
          <input
            style={{ ...inp, background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)', color: '#f0f6ff' }}
            type="text" placeholder="Full name" autoComplete="name"
            value={name} onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          style={{ ...inp, background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)', color: '#f0f6ff' }}
          type="email" placeholder="Email address" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <div style={{ position: 'relative' }}>
          <input
            style={{ ...inp, background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)', color: '#f0f6ff', paddingRight: 42 }}
            type={showPw ? 'text' : 'password'}
            placeholder={mode === 'signup' ? 'Create password' : 'Password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,255,0.45)', padding: 0, display: 'flex' }}>
            <SvgIcon path={showPw ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22' : 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'} size={16} />
          </button>
        </div>
        {mode === 'signup' && (
          <input
            style={{ ...inp, background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)', color: '#f0f6ff' }}
            type={showPw ? 'text' : 'password'} placeholder="Confirm password"
            autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
          />
        )}

        {err && (
          <div style={{ fontSize: 12.5, color: '#ff8a80', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 8, padding: '7px 12px' }}>
            {err}
          </div>
        )}

        <button type="submit" disabled={busy}
          style={{
            width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, #3987e5, #199e70)',
            color: '#fff', fontSize: 14.5, fontWeight: 700,
            opacity: busy ? 0.7 : 1,
            boxShadow: '0 4px 14px rgba(57,135,229,0.4)',
            transition: 'opacity .15s, box-shadow .15s',
            marginTop: 2,
          }}>
          {busy ? 'Signing in…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {/* Mode switch */}
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'rgba(240,246,255,0.45)' }}>
        {mode === 'signin' ? (
          <>New to SPARK?{' '}
            <button type="button" onClick={() => switchMode('signup')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7eb8f5', fontWeight: 600, fontSize: 13, padding: 0 }}>
              Create an account
            </button>
          </>
        ) : (
          <>Already have an account?{' '}
            <button type="button" onClick={() => switchMode('signin')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7eb8f5', fontWeight: 600, fontSize: 13, padding: 0 }}>
              Sign in
            </button>
          </>
        )}
      </div>

      {!CLIENT_ID && (
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'rgba(240,246,255,0.25)', lineHeight: 1.5 }}>
          Email sign-in works in demo mode — any email &amp; password
        </div>
      )}
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export function Landing() {
  const [slide, setSlide] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function goTo(idx: number) {
    setSlide(idx)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_INTERVAL)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)', fontFamily: 'inherit' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,27,53,0.85)',
        backdropFilter: 'blur(14px)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', color: '#fff',
          background: 'linear-gradient(140deg, #3987e5, #199e70)',
          boxShadow: '0 6px 20px -6px rgba(57,135,229,0.7)', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L4.5 13H11l-1 9 8.5-11H12z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', color: '#f0f6ff' }}>SPARK</div>
          <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: 'rgba(240,246,255,0.45)', textTransform: 'uppercase' }}></div>
        </div>
        <div style={{ flex: 1 }} />
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: '80px 40px 100px',
      }}>
        {/* Carousel images — crossfade */}
        {SLIDES.map((src, i) => (
          <img key={src} src={src} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            opacity: i === slide ? 1 : 0,
            transition: 'opacity 1s ease',
          }} />
        ))}
        {/* Dark overlay for legibility */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,14,28,0.72)' }} />
        {/* Accent tint */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg, rgba(57,135,229,0.18) 0%, rgba(25,158,112,0.12) 55%, transparent 100%)' }} />

        {/* Dot indicators */}
        <div style={{
          position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8, zIndex: 2,
        }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}
              style={{
                width: i === slide ? 22 : 8, height: 8, borderRadius: 999,
                border: 'none', padding: 0, cursor: 'pointer',
                background: i === slide ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.3s ease',
              }} />
          ))}
        </div>

        <div style={{
          position: 'relative', zIndex: 1,
          maxWidth: 1100, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr auto',
          gap: 56, alignItems: 'center',
        }}>
          {/* Left: copy */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(57,135,229,0.15)', border: '1px solid rgba(57,135,229,0.35)',
              borderRadius: 999, padding: '5px 14px', marginBottom: 24,
              fontSize: 11.5, fontWeight: 600, color: '#7eb8f5', letterSpacing: '0.06em',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3987e5', boxShadow: '0 0 8px #3987e5', flexShrink: 0 }} />
              SMART PLATFORM FOR AUTOMOTIVE REPAIR KNOWLEDGE
            </div>

            <h1 style={{
              margin: '0 0 18px', fontSize: 'clamp(32px, 4vw, 56px)',
              fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.025em', color: '#f0f6ff',
            }}>
              Warranty claims,<br />
              decided{' '}
              <span style={{ background: 'linear-gradient(90deg, #3987e5, #199e70)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                in seconds.
              </span>
            </h1>

            <p style={{ margin: '0 0 36px', maxWidth: 480, fontSize: 17, lineHeight: 1.7, color: 'rgba(240,246,255,0.6)' }}>
              AI-powered warranty decisioning — from VIN scan to verdict, with full audit trail.
            </p>

            {/* stat pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { value: 'Seconds', label: 'Decision time' },
                { value: 'Rule-based', label: 'Policy checks' },
                { value: 'Multi-source', label: 'Data integration' },
                { value: 'Full audit', label: 'Every decision' },
              ].map(({ value, label }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '10px 18px',
                }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f6ff' }}>{value}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(240,246,255,0.45)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: auth card */}
          <div style={{ flexShrink: 0 }}>
            <AuthCard />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
            Everything in one platform
          </div>
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Built for service teams
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="panel" style={{ padding: '22px 20px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center',
                background: 'linear-gradient(135deg, rgba(57,135,229,0.14), rgba(25,158,112,0.14))',
                color: 'var(--accent)', marginBottom: 14,
              }}>
                <SvgIcon path={f.icon} size={19} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 7, color: 'var(--text-primary)' }}>{f.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section style={{
        padding: '60px 40px',
        background: 'var(--surface-2)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-2)', marginBottom: 10 }}>
              How it works
            </div>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              From fault to decision in three steps
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', gap: 14, paddingRight: 16, position: 'relative' }}>
                {i < STEPS.length - 1 && (
                  <div style={{ position: 'absolute', top: 22, left: 50, right: -8, height: 1, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', opacity: 0.2 }} />
                )}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  color: '#fff', fontSize: 13, fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(57,135,229,0.3)',
                }}>
                  {s.n}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '18px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        fontSize: 12.5, color: 'var(--text-muted)',
      }}>
        <span>© {new Date().getFullYear()} SPARK — Smart Platform for Automotive Repair Knowledge</span>
      </footer>

    </div>
  )
}
