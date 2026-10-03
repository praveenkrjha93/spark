import type { Decision } from '../api/types'
import { titleCase } from '../lib/format'
import { VerdictBadge } from './VerdictBadge'
import { ConfidenceMeter } from './ConfidenceMeter'
import { EvidencePanel } from './EvidencePanel'
import { ReasoningTrace } from './ReasoningTrace'

/** Read-only rendering of a decision: verdict, confidence, anomalies,
 *  grounding evidence and the reasoning trace. Reused by the New Claim result
 *  and the All Claims detail view. */
export function DecisionView({ decision }: { decision: Decision }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="label-caps">Decision</span>
          <VerdictBadge verdict={decision.verdict} />
          {decision.rejection_category && (
            <span className="badge badge-neutral">{titleCase(decision.rejection_category)}</span>
          )}
          {decision.overridden && <span className="badge badge-neutral">Human override</span>}
        </div>
        <div style={{ fontSize: 14, marginBottom: 14, lineHeight: 1.55 }}>{decision.summary}</div>
        <ConfidenceMeter value={decision.confidence} />
      </div>

      {decision.anomalies.length > 0 && (
        <div
          className="panel"
          style={{ padding: 16, borderColor: 'rgba(236,131,90,0.4)', background: 'rgba(236,131,90,0.06)' }}
        >
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

      <div className="panel" style={{ padding: 18 }}>
        <div className="label-caps" style={{ marginBottom: 10 }}>Grounding evidence</div>
        <EvidencePanel evidence={decision.evidence} />
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div className="label-caps" style={{ marginBottom: 12 }}>Reasoning trace</div>
        <ReasoningTrace steps={decision.reasoning_trace} />
      </div>
    </div>
  )
}
