import type { TraceStep } from '../api/types'

const STAGE_LABEL: Record<string, string> = {
  enrichment: 'Enrich',
  rule: 'Rule',
  anomaly: 'Anomaly',
  reasoning: 'Reasoning',
  decision: 'Decision',
  'human-review': 'Human review',
}

function dotColor(stage: string): string {
  if (stage === 'anomaly') return 'var(--serious)'
  if (stage === 'decision') return 'var(--accent)'
  if (stage === 'human-review') return 'var(--good)'
  return 'var(--accent)'
}

export function ReasoningTrace({ steps }: { steps: TraceStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12 }}>
            <span className="tl-dot" style={{ background: dotColor(s.stage),
              boxShadow: `0 0 0 4px ${dotColor(s.stage)}22` }} />
            {i < steps.length - 1 && <span className="tl-line" />}
          </div>
          <div style={{ paddingBottom: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span className="label-caps" style={{ color: 'var(--text-secondary)' }}>
                {STAGE_LABEL[s.stage] ?? s.stage}
              </span>
              {s.clause && (
                <span className="badge badge-neutral" style={{ padding: '1px 7px', fontSize: 10.5 }}>
                  clause {s.clause}
                </span>
              )}
            </div>
            <div className="t-sec" style={{ fontSize: 13, lineHeight: 1.5 }}>{s.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
