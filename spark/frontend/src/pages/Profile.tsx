import { useRef, useState } from 'react'
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

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export function Profile() {
  const { user, updateProfile, signOut } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState(user?.role ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [dealer, setDealer] = useState(user?.dealer ?? '')
  const [zone, setZone] = useState(user?.zone ?? '')
  const [locationType, setLocationType] = useState(user?.location_type ?? '')
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const [picHover, setPicHover] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  function handlePicChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateProfile({ picture: reader.result as string })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setSaved(false)
    if (!name.trim()) { setErr('Full name is required.'); return }
    if (!dealer.trim()) { setErr('Service centre name is required.'); return }

    updateProfile({
      name: name.trim(),
      role: role || undefined,
      phone: phone.trim() || undefined,
      dealer: dealer.trim() || undefined,
      zone: zone || undefined,
      location_type: locationType || undefined,
      profileComplete: true,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const ini = initials(user.name)

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>My Profile</h1>
      <p className="t-muted" style={{ marginBottom: 28, fontSize: 14 }}>
        Manage your account details and service centre information.
      </p>

      {/* Avatar row */}
      <div className="panel" style={{ padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Clickable avatar with camera overlay */}
        <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
             onClick={() => fileRef.current?.click()}
             onMouseEnter={() => setPicHover(true)}
             onMouseLeave={() => setPicHover(false)}
             title="Change profile photo"
        >
          {user.picture ? (
            <img src={user.picture} alt={user.name} referrerPolicy="no-referrer"
                 style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', display: 'block',
                          border: '2px solid var(--border)' }} />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3987e5, #199e70)',
              display: 'grid', placeItems: 'center',
              fontSize: 24, fontWeight: 700, color: '#fff',
            }}>
              {ini}
            </div>
          )}
          {/* Hover overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            opacity: picHover ? 1 : 0,
            transition: 'opacity .15s ease',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, letterSpacing: '.04em' }}>CHANGE</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                 onChange={handlePicChange} />
        </div>

        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{user.name}</div>
          <div className="t-muted" style={{ fontSize: 13 }}>{user.email}</div>
          {user.role && (
            <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 99,
                          background: 'rgba(57,135,229,0.12)', color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>
              {user.role}
            </div>
          )}

        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Personal details */}
        <div className="panel" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                        color: 'var(--accent)', marginBottom: 18 }}>
            Personal Details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="label-caps" style={{ marginBottom: 6, display: 'block' }}>Full Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="label-caps" style={{ marginBottom: 6, display: 'block' }}>Email</label>
              <input className="input" value={user.email} disabled
                     style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div>
              <label className="label-caps" style={{ marginBottom: 6, display: 'block' }}>Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Not specified</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ marginBottom: 6, display: 'block' }}>
                Phone <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
              </label>
              <input className="input" type="tel" value={phone}
                     onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>
        </div>

        {/* Service centre */}
        <div className="panel" style={{ padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                        color: '#199e70', marginBottom: 18 }}>
            Service Centre
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label-caps" style={{ marginBottom: 6, display: 'block' }}>Dealer / Service Centre Name</label>
            <input className="input" value={dealer}
                   onChange={(e) => setDealer(e.target.value)}
                   placeholder="e.g. Oben Care Centre Bengaluru" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="label-caps" style={{ marginBottom: 6, display: 'block' }}>Zone</label>
              <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
                <option value="">Not specified</option>
                {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ marginBottom: 6, display: 'block' }}>Location Type</label>
              <select className="input" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
                <option value="">Not specified</option>
                {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {err && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--serious)',
                        marginBottom: 16 }}>
            {err}
          </div>
        )}

        {saved && (
          <div style={{ background: 'rgba(25,158,112,0.1)', border: '1px solid rgba(25,158,112,0.25)',
                        borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--good)',
                        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Profile saved successfully.
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => {
            setName(user.name)
            setRole(user.role ?? '')
            setPhone(user.phone ?? '')
            setDealer(user.dealer ?? '')
            setZone(user.zone ?? '')
            setLocationType(user.location_type ?? '')
            setErr('')
            setSaved(false)
          }}>
            Reset
          </button>
        </div>
      </form>

      {/* Danger zone */}
      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sign Out</div>
        <p className="t-muted" style={{ fontSize: 13, marginBottom: 14 }}>
          You will be returned to the sign-in page.
        </p>
        <button className="btn btn-secondary" onClick={signOut} style={{ color: 'var(--serious)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  )
}
