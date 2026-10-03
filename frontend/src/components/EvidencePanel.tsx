import type { Evidence } from '../api/types'
import { fmtDate } from '../lib/format'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
      <span className="t-muted" style={{ fontSize: 12.5 }}>{label}</span>
      <span className="tnum" style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Card({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: 16, flex: 1, minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="label-caps">{title}</div>
        <span className="badge badge-neutral" style={{ padding: '2px 8px', fontSize: 10.5 }}>{tag}</span>
      </div>
      {children}
    </div>
  )
}

export function EvidencePanel({ evidence }: { evidence: Evidence }) {
  const { crm, telematics: t } = evidence
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <Card title="Vehicle & CRM" tag="Zoho">
        <Row label="Record found" value={crm.found ? 'Yes' : 'No'} />
        <Row label="Sale date" value={fmtDate(crm.sale_date)} />
        <Row label="Owner" value={crm.owner_name || '—'} />
        <Row label="Job cards" value={crm.job_cards} />
        <Row label="Prior claims" value={crm.prior_claim_ids.length} />
      </Card>

      <Card title="Live telematics" tag="Argus">
        <Row label="Status" value={t.running_status} />
        <Row label="Odometer" value={`${t.total_km.toLocaleString()} km`} />
        <Row
          label="Battery SoH"
          value={
            <span style={{ color: t.battery_soh_pct < 70 ? 'var(--warning)' : 'var(--good)' }}>
              {t.battery_soh_pct}%
            </span>
          }
        />
        <Row label="Pack voltage" value={`${t.battery_voltage_v} V`} />
        <Row label="Charge cycles" value={`${t.total_charge_cycles} (DC ${t.dc_fast_charge_cycles})`} />
      </Card>
    </div>
  )
}
