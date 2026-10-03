import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../auth/AuthContext'
import {
  getAllowlist, isAllowlistActive, addUsers, removeUser, getUserStatus, updateUser,
  type AllowedUser,
} from '../lib/allowlist'

const ROLES = [
  'Service Engineer', 'Senior Service Engineer', 'ASM (Area Service Manager)',
  'RSM (Regional Service Manager)', 'Service Manager', 'Product Analyst', 'Technician',
]
const ZONES = ['North', 'South', 'East', 'West', 'Central']
const LOCATION_TYPES = [
  'Service Centre', 'Authorized Workshop', 'Dealer Workshop',
  'Company Owned Workshop', 'Authorised Partner',
]

const EMPTY_FORM = { email: '', name: '', role: '', dealer: '', zone: '', location_type: '' }

type Toast = { type: 'success' | 'error'; msg: string }

function StatusBadge({ status }: { status: 'active' | 'invited' }) {
  const isActive = status === 'active'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
      background: isActive ? 'rgba(25,158,112,0.12)' : 'rgba(245,158,11,0.12)',
      color: isActive ? 'var(--good)' : 'var(--warning)',
      border: `1px solid ${isActive ? 'rgba(25,158,112,0.25)' : 'rgba(245,158,11,0.25)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {isActive ? 'Active' : 'Invited'}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  if (!role) return <span className="t-muted">—</span>
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11.5,
      background: 'rgba(57,135,229,0.1)', color: 'var(--accent)', fontWeight: 600,
    }}>
      {role}
    </span>
  )
}

export function Admin() {
  const { user } = useAuth()
  const [list, setList] = useState<AllowedUser[]>(getAllowlist)
  const [active, setActive] = useState(isAllowlistActive)
  const [toast, setToast] = useState<Toast | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')
  const [editEmail, setEditEmail] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const fileRef = useRef<HTMLInputElement>(null)

  // Refresh list from storage
  function refresh() {
    const l = getAllowlist()
    setList(l)
    setActive(l.length > 0)
  }

  function showToast(type: Toast['type'], msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Guard — only superadmin can access
  if (user?.role !== 'Super Admin') {
    return (
      <div style={{ maxWidth: 480, paddingTop: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Access restricted</h2>
        <p className="t-muted" style={{ fontSize: 14 }}>
          This page is only accessible to users with the <strong>Super Admin</strong> role.
        </p>
      </div>
    )
  }

  // ── Download template ────────────────────────────────────────────────────────

  function downloadTemplate() {
    const header = ['Email *', 'Full Name', 'Role', 'Dealer / Service Centre', 'Zone', 'Location Type']
    const examples = [
      ['john@example.com', 'John Doe', 'Service Engineer', 'SPARK Care Centre Mumbai', 'West', 'Service Centre'],
      ['jane@example.com', 'Jane Smith', 'ASM (Area Service Manager)', 'SPARK Authorised Workshop Delhi', 'North', 'Authorized Workshop'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([header, ...examples])
    ws['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 30 }, { wch: 38 }, { wch: 12 }, { wch: 24 }]
    // Style header row (SheetJS community edition: just set bold via cell meta isn't supported, but we can add a note)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    // Add a reference sheet with valid options
    const refData = [
      ['Role options', '', 'Zone options', '', 'Location Type options'],
      ...ROLES.map((r, i) => [r, '', ZONES[i] ?? '', '', LOCATION_TYPES[i] ?? '']),
    ]
    const wsRef = XLSX.utils.aoa_to_sheet(refData)
    wsRef['!cols'] = [{ wch: 30 }, { wch: 4 }, { wch: 14 }, { wch: 4 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference')
    XLSX.writeFile(wb, 'spark_user_template.xlsx')
  }

  // ── Upload Excel / CSV ───────────────────────────────────────────────────────

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      const users = rows.map((r) => ({
        email: String(r['Email *'] || r['Email'] || '').trim().toLowerCase(),
        name: String(r['Full Name'] || r['Name'] || '').trim(),
        role: String(r['Role'] || '').trim(),
        dealer: String(r['Dealer / Service Centre'] || r['Dealer'] || '').trim(),
        zone: String(r['Zone'] || '').trim(),
        location_type: String(r['Location Type'] || '').trim(),
      }))
      const { added, skipped } = addUsers(users)
      showToast('success', `${added} user(s) added${skipped ? `, ${skipped} skipped (duplicate or missing email)` : ''}.`)
      refresh()
    } catch {
      showToast('error', 'Could not parse the file. Please use the downloaded template.')
    }
    e.target.value = ''
  }

  // ── Manual add ───────────────────────────────────────────────────────────────

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormErr('')
    if (!form.email.trim() || !form.email.includes('@')) {
      setFormErr('Enter a valid email address.')
      return
    }
    const { added, skipped } = addUsers([form])
    if (skipped > 0 && added === 0) {
      setFormErr('This email is already in the list.')
      return
    }
    setForm(EMPTY_FORM)
    setShowAdd(false)
    refresh()
    showToast('success', `${form.email} added to the access list.`)
  }

  // ── Inline edit ──────────────────────────────────────────────────────────────

  function startEdit(u: AllowedUser) {
    setEditEmail(u.email)
    setEditForm({ email: u.email, name: u.name, role: u.role, dealer: u.dealer, zone: u.zone, location_type: u.location_type })
  }

  function saveEdit() {
    if (!editEmail) return
    updateUser(editEmail, { name: editForm.name, role: editForm.role, dealer: editForm.dealer, zone: editForm.zone, location_type: editForm.location_type })
    setEditEmail(null)
    refresh()
    showToast('success', 'User details updated.')
  }

  // ── Remove ───────────────────────────────────────────────────────────────────

  function handleRemove(email: string) {
    if (!confirm(`Remove ${email} from the access list?`)) return
    removeUser(email)
    refresh()
    showToast('success', `${email} removed.`)
  }

  const sel: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 12.5, width: '100%' }

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>User Access Management</h1>
          <p className="t-muted" style={{ fontSize: 14, margin: 0 }}>
            Control who can sign up to SPARK. Upload an Excel sheet or add users individually.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700,
            background: active ? 'rgba(57,135,229,0.12)' : 'rgba(245,158,11,0.12)',
            color: active ? 'var(--accent)' : 'var(--warning)',
            border: `1px solid ${active ? 'rgba(57,135,229,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
            {active ? 'Restricted — allowlist active' : 'Open — anyone can sign up'}
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
          background: toast.type === 'success' ? 'rgba(25,158,112,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(25,158,112,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: toast.type === 'success' ? 'var(--good)' : 'var(--serious)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'success'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          }
          {toast.msg}
        </div>
      )}

      {/* Info banner when list is empty */}
      {!active && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 13, color: 'var(--warning)',
        }}>
          <strong>No users added yet.</strong> Signup is currently open to everyone. Add at least one user to enable the allowlist and restrict access.
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Download Template
        </button>
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Upload Excel / CSV
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleUpload} />
        <button className="btn btn-primary" onClick={() => { setShowAdd((v) => !v); setFormErr('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Add User
        </button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="panel" style={{ padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--accent)' }}>Add Single User</div>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'user@company.com' },
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'John Doe' },
                { label: 'Dealer / Service Centre', key: 'dealer', type: 'text', placeholder: 'SPARK Care Centre' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="label-caps" style={{ marginBottom: 5, display: 'block' }}>{label}</label>
                  <input className="input"
                    type={type} placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ fontSize: 13 }}
                  />
                </div>
              ))}
              {[
                { label: 'Role', key: 'role', opts: ['', ...ROLES] },
                { label: 'Zone', key: 'zone', opts: ['', ...ZONES] },
                { label: 'Location Type', key: 'location_type', opts: ['', ...LOCATION_TYPES] },
              ].map(({ label, key, opts }) => (
                <div key={key}>
                  <label className="label-caps" style={{ marginBottom: 5, display: 'block' }}>{label}</label>
                  <select className="input" value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={{ fontSize: 13 }}>
                    {opts.map((o) => <option key={o} value={o}>{o || `Select ${label.toLowerCase()}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {formErr && <div style={{ color: 'var(--serious)', fontSize: 13, marginBottom: 10 }}>{formErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" style={{ fontSize: 13 }}>Add to List</button>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }}
                onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); setFormErr('') }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="panel" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Stats strip */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 24, fontSize: 13,
        }}>
          <span><strong>{list.length}</strong> <span className="t-muted">total users</span></span>
          <span><strong style={{ color: 'var(--good)' }}>{list.filter(u => getUserStatus(u.email) === 'active').length}</strong> <span className="t-muted">active</span></span>
          <span><strong style={{ color: 'var(--warning)' }}>{list.filter(u => getUserStatus(u.email) === 'invited').length}</strong> <span className="t-muted">invited (not yet signed up)</span></span>
        </div>

        {list.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No users in the allowlist yet. Download the template, fill it in, and upload it.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  {['Email', 'Full Name', 'Role', 'Dealer / Service Centre', 'Zone', 'Location Type', 'Status', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const isEditing = editEmail === u.email
                  return (
                    <tr key={u.email} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12.5 }}>{u.email}</td>

                      {isEditing ? (
                        <>
                          <td style={{ padding: '6px 8px' }}><input style={sel} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></td>
                          <td style={{ padding: '6px 8px' }}>
                            <select style={sel} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                              {['', ...ROLES].map(r => <option key={r} value={r}>{r || 'Select role'}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}><input style={sel} value={editForm.dealer} onChange={e => setEditForm(f => ({ ...f, dealer: e.target.value }))} /></td>
                          <td style={{ padding: '6px 8px' }}>
                            <select style={sel} value={editForm.zone} onChange={e => setEditForm(f => ({ ...f, zone: e.target.value }))}>
                              {['', ...ZONES].map(z => <option key={z} value={z}>{z || 'Select zone'}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <select style={sel} value={editForm.location_type} onChange={e => setEditForm(f => ({ ...f, location_type: e.target.value }))}>
                              {['', ...LOCATION_TYPES].map(l => <option key={l} value={l}>{l || 'Select type'}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}><StatusBadge status={getUserStatus(u.email)} /></td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px', marginRight: 6 }} onClick={saveEdit}>Save</button>
                            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditEmail(null)}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 16px' }}>{u.name || <span className="t-muted">—</span>}</td>
                          <td style={{ padding: '10px 16px' }}><RoleBadge role={u.role} /></td>
                          <td style={{ padding: '10px 16px' }}>{u.dealer || <span className="t-muted">—</span>}</td>
                          <td style={{ padding: '10px 16px' }}>{u.zone || <span className="t-muted">—</span>}</td>
                          <td style={{ padding: '10px 16px' }}>{u.location_type || <span className="t-muted">—</span>}</td>
                          <td style={{ padding: '10px 16px' }}><StatusBadge status={getUserStatus(u.email)} /></td>
                          <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                            <button className="icon-btn" title="Edit" onClick={() => startEdit(u)} style={{ marginRight: 4 }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="icon-btn" title="Remove" onClick={() => handleRemove(u.email)}
                              style={{ color: 'var(--serious)' }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note on scope */}
      <p className="t-muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
        When the allowlist has at least one entry, only listed emails can create a new account. Existing users can always sign in regardless.
        Pre-filled details (role, dealer, zone) are suggested to users during onboarding but they can edit them.
      </p>
    </div>
  )
}
