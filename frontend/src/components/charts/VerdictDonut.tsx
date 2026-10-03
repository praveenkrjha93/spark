import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Verdict } from '../../api/types'
import { VERDICT_META } from '../../lib/format'

const COLORS: Record<Verdict, string> = {
  VALID: 'var(--good)',
  REJECTED: 'var(--critical)',
  NEEDS_REVIEW: 'var(--warning)',
}

interface Datum {
  verdict: Verdict
  count: number
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Datum
  return (
    <div className="panel" style={{ padding: '8px 12px', fontSize: 13 }}>
      <span style={{ color: COLORS[d.verdict], fontWeight: 700 }}>
        {VERDICT_META[d.verdict].label}
      </span>
      <span className="t-sec"> · {d.count} claims</span>
    </div>
  )
}

export function VerdictDonut({ data }: { data: Datum[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div>
      <div style={{ position: 'relative', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="verdict"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={3}
              stroke="var(--surface-1)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.verdict} fill={COLORS[d.verdict]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div className="tnum" style={{ fontSize: 40, fontWeight: 700 }}>{total}</div>
          <div className="label-caps">claims</div>
        </div>
      </div>

      {/* Legend — identity is never carried by color alone */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        {data.map((d) => (
          <div key={d.verdict} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[d.verdict] }} />
            <span className="t-sec">{VERDICT_META[d.verdict].label}</span>
            <span className="tnum" style={{ fontWeight: 600 }}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
