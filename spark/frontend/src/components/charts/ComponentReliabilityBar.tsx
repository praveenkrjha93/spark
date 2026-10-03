import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ComponentFailure } from '../../api/types'
import { titleCase } from '../../lib/format'

// Verdict is a *status* encoding — fixed good/critical/warning, shown with a
// legend + tooltip so identity is never carried by color alone.
const SERIES = [
  { key: 'valid', label: 'Valid', color: 'var(--good)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--critical)' },
  { key: 'needs_review', label: 'Needs review', color: 'var(--warning)' },
] as const

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ComponentFailure
  return (
    <div className="panel" style={{ padding: '10px 12px', fontSize: 12.5 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{titleCase(String(label))}</div>
      {SERIES.map((s) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
          <span className="t-sec">{s.label}</span>
          <span className="tnum" style={{ marginLeft: 'auto', fontWeight: 600 }}>
            {(d as any)[s.key]}
          </span>
        </div>
      ))}
      <div className="t-muted tnum" style={{ marginTop: 6 }}>{d.total} total claims</div>
    </div>
  )
}

export function ComponentReliabilityBar({ data }: { data: ComponentFailure[] }) {
  if (!data.length) {
    return <div className="t-muted" style={{ fontSize: 13, padding: '24px 0' }}>No claims yet.</div>
  }
  const rows = [...data].sort((a, b) => b.total - a.total)
  const height = Math.max(160, rows.length * 44)
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="component"
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            tickFormatter={titleCase}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover)' }} />
          {SERIES.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="v"
              fill={s.color}
              barSize={16}
              stroke="var(--surface-1)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend — always present for a multi-series chart */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
        {SERIES.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="t-sec">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
