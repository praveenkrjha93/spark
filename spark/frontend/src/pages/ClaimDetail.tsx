import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { ClaimRow, QueueItem } from '../api/types'
import { titleCase, pct, fmtDate } from '../lib/format'
import { VerdictBadge } from '../components/VerdictBadge'
import { DecisionView } from '../components/DecisionView'
import { ClaimDetailPanel } from '../components/ClaimDetailPanel'

export function ClaimDetail({ onChanged }: { onChanged: () => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState<ClaimRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const claimId = Number(id)

  function load() {
    setLoading(true)
    api.claim(claimId)
      .then((r) => { setRow(r); setError(null) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!Number.isFinite(claimId)) { setError('Invalid claim id'); setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId])

  return (
    <div>
      <button className="btn" style={{ marginBottom: 18 }} onClick={() => navigate('/claims')}>
        ← Back to claims
      </button>

      {error ? (
        <div className="panel" style={{ padding: 24, borderColor: 'rgba(208,59,59,0.4)' }}>
          <div style={{ color: 'var(--critical)', fontWeight: 700, marginBottom: 8 }}>Could not load claim</div>
          <div className="t-sec" style={{ fontSize: 13 }}>{error}</div>
        </div>
      ) : loading || !row ? (
        <div className="panel skeleton" style={{ height: 460 }} />
      ) : (
        <section className="panel" style={{ padding: 24 }}>
          {row.task && row.decision ? (
            <ClaimDetailPanel
              key={row.task.id}
              item={{ task: row.task, claim: row.claim, decision: row.decision } as QueueItem}
              onResolved={() => { onChanged(); navigate('/claims') }}
            />
          ) : (
            <ReadOnlyDetail row={row} />
          )}
        </section>
      )}
    </div>
  )
}

function ReadOnlyDetail({ row }: { row: ClaimRow }) {
  const { claim, decision } = row
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{titleCase(claim.component)}</h2>
          {decision && <VerdictBadge verdict={decision.verdict} />}
          {decision && (
            <span className="t-muted tnum" style={{ fontSize: 12.5 }}>{pct(decision.confidence)} confidence</span>
          )}
        </div>
        <div className="t-muted tnum" style={{ fontSize: 12.5, marginTop: 6 }}>
          Claim #{claim.id} · VIN {claim.vin} · {claim.odometer_km.toLocaleString()} km ·{' '}
          {claim.claim_date && fmtDate(claim.claim_date)} · {claim.dealer || '—'} · {claim.parts_genuine ? 'genuine parts' : 'non-genuine parts'}
        </div>
      </div>

      <p className="t-sec" style={{ margin: 0, fontSize: 14, lineHeight: 1.55, fontStyle: 'italic' }}>
        “{claim.failure_description}”
      </p>

      {decision ? (
        <DecisionView decision={decision} />
      ) : (
        <div className="t-muted panel" style={{ padding: 20 }}>No decision recorded yet.</div>
      )}
    </div>
  )
}
