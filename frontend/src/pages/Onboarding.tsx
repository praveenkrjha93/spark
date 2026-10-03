import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const ROLES = [
  'Service Engineer',
  'Senior Service Engineer',
  'ASM (Area Service Manager)',
  'RSM (Regional Service Manager)',
  'Service Manager',
  'Product Analyst',
  'Technician',
  'Super Admin',
]

const LOCATION_TYPES = [
  'Service Centre',
  'Authorized Workshop',
  'Dealer Workshop',
  'Company Owned Workshop',
  'Authorised Partner',
]

const ZONES = ['North', 'South', 'East', 'West', 'Central']

function SparkLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
        background: 'linear-gradient(140deg, #3987e5, #199e70)',
        boxShadow: '0 8px 24px -8px rgba(57,135,229,0.7)',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L4.5 13H11l-1 9 8.5-11H12z" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>SPARK</div>
        <div style={{ fontSize: 9.5, letterSpacing: '.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}></div>
      </div>
    </div>
  )
}

export function Onboarding() {
  const { user, updateProfile } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [dealer, setDealer] = useState('')
  const [zone, setZone] = useState('')
  const [locationType, setLocationType] = useState('')
  const [err, setErr] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!name.trim()) { setErr('Please enter your full name.'); return }
    if (!role) { setErr('Please select your role.'); return }
    if (!dealer.trim()) { setErr('Please enter your service centre or dealer name.'); return }
    if (!zone) { setErr('Please select your zone.'); return }
    if (!locationType) { setErr('Please select a location type.'); return }

    updateProfile({
      name: name.trim(),
      role,
      phone: phone.trim(),
      dealer: dealer.trim(),
      zone,
      location_type: locationType,
      profileComplete: true,
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 45%, #0a1a14 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 20px 80px',
    }}>
      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: 520, marginBottom: 40 }}>
        <SparkLogo />
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '36px 40px',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Avatar + welcome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          {user?.picture ? (
            <img src={user.picture} alt={user.name} referrerPolicy="no-referrer"
                 style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                          border: '2px solid rgba(57,135,229,0.4)', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #3987e5, #199e70)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
              fontSize: 20, fontWeight: 700, color: '#fff',
            }}>
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              Welcome, {user?.name?.split(' ')[0] ?? 'there'}!
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
              Complete your profile to get started
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Personal details */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
                        textTransform: 'uppercase', color: 'rgba(57,135,229,0.8)', marginBottom: 16 }}>
            Personal Details
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                            color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Full Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                            color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: role ? '#fff' : 'rgba(255,255,255,0.4)' }}
            >
              <option value="" disabled>Select your role</option>
              {ROLES.map((r) => <option key={r} value={r} style={{ color: '#000' }}>{r}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                            color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              Phone <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
            </label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
            />
          </div>

          {/* Service centre */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 24 }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
                        textTransform: 'uppercase', color: 'rgba(25,158,112,0.9)', marginBottom: 16 }}>
            Service Centre
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                            color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Dealer / Service Centre Name</label>
            <input
              className="input"
              value={dealer}
              onChange={(e) => setDealer(e.target.value)}
              placeholder="e.g. Oben Care Centre Bengaluru"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                              color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Zone</label>
              <select
                className="input"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: zone ? '#fff' : 'rgba(255,255,255,0.4)' }}
              >
                <option value="" disabled>Select zone</option>
                {ZONES.map((z) => <option key={z} value={z} style={{ color: '#000' }}>{z}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                              color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Location Type</label>
              <select
                className="input"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: locationType ? '#fff' : 'rgba(255,255,255,0.4)' }}
              >
                <option value="" disabled>Select type</option>
                {LOCATION_TYPES.map((t) => <option key={t} value={t} style={{ color: '#000' }}>{t}</option>)}
              </select>
            </div>
          </div>

          {err && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fca5a5',
                          marginBottom: 16 }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 700, borderRadius: 10 }}
          >
            Complete Setup
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
        Signed in as {user?.email}
      </div>
    </div>
  )
}
