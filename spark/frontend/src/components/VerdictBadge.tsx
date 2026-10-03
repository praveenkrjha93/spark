import type { Verdict } from '../api/types'
import { VERDICT_META } from '../lib/format'

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const m = VERDICT_META[verdict]
  return (
    <span className={`badge ${m.badge}`}>
      <span className="dot" />
      {m.label}
    </span>
  )
}
