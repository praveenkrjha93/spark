import type { ReactNode } from 'react'

interface Props {
  label: string
  value: ReactNode
  hint?: string
  accent?: string // css color for the value glow
}

export function StatTile({ label, value, hint, accent = 'var(--accent)' }: Props) {
  return (
    <div className="panel panel-hover" style={{ padding: '18px 20px' }}>
      <div className="label-caps">{label}</div>
      <div
        className="tnum"
        style={{
          fontSize: 34,
          fontWeight: 700,
          marginTop: 8,
          lineHeight: 1.05,
          color: 'var(--text-primary)',
          textShadow: `0 0 22px ${accent}55`,
        }}
      >
        {value}
      </div>
      {hint && (
        <div className="t-muted" style={{ fontSize: 12, marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  )
}
