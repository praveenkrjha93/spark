import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Policy, PolicyCreate, PolicyDraft } from '../api/types'

type Tab = 'form' | 'file' | 'doc'

interface DraftState {
  code: string
  version: string
  title: string
  coverage_years: number
  coverage_km: number
  battery_coverage_years: number
  battery_coverage_km: number
  battery_min_soh_pct: number
  service_schedule_required: boolean
  max_service_overdue_days: number
  covered_text: string
  excluded_text: string
  clauses: { id: string; text: string }[]
}

const BLANK: DraftState = {
  code: '',
  version: '',
  title: '',
  coverage_years: 3,
  coverage_km: 60000,
  battery_coverage_years: 8,
  battery_coverage_km: 160000,
  battery_min_soh_pct: 70,
  service_schedule_required: true,
  max_service_overdue_days: 30,
  covered_text: '',
  excluded_text: '',
  clauses: [{ id: '', text: '' }],
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

function draftToCreate(d: DraftState): PolicyCreate {
  return {
    code: d.code.trim(),
    version: d.version.trim(),
    title: d.title.trim(),
    coverage_years: d.coverage_years,
    coverage_km: d.coverage_km,
    battery_coverage_years: d.battery_coverage_years,
    battery_coverage_km: d.battery_coverage_km,
    battery_min_soh_pct: d.battery_min_soh_pct,
    service_schedule_required: d.service_schedule_required,
    max_service_overdue_days: d.max_service_overdue_days,
    covered_components: lines(d.covered_text),
    excluded_components: lines(d.excluded_text),
    clauses: Object.fromEntries(
      d.clauses.filter((c) => c.id.trim()).map((c) => [c.id.trim(), c.text.trim()]),
    ),
  }
}

// Suggest the next version label (bump the trailing number if there is one).
function nextVersion(v: string): string {
  const m = v.match(/^(.*?)(\d+)$/)
  if (m) return `${m[1]}${Number(m[2]) + 1}`
  return `${v}.1`
}

function fromPolicy(p: Policy, opts: { renew: boolean }): DraftState {
  return {
    code: p.code,
    version: opts.renew ? nextVersion(p.version) : p.version,
    title: opts.renew ? p.title.replace(/[\d.]+\s*$/, '').trim() || p.title : p.title,
    coverage_years: p.coverage_years,
    coverage_km: p.coverage_km,
    battery_coverage_years: p.battery_coverage_years,
    battery_coverage_km: p.battery_coverage_km,
    battery_min_soh_pct: p.battery_min_soh_pct,
    service_schedule_required: p.service_schedule_required,
    max_service_overdue_days: p.max_service_overdue_days,
    covered_text: p.covered_components.join('\n'),
    excluded_text: p.excluded_components.join('\n'),
    clauses: Object.entries(p.clauses).map(([id, text]) => ({ id, text })),
  }
}

function fromDraftPayload(d: PolicyDraft): DraftState {
  return {
    code: d.code || '',
    version: d.version || '',
    title: d.title || '',
    coverage_years: d.coverage_years,
    coverage_km: d.coverage_km,
    battery_coverage_years: d.battery_coverage_years,
    battery_coverage_km: d.battery_coverage_km,
    battery_min_soh_pct: d.battery_min_soh_pct,
    service_schedule_required: d.service_schedule_required,
    max_service_overdue_days: d.max_service_overdue_days,
    covered_text: (d.covered_components ?? []).join('\n'),
    excluded_text: (d.excluded_components ?? []).join('\n'),
    clauses: Object.entries(d.clauses ?? {}).map(([id, text]) => ({ id, text })),
  }
}

export function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [tab, setTab] = useState<Tab>('form')
  const [draft, setDraft] = useState<DraftState>(BLANK)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = () => api.policies().then(setPolicies).catch((e) => setError(String(e)))
  useEffect(() => {
    refresh()
  }, [])

  const latest = useMemo(() => policies[policies.length - 1], [policies])

  function set<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function startBlank() {
    setDraft(BLANK)
    setNote(null)
    setError(null)
    setTab('form')
  }

  function startRenew(p: Policy) {
    setDraft(fromPolicy(p, { renew: true }))
    setNote(`Renewing ${p.code} — cloned from v${p.version}. Edit the terms and save as the new version.`)
    setError(null)
    setTab('form')
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const created = await api.createPolicy(draftToCreate(draft))
      setFlash(`Saved ${created.code} v${created.version}.`)
      await refresh()
      startBlank()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Terms &amp; conditions
          </h1>
          <p className="t-muted" style={{ margin: '6px 0 0', fontSize: 14, maxWidth: 640 }}>
            The versioned warranty policies the decision engine evaluates every claim against.
            Author a new version, renew an existing one, or upload a T&amp;C document.
          </p>
        </div>
        <button className="btn" onClick={startBlank}>+ New version</button>
      </header>

      {flash && (
        <div className="panel" style={{ padding: '10px 14px', marginBottom: 16, borderColor: 'rgba(12,163,12,0.4)', background: 'rgba(12,163,12,0.07)' }}>
          <span style={{ color: 'var(--good)', fontSize: 13 }}>✓ {flash}</span>
        </div>
      )}

      {/* Existing versions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 26 }}>
        {policies.map((p) => (
          <PolicyCard key={p.id} policy={p} onRenew={() => startRenew(p)} isLatest={p.id === latest?.id} />
        ))}
        {policies.length === 0 && (
          <div className="t-muted" style={{ padding: 20 }}>No policies yet — author one below.</div>
        )}
      </div>

      {/* Composer */}
      <section className="panel" style={{ padding: 22 }}>
        <div className="label-caps" style={{ marginBottom: 14 }}>Author a version</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <TabButton active={tab === 'form'} onClick={() => setTab('form')}>Structured form</TabButton>
          <TabButton active={tab === 'file'} onClick={() => setTab('file')}>Upload policy file</TabButton>
          <TabButton active={tab === 'doc'} onClick={() => setTab('doc')}>Upload T&amp;C doc (AI)</TabButton>
        </div>

        {tab === 'form' && (
          <StructuredForm
            draft={draft}
            set={set}
            setDraft={setDraft}
            note={note}
            busy={busy}
            error={error}
            onSave={save}
          />
        )}
        {tab === 'file' && (
          <FileImport
            onImported={(created) => {
              setFlash(`Imported ${created.length} policy version(s).`)
              refresh()
            }}
          />
        )}
        {tab === 'doc' && (
          <DocExtract
            onDraft={(d) => {
              setDraft(fromDraftPayload(d))
              setNote(d._note ?? 'Draft extracted — review every field before saving.')
              setTab('form')
            }}
          />
        )}
      </section>
    </div>
  )
}

function PolicyCard({ policy, onRenew, isLatest }: { policy: Policy; onRenew: () => void; isLatest: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="panel panel-hover" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{policy.code}</span>
        <span className="badge badge-neutral tnum">v{policy.version}</span>
        {isLatest && <span className="badge badge-good">Current</span>}
      </div>
      <div className="t-sec" style={{ fontSize: 13, marginBottom: 12 }}>{policy.title}</div>

      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', margin: 0, fontSize: 12.5 }}>
        <Term label="Coverage" value={`${policy.coverage_years} yr · ${policy.coverage_km.toLocaleString()} km`} />
        <Term label="Battery" value={`${policy.battery_coverage_years} yr · ${policy.battery_coverage_km.toLocaleString()} km`} />
        <Term label="Min SoH" value={`${policy.battery_min_soh_pct}%`} />
        <Term label="Service" value={policy.service_schedule_required ? `req · ${policy.max_service_overdue_days}d grace` : 'not required'} />
      </dl>

      <div className="t-muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
        {policy.covered_components.length} covered · {policy.excluded_components.length} excluded ·{' '}
        {Object.keys(policy.clauses).length} clauses
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide clauses' : 'View clauses'}
        </button>
        <button className="btn" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={onRenew}>
          Renew
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(policy.clauses).map(([id, text]) => (
            <div key={id} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <span className="tnum" style={{ color: 'var(--accent)', fontWeight: 600 }}>{id}</span>{' '}
              <span className="t-sec">{text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div className="tnum" style={{ marginTop: 2 }}>{value}</div>
    </div>
  )
}

function StructuredForm({
  draft, set, setDraft, note, busy, error, onSave,
}: {
  draft: DraftState
  set: <K extends keyof DraftState>(k: K, v: DraftState[K]) => void
  setDraft: React.Dispatch<React.SetStateAction<DraftState>>
  note: string | null
  busy: boolean
  error: string | null
  onSave: () => void
}) {
  const canSave = draft.code.trim() && draft.version.trim() && draft.title.trim() && !busy

  function setClause(i: number, key: 'id' | 'text', value: string) {
    setDraft((d) => {
      const clauses = d.clauses.map((c, idx) => (idx === i ? { ...c, [key]: value } : c))
      return { ...d, clauses }
    })
  }
  function addClause() {
    setDraft((d) => ({ ...d, clauses: [...d.clauses, { id: '', text: '' }] }))
  }
  function removeClause(i: number) {
    setDraft((d) => ({ ...d, clauses: d.clauses.filter((_, idx) => idx !== i) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {note && (
        <div className="panel" style={{ padding: '10px 14px', borderColor: 'rgba(57,135,229,0.4)', background: 'rgba(57,135,229,0.07)' }}>
          <span className="t-sec" style={{ fontSize: 13 }}>{note}</span>
        </div>
      )}

      <Row>
        <Field label="Code"><input className="input" placeholder="EV-STD" value={draft.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Version"><input className="input" placeholder="2025.1" value={draft.version} onChange={(e) => set('version', e.target.value)} /></Field>
      </Row>
      <Field label="Title"><input className="input" placeholder="Standard EV Limited Warranty 2025.1" value={draft.title} onChange={(e) => set('title', e.target.value)} /></Field>

      <Row>
        <Field label="Coverage years"><NumInput value={draft.coverage_years} onChange={(v) => set('coverage_years', v)} /></Field>
        <Field label="Coverage km"><NumInput value={draft.coverage_km} onChange={(v) => set('coverage_km', v)} /></Field>
      </Row>
      <Row>
        <Field label="Battery years"><NumInput value={draft.battery_coverage_years} onChange={(v) => set('battery_coverage_years', v)} /></Field>
        <Field label="Battery km"><NumInput value={draft.battery_coverage_km} onChange={(v) => set('battery_coverage_km', v)} /></Field>
      </Row>
      <Row>
        <Field label="Battery min SoH %"><NumInput value={draft.battery_min_soh_pct} onChange={(v) => set('battery_min_soh_pct', v)} /></Field>
        <Field label="Max service overdue (days)"><NumInput value={draft.max_service_overdue_days} onChange={(v) => set('max_service_overdue_days', v)} /></Field>
      </Row>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
        <input type="checkbox" checked={draft.service_schedule_required} onChange={(e) => set('service_schedule_required', e.target.checked)} />
        <span className="t-sec">Adherence to the service schedule is required</span>
      </label>

      <Row>
        <Field label="Covered components (one per line)">
          <textarea className="input" rows={6} value={draft.covered_text} onChange={(e) => set('covered_text', e.target.value)} placeholder={'drive motor\nbattery pack\nbms'} />
        </Field>
        <Field label="Excluded components (one per line)">
          <textarea className="input" rows={6} value={draft.excluded_text} onChange={(e) => set('excluded_text', e.target.value)} placeholder={'tyres\nbrake pads\npaint'} />
        </Field>
      </Row>

      <div>
        <div className="label-caps" style={{ marginBottom: 8 }}>Clauses (citable T&amp;C text)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {draft.clauses.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input className="input tnum" style={{ width: 72, flex: 'none' }} placeholder="4.2" value={c.id} onChange={(e) => setClause(i, 'id', e.target.value)} />
              <textarea className="input" rows={2} style={{ flex: 1 }} placeholder="Clause text…" value={c.text} onChange={(e) => setClause(i, 'text', e.target.value)} />
              <button className="btn" style={{ padding: '6px 10px', flex: 'none' }} onClick={removeClause.bind(null, i)} type="button" aria-label="Remove clause">✕</button>
            </div>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 10, padding: '5px 12px', fontSize: 12.5 }} onClick={addClause} type="button">+ Add clause</button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" disabled={!canSave} onClick={onSave}>
          {busy ? 'Saving…' : 'Save version'}
        </button>
        {error && <span style={{ color: 'var(--critical)', fontSize: 12.5 }}>{error}</span>}
      </div>
    </div>
  )
}

function FileImport({ onImported }: { onImported: (created: Policy[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file?: File) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onImported(await api.importPolicy(file))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <p className="t-sec" style={{ fontSize: 13.5, marginTop: 0, lineHeight: 1.55 }}>
        Upload a <strong>.yaml</strong> or <strong>.json</strong> file matching the policy schema
        (a single object or a list). Each version is validated and saved as-is.
      </p>
      <input ref={ref} type="file" accept=".yaml,.yml,.json,application/json,text/yaml" disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])} />
      {busy && <div className="t-muted" style={{ fontSize: 12.5, marginTop: 10 }}>Importing…</div>}
      {error && <div style={{ color: 'var(--critical)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
    </div>
  )
}

function DocExtract({ onDraft }: { onDraft: (d: PolicyDraft) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file?: File) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onDraft(await api.extractPolicy(file))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <p className="t-sec" style={{ fontSize: 13.5, marginTop: 0, lineHeight: 1.55 }}>
        Upload a raw T&amp;C document (<strong>.pdf</strong> or <strong>.txt</strong>). Claude reads
        it and pre-fills the structured form with the terms it finds — you then review and correct
        every field before saving. Nothing is saved automatically.
      </p>
      <input ref={ref} type="file" accept=".pdf,.txt,text/plain,application/pdf" disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])} />
      {busy && <div className="t-muted" style={{ fontSize: 12.5, marginTop: 10 }}>Reading &amp; extracting…</div>}
      {error && <div style={{ color: 'var(--critical)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`btn ${active ? 'btn-primary' : ''}`}
      style={{ padding: '6px 14px', fontSize: 13 }}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-caps" style={{ marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      className="input tnum"
      type="number"
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  )
}
