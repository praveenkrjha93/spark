import { useState } from 'react'
import { api } from '../api/client'
import type { HumanDecision, QueueItem } from '../api/types'
import { titleCase, fmtDate } from '../lib/format'
import { VerdictBadge } from './VerdictBadge'
import { ConfidenceMeter } from './ConfidenceMeter'
import { EvidencePanel } from './EvidencePanel'
import { ReasoningTrace } from './ReasoningTrace'

export function ClaimDetailPanel({ item, onResolved }: { item: QueueItem; onResolved: () => void }) {
  const { claim, decision, task } = item
  const [notes, setNotes] = useState('')
  const [reviewer, setReviewer] = useState('reviewer.jane')
  const [busy, setBusy] = useState<HumanDecision | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(decisionType: HumanDecision) {
    setBusy(decisionType)
    setError(null)
    try {
      await api.reviewDecision(task.id, {
        human_decision: decisionType,
        override_notes: notes,
        resolved_by: reviewer,
      })
      onResolved()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{titleCase(claim.component)}</h2>
          <VerdictBadge verdict={decision.verdict} />
          {decision.rejection_category && (
            <span className="badge badge-neutral">{titleCase(decision.rejection_category)}</span>
          )}
        </div>
        <div className="t-muted tnum" style={{ fontSize: 12.5, marginTop: 6 }}>
          Claim #{claim.id} · VIN {claim.vin} · {claim.odometer_km.toLocaleString()} km ·{' '}
          {claim.claim_date && fmtDate(claim.claim_date)} · {claim.dealer}
        </div>
      </div>

      <p className="t-sec" style={{ margin: 0, fontSize: 14, lineHeight: 1.55, fontStyle: 'italic' }}>
        “{claim.failure_description}”
      </p>

      {/* Verdict summary + confidence */}
      <div className="panel" style={{ padding: 16, background: 'var(--surface-2)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{decision.summary}</div>
        <ConfidenceMeter value={decision.confidence} />
      </div>

      {/* Anomalies */}
      {decision.anomalies.length > 0 && (
        <div className="panel" style={{ padding: 16, borderColor: 'rgba(236,131,90,0.4)',
          background: 'rgba(236,131,90,0.06)' }}>
          <div className="label-caps" style={{ color: 'var(--serious)', marginBottom: 8 }}>
            ⚠ Data anomalies flagged
          </div>
          {decision.anomalies.map((a, i) => (
            <div key={i} className="t-sec" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{titleCase(a.type)}</strong> — {a.detail}
            </div>
          ))}
        </div>
      )}

      {/* Evidence */}
      <div>
        <div className="label-caps" style={{ marginBottom: 10 }}>Grounding evidence</div>
        <EvidencePanel evidence={decision.evidence} />
      </div>

      {/* Reasoning trace */}
      <div>
        <div className="label-caps" style={{ marginBottom: 12 }}>Reasoning trace</div>
        <ReasoningTrace steps={decision.reasoning_trace} />
      </div>

      {/* Reviewer actions */}
      <div className="panel" style={{ padding: 18 }}>
        <div className="label-caps" style={{ marginBottom: 12 }}>Your decision</div>
        <textarea
          className="input"
          rows={3}
          placeholder="Reviewer notes (recorded on the audit trail)…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ width: 160 }}
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            aria-label="Reviewer id"
          />
          <div style={{ flex: 1 }} />
          <button className="btn btn-good" disabled={!!busy} onClick={() => submit('APPROVED')}>
            {busy === 'APPROVED' ? 'Approving…' : 'Approve'}
          </button>
          <button className="btn btn-critical" disabled={!!busy} onClick={() => submit('REJECTED')}>
            {busy === 'REJECTED' ? 'Rejecting…' : 'Reject'}
          </button>
          <button className="btn" disabled={!!busy} onClick={() => submit('INFO_REQUESTED')}>
            {busy === 'INFO_REQUESTED' ? 'Requesting…' : 'Request info'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--critical)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  )
}
