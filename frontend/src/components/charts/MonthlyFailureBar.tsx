import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Datum {
  month: string
  count: number
}

function fmt(month: string) {
  // "2025-01" → "Jan 25"
  try {
    const [y, m] = month.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleString('en-GB', { month: 'short' }) + ' ' + String(y).slice(2)
  } catch {
    return month
  }
}

function MonthTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Datum
  return (
    <div className="panel" style={{ padding: '8px 12px', fontSize: 13 }}>
      <span style={{ fontWeight: 700 }}>{fmt(d.month)}</span>
      <span className="t-sec"> · {d.count} claims</span>
    </div>
  )
}

export function MonthlyFailureBar({ data }: { data: Datum[] }) {
  if (!data.length) {
    return <div className="t-muted" style={{ fontSize: 13, padding: '24px 0' }}>No data yet.</div>
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 16, top: 20, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          tickFormatter={fmt}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          width={32}
        />
        <Tooltip content={<MonthTooltip />} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="count" fill="var(--series-4)" radius={[4, 4, 0, 0]} barSize={18} isAnimationActive={false}>
          <LabelList
            dataKey="count"
            position="top"
            style={{ fill: 'var(--text-secondary)', fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
