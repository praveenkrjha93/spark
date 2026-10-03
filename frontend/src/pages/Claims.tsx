import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AnalyticsSummary, ClaimPage, ClaimStatusFilter } from '../api/types'
import { titleCase, VERDICT_META, pct, fmtDate } from '../lib/format'
import { VerdictBadge } from '../components/VerdictBadge'

const FILTERS: { key: ClaimStatusFilter; label: string }[] = [
  { key: 'REVIEW', label: 'Needs review' },
  { key: 'ALL', label: 'All' },
  { key: 'VALID', label: 'Valid' },
  { key: 'REJECTED', label: 'Rejected' },
]

const PAGE_SIZE = 25

export function Claims({ onChanged: _onChanged }: { onChanged: () => void }) {
  const navigate = useNavigate()
  const [data, setData] = useState<ClaimPage | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ClaimStatusFilter>('ALL')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Debounce the search box so each keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Changing the filter or search resets to the first page.
  useEffect(() => { setPage(1) }, [filter, debouncedQ])

  useEffect(() => {
    api.analytics().then(setSummary).catch(() => {})
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true)
    api.claims({ status: filter, q: debouncedQ, page, page_size: PAGE_SIZE })
      .then((d) => { if (live) { setData(d); setError(null) } })
      .catch((e) => { if (live) setError(String(e)) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [filter, debouncedQ, page])

  const counts = data?.counts
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const reviewCount = counts?.REVIEW ?? 0

  if (error) return <ErrorState error={error} />

  return (
    <div>
      <HeroBand reviewCount={reviewCount} summary={summary} onNew={() => navigate('/claims/new')} />

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '20px 0 16px', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`btn ${filter === f.key ? 'btn-primary' : ''}`}
            style={{ padding: '6px 13px', fontSize: 13 }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {counts ? <span className="tnum" style={{ opacity: 0.75 }}> · {counts[f.key]}</span> : null}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Search VIN, component, dealer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading && !data ? (
        <TableSkeleton />
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Component</Th>
                  <Th>VIN</Th>
                  <Th right>Odometer</Th>
                  <Th>Claim date</Th>
                  <Th>Dealer</Th>
                  <Th>{''}</Th>
                </tr>
              </thead>
              <tbody>
                {data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState review={filter === 'REVIEW'} searching={!!debouncedQ} />
                    </td>
                  </tr>
                )}
                {data?.items.map((r) => {
                  const v = r.decision?.verdict
                  return (
                    <tr
                      key={r.claim.id}
                      className="claim-row"
                      onClick={() => navigate(`/claims/${r.claim.id}`)}
                      style={{ borderLeft: v ? `3px solid ${VERDICT_META[v].color}` : '3px solid var(--border)' }}
                    >
                      <Td>
                        {v ? <VerdictBadge verdict={v} /> : <span className="badge badge-neutral">Pending</span>}
                      </Td>
                      <Td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{titleCase(r.claim.component)}</span></Td>
                      <Td className="tnum">{r.claim.vin}</Td>
                      <Td right className="tnum">{r.claim.odometer_km.toLocaleString()} km</Td>
                      <Td className="tnum">{fmtDate(r.claim.claim_date)}</Td>
                      <Td>{r.claim.dealer || '—'}</Td>
                      <Td right>
                        <span className="t-muted" aria-hidden style={{ fontSize: 16 }}>›</span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap',
          }}>
            <span className="t-muted tnum" style={{ fontSize: 12.5 }}>
              {total === 0 ? 'No claims' : `Showing ${from}–${to} of ${total.toLocaleString()}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn" style={{ padding: '6px 12px', fontSize: 13 }}
                disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Prev
              </button>
              <span className="t-muted tnum" style={{ fontSize: 12.5 }}>Page {page} of {totalPages}</span>
              <button className="btn" style={{ padding: '6px 12px', fontSize: 13 }}
                disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Landing hero ────────────────────────────────────────────────────────────
function HeroBand({
  reviewCount, summary, onNew,
}: {
  reviewCount: number
  summary: AnalyticsSummary | null
  onNew: () => void
}) {
  return (
    <section
      className="panel"
      style={{
        position: 'relative', overflow: 'hidden', padding: '22px 28px',
        background: 'linear-gradient(135deg, rgba(57,135,229,0.08), rgba(25,158,112,0.05) 55%, rgba(255,255,255,0.01))',
      }}
    >
      <div style={{
        position: 'absolute', top: -80, right: -40, width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(57,135,229,0.14), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap', position: 'relative',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
          <Metric label="Total claims" value={summary ? summary.totals.claims : '—'} accent="var(--accent)" />
          <Metric label="Needs review" value={reviewCount} accent="var(--warning)" />
          <Metric label="Auto-approval" value={summary ? pct(summary.auto_approval_rate) : '—'} accent="var(--good)" />
          <Metric label="Anomalies" value={summary ? summary.anomaly_count : '—'} accent="var(--serious)" last />
        </div>
        <button className="btn btn-primary" style={{ padding: '11px 18px', fontSize: 14 }} onClick={onNew}>
          + New claim
        </button>
      </div>
    </section>
  )
}

function Metric({ label, value, accent, last }: { label: string; value: React.ReactNode; accent: string; last?: boolean }) {
  return (
    <div style={{ padding: '0 26px', borderRight: last ? 'none' : '1px solid var(--border)', minWidth: 120 }}>
      <div className="tnum" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)', textShadow: `0 0 20px ${accent}55` }}>
        {value}
      </div>
      <div className="label-caps" style={{ marginTop: 7 }}>{label}</div>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ padding: '11px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: right ? 'right' : 'left', color: 'var(--text-muted)' }}>
      {children}
    </th>
  )
}

function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={className} style={{ padding: '11px 14px', textAlign: right ? 'right' : 'left', color: 'var(--text-secondary)', fontSize: 13 }}>
      {children}
    </td>
  )
}

function TableSkeleton() {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 34, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ review, searching }: { review: boolean; searching: boolean }) {
  return (
    <div style={{ padding: '34px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, marginBottom: 6 }}>{review && !searching ? '✓' : '🔍'}</div>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
        {searching ? 'No claims match your search' : review ? 'Nothing waiting on you' : 'No claims yet'}
      </div>
      <div className="t-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
        {searching ? 'Try a different VIN, component, or dealer.'
          : review ? 'Every flagged claim has been resolved.'
          : 'Raise a claim to get started.'}
      </div>
    </div>
  )
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="panel" style={{ padding: 24, borderColor: 'rgba(208,59,59,0.4)' }}>
      <div style={{ color: 'var(--critical)', fontWeight: 700, marginBottom: 8 }}>Could not load claims</div>
      <div className="t-sec" style={{ fontSize: 13 }}>{error}</div>
    </div>
  )
}
