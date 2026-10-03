import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { titleCase } from '../../lib/format'

interface Datum {
  category: string
  count: number
}

function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Datum
  return (
    <div className="panel" style={{ padding: '8px 12px', fontSize: 13 }}>
      <span style={{ fontWeight: 700 }}>{titleCase(d.category)}</span>
      <span className="t-sec"> · {d.count} rejected</span>
    </div>
  )
}

// Magnitude of a single measure across categories -> one hue, sorted desc.
export function CategoryBar({ data }: { data: Datum[] }) {
  if (!data.length) {
    return <div className="t-muted" style={{ fontSize: 13, padding: '24px 0' }}>No rejections yet.</div>
  }
  const rows = [...data].sort((a, b) => b.count - a.count)
  const height = Math.max(140, rows.length * 46)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 34, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="category"
          width={148}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          tickFormatter={titleCase}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={16} isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.category} fill="var(--series-1)" />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fill: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
