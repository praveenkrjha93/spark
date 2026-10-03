import { pct } from '../lib/format'

export function ConfidenceMeter({ value }: { value: number }) {
  return (
    <div>
      <div
        className="t-muted"
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}
      >
        <span>Model confidence</span>
        <span className="tnum" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {pct(value)}
        </span>
      </div>
      <div className="meter">
        <span style={{ width: `${Math.max(3, Math.min(100, value * 100))}%` }} />
      </div>
    </div>
  )
}
