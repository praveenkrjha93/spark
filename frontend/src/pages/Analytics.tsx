import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { AnalyticsSummary, FailureModeSummary, TrendsSummary } from '../api/types'
import { titleCase, pct } from '../lib/format'
import { StatTile } from '../components/StatTile'
import { VerdictDonut } from '../components/charts/VerdictDonut'
import { CategoryBar } from '../components/charts/CategoryBar'
import { ComponentReliabilityBar } from '../components/charts/ComponentReliabilityBar'
import { MonthlyFailureBar } from '../components/charts/MonthlyFailureBar'
import { TopNBar } from '../components/charts/TopNBar'

export function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [failure, setFailure] = useState<FailureModeSummary | null>(null)
  const [trends, setTrends] = useState<TrendsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.analytics().then(setSummary).catch((e) => setError(String(e)))
    api.failureModes().then(setFailure).catch((e) => setError(String(e)))
    api.trends().then(setTrends).catch(() => {/* trends are optional — don't crash the page */})
  }, [])

  const mostRejected = useMemo(() => {
    if (!failure?.components.length) return null
    return [...failure.components].sort((a, b) => b.rejected - a.rejected)[0]
  }, [failure])

  if (error) return <ErrorState error={error} />
  if (!summary) return <div className="t-muted" style={{ padding: 40 }}>Loading…</div>

  const autoText = `${summary.totals.valid + summary.totals.rejected} auto-decided`

  return (
    <div>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>Analytics</h1>
        <p className="t-muted" style={{ margin: '6px 0 0', fontSize: 14, maxWidth: 660 }}>
          Claim decisioning and component reliability at a glance — grounded in Zoho CRM + Argus telematics.
        </p>
      </header>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        <StatTile label="Total claims" value={summary.totals.claims} hint="all-time submitted" />
        <StatTile label="Auto-approval rate" value={pct(summary.auto_approval_rate)} hint={autoText} accent="var(--good)" />
        <StatTile label="Open reviews" value={summary.open_reviews} hint="awaiting a human" accent="var(--warning)" />
        <StatTile label="Avg confidence" value={pct(summary.avg_confidence)} hint="across all decisions" />
        <StatTile label="Anomalies flagged" value={summary.anomaly_count} hint="data inconsistencies" accent="var(--serious)" />
      </div>

      {/* Verdict + rejection reasons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16, marginBottom: 20 }}>
        <section className="panel" style={{ padding: 22 }}>
          <div className="label-caps" style={{ marginBottom: 14 }}>Verdict distribution</div>
          <VerdictDonut data={summary.verdict_distribution} />
        </section>
        <section className="panel" style={{ padding: 22 }}>
          <div className="label-caps" style={{ marginBottom: 14 }}>Why claims are rejected</div>
          <div style={{ marginTop: 6 }}>
            <CategoryBar data={summary.rejection_categories} />
          </div>
        </section>
      </div>

      {/* Component reliability */}
      {failure && failure.components.length > 0 && (
        <>
          {mostRejected && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              <StatTile label="Components with claims" value={failure.total_components} hint={`${failure.total_claims} claims total`} />
              <StatTile label="Most-rejected component" value={titleCase(mostRejected.component)} hint={`${mostRejected.rejected} rejected`} accent="var(--critical)" />
            </div>
          )}
          <section className="panel" style={{ padding: 22, marginBottom: 20 }}>
            <div className="label-caps" style={{ marginBottom: 14 }}>Component reliability — verdict split by component</div>
            <ComponentReliabilityBar data={failure.components} />
          </section>

          <section className="panel" style={{ padding: 22, marginBottom: 20 }}>
            <div className="label-caps" style={{ marginBottom: 14 }}>Failure-mode detail</div>
            <FailureTable data={failure} />
          </section>
        </>
      )}

      {/* Warranty trends (mirrors the Excel PFR dashboard) */}
      {trends && (
        <>
          <h2 style={{ margin: '8px 0 16px', fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Warranty trends
          </h2>

          {/* Monthly failure volume */}
          <section className="panel" style={{ padding: 22, marginBottom: 16 }}>
            <div className="label-caps" style={{ marginBottom: 14 }}>Failure month wise data</div>
            <MonthlyFailureBar data={trends.monthly_failures} />
          </section>

          {/* Top 10 parts + Top 10 failure modes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <section className="panel" style={{ padding: 22 }}>
              <div className="label-caps" style={{ marginBottom: 14 }}>Top 10 failure parts</div>
              <TopNBar
                data={trends.top_parts.map((d) => ({ label: d.part, count: d.count }))}
                color="#5a6476"
              />
            </section>
            <section className="panel" style={{ padding: 22 }}>
              <div className="label-caps" style={{ marginBottom: 14 }}>Top 10 failure mode</div>
              <TopNBar
                data={trends.top_failure_modes.map((d) => ({ label: d.mode, count: d.count }))}
                color="var(--series-4)"
              />
            </section>
          </div>

          {/* Top 10 cities + Top 10 components */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <section className="panel" style={{ padding: 22 }}>
              <div className="label-caps" style={{ marginBottom: 14 }}>Top 10 city wise failure</div>
              <TopNBar
                data={trends.top_dealers.map((d) => ({ label: d.dealer, count: d.count }))}
                color="var(--series-1)"
              />
            </section>
            <section className="panel" style={{ padding: 22 }}>
              <div className="label-caps" style={{ marginBottom: 14 }}>Top 10 components</div>
              <TopNBar
                data={trends.top_components.map((d) => ({ label: titleCase(d.component), count: d.count }))}
                color="var(--series-2)"
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function FailureTable({ data }: { data: FailureModeSummary }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr className="t-muted" style={{ textAlign: 'left' }}>
            <Th>Component</Th>
            <Th right>Claims</Th>
            <Th right>Valid</Th>
            <Th right>Rejected</Th>
            <Th right>Review</Th>
            <Th right>Approval</Th>
            <Th right>Avg km</Th>
            <Th>Top failure mode</Th>
          </tr>
        </thead>
        <tbody>
          {data.components.map((c) => (
            <tr key={c.component} style={{ borderTop: '1px solid var(--border)' }}>
              <Td><span style={{ fontWeight: 600 }}>{titleCase(c.component)}</span></Td>
              <Td right className="tnum">{c.total}</Td>
              <Td right className="tnum" color="var(--good)">{c.valid}</Td>
              <Td right className="tnum" color="var(--critical)">{c.rejected}</Td>
              <Td right className="tnum" color="var(--warning)">{c.needs_review}</Td>
              <Td right className="tnum">{c.approval_rate === null ? '—' : pct(c.approval_rate)}</Td>
              <Td right className="tnum">{c.avg_odometer_km.toLocaleString()}</Td>
              <Td>
                {c.top_rejection ? (
                  <span className="badge badge-neutral">{titleCase(c.top_rejection)}</span>
                ) : (
                  <span className="t-muted">—</span>
                )}
                {c.anomalies > 0 && (
                  <span className="badge badge-warning" style={{ marginLeft: 6 }}>{c.anomalies} anomaly</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ padding: '6px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: right ? 'right' : 'left' }}>
      {children}
    </th>
  )
}

function Td({ children, right, color, className }: { children: React.ReactNode; right?: boolean; color?: string; className?: string }) {
  return (
    <td className={className} style={{ padding: '9px 12px', textAlign: right ? 'right' : 'left', color: color ?? 'var(--text-secondary)' }}>
      {children}
    </td>
  )
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="panel" style={{ padding: 24, borderColor: 'rgba(208,59,59,0.4)' }}>
      <div style={{ color: 'var(--critical)', fontWeight: 700, marginBottom: 8 }}>Could not reach the API</div>
      <div className="t-sec" style={{ fontSize: 13 }}>{error}</div>
    </div>
  )
}
