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

interface Datum {
  label: string
  count: number
}

function TopNTooltip({ active, payload, color }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Datum
  return (
    <div className="panel" style={{ padding: '8px 12px', fontSize: 13 }}>
      <span style={{ fontWeight: 700, color }}>{d.label}</span>
      <span className="t-sec"> · {d.count}</span>
    </div>
  )
}

interface Props {
  data: Datum[]
  color?: string
  layout?: 'horizontal' | 'vertical'
  labelWidth?: number
  height?: number
}

// Flexible top-N bar chart: vertical (default) or horizontal
export function TopNBar({ data, color = 'var(--series-3)', layout = 'vertical', labelWidth = 140, height }: Props) {
  if (!data.length) {
    return <div className="t-muted" style={{ fontSize: 13, padding: '24px 0' }}>No data yet.</div>
  }

  if (layout === 'horizontal') {
    const h = height ?? Math.max(140, data.length * 46)
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          />
          <Tooltip content={<TopNTooltip color={color} />} cursor={{ fill: 'var(--hover)' }} />
          <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={16} isAnimationActive={false}>
            {data.map((_, i) => <Cell key={i} fill={color} />)}
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

  // Vertical bars (default) for top parts / components
  return (
    <ResponsiveContainer width="100%" height={height ?? 220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 20, bottom: 60 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          interval={0}
          angle={-35}
          textAnchor="end"
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={36} />
        <Tooltip content={<TopNTooltip color={color} />} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false}>
          {data.map((_, i) => <Cell key={i} fill={color} />)}
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
