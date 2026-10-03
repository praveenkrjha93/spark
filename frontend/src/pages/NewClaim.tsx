import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { ClaimCreate, Decision, Policy, UploadRef, Vehicle, VehicleDetail } from '../api/types'
import { DecisionView } from '../components/DecisionView'
import { fmtDate } from '../lib/format'
import { useAuth } from '../auth/AuthContext'

const today = () => new Date().toISOString().slice(0, 10)



const WARRANTY_PACKAGES = [
  { code: 'OBEN-STD',      label: 'Standard Warranty (STD)' },
  { code: 'OBEN-BATT-880', label: 'Battery Protect 8/80' },
  { code: 'OBEN-BATT-560', label: 'Battery Protect 560' },
  { code: 'OBEN-COMP-560', label: 'Comprehensive Protect+ 560' },
  { code: 'OBEN-CHRG',     label: 'Charger Protect' },
  { code: 'OTHERS',        label: 'Others (specify)' },
]

const FAILURE_TYPES = [
  'Manufacturing Defect', 'End of Life (EOL)', 'User Abuse / Misuse',
  'External Damage', 'Environmental (Water/Heat/Dust)', 'Wear and Tear',
  'Software / Firmware', 'Unknown',
]

const SAFETY_SEVERITIES = ['Not Safety Critical', 'Low', 'Medium', 'High', 'Critical']

const LOCATION_TYPES = ['Service Centre', 'Dealer Workshop', 'Roadside Pickup', 'Customer Drop-off', 'Authorised Partner']

const ZONES = ['North', 'South', 'East', 'West', 'Central']

// Component → suggested fault codes (Oben-specific)
const COMPONENT_FAULT_CODES: Record<string, string[]> = {
  battery: ['BMS-001 — BMS Protect Error', 'BMS-002 — Low State of Health', 'BMS-003 — Deep Discharge', 'BMS-DC — Excessive DC Fast Charge Cycles'],
  motor: ['49X — MCU / Motor Controller Error', '19X — Horn / Encoder Error', 'MTR-OHT — Motor Overtemperature', 'MTR-NOS — Abnormal Noise'],
  'motor-controller': ['MCU-ERR — Controller Error', 'MCU-TMP — Overtemperature Shutoff', 'MCU-SHT — Short Circuit'],
  'motor controller': ['MCU-ERR — Controller Error', 'MCU-TMP — Overtemperature Shutoff', 'MCU-SHT — Short Circuit'],
  hmi: ['HMI-BLK — Screen Blank / No Display', 'HMI-PWR — HMI No Power', 'HMI-WET — Water Ingress'],
  charger: ['CHR-NOP — Charger No Output', 'CHR-OHT — Charger Overtemperature', 'CHR-INT — Intermittent Charging'],
  'drive belt': ['BELT-BRK — Belt Broken', 'BELT-SLP — Belt Slipping', 'BELT-ALN — Belt Misalignment'],
  'drive-belt': ['BELT-BRK — Belt Broken', 'BELT-SLP — Belt Slipping', 'BELT-ALN — Belt Misalignment'],
  'dcdc converter': ['DCDC-NOP — No 12V Output', 'DCDC-LOW — Intermittent 12V', 'DCDC-SHT — Short Circuit'],
  'wire harness': ['HRNS-CHP — Harness Chafed', 'HRNS-RAT — Rat Bite Damage', 'HRNS-BRN — Burned Connector'],
}

// Dealer city → zone
function detectZone(dealer: string): string {
  const d = dealer.toLowerCase()
  const MAP: [string[], string][] = [
    [['bengaluru', 'bangalore', 'mysore', 'hubli', 'dharwad', 'mangalore'], 'South'],
    [['hyderabad', 'secunderabad', 'warangal'], 'South'],
    [['chennai', 'coimbatore', 'madurai', 'trichy'], 'South'],
    [['mumbai', 'pune', 'nashik', 'nagpur', 'ahmedabad', 'surat', 'vadodara', 'rajkot'], 'West'],
    [['delhi', 'noida', 'gurugram', 'gurgaon', 'ghaziabad', 'chandigarh', 'jaipur', 'ludhiana', 'amritsar'], 'North'],
    [['kolkata', 'bhubaneswar', 'cuttack', 'patna', 'ranchi'], 'East'],
    [['lucknow', 'kanpur', 'agra', 'varanasi', 'indore', 'bhopal'], 'Central'],
  ]
  for (const [cities, zone] of MAP) {
    if (cities.some((c) => d.includes(c))) return zone
  }
  return ''
}

const STEP_LABELS = ['Vehicle', 'Condition', 'Fault', 'Parts', 'Team', 'Documents']

function makeEmpty(u: { name?: string; dealer?: string; location_type?: string; zone?: string }): ClaimCreate {
  return {
    vin: '', component: '', failure_description: '', odometer_km: 0,
    claim_date: today(), dealer: u.dealer ?? '', parts_genuine: true,
    warranty_package: 'OBEN-STD', attachments: [],
    fault_title: '', fault_code: '', service_observation: '',
    registration_number: '', vehicle_reporting_time: '',
    last_service_date: '', last_service_odometer: 0,
    battery_type: '', battery_version: '', vcu_id: '', hmi_number: '', sn_sku: '',
    is_first_visit: false, any_modification: false, modification_details: '',
    all_services_on_time: true, missed_service_detail: '',
    primary_part: '', product_code: '', secondary_part: '', old_serial_numbers: '',
    failure_type: '', elite_care_package: '', ho_review: false, back_data: false, pfr_name: '',
    service_engineer: u.name ?? '', submitted_by: u.name ?? '',
    asm_name: '', asm_email: '', product_specialist_1: '', product_specialist_2: '',
    zone: u.zone ?? 'South', location_type: u.location_type ?? '', service_role: '',
    safety_severity: '', customer_voice: '', issue_reported_by: '',
    error_replication: true, service_team_feedback: '', severity_remarks: '',
    steps_to_replicate: '', fault_reported_date: today(),
  }
}

// ── Small shared helpers ──────────────────────────────────────────────────────

function Field({ label, children, half, note }: {
  label: string; children: React.ReactNode; half?: boolean; note?: string
}) {
  return (
    <div style={{ marginBottom: 14, ...(half ? {} : {}) }}>
      <div className="label-caps" style={{ marginBottom: 6 }}>{label}</div>
      {children}
      {note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

function InfoPair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-primary)',
                    fontVariantNumeric: mono ? 'tabular-nums' : undefined,
                    fontFamily: mono ? 'monospace' : undefined }}>{value || '—'}</div>
    </div>
  )
}

function YesNo({
  value, onChange, id,
}: { value: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[true, false].map((opt) => (
        <label key={String(opt)} style={{ display: 'flex', alignItems: 'center', gap: 6,
                                          fontSize: 13, cursor: 'pointer' }}>
          <input type="radio" name={id} checked={value === opt}
                 onChange={() => onChange(opt)} style={{ cursor: 'pointer' }} />
          {opt ? 'Yes' : 'No'}
        </label>
      ))}
    </div>
  )
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(57,135,229,0.07)', border: '1px solid rgba(57,135,229,0.18)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)',
                  marginBottom: 16 }}>
      {children}
    </div>
  )
}

// ── Step progress indicator ───────────────────────────────────────────────────

function StepBar({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <button
            key={n}
            type="button"
            onClick={() => onJump(n)}
            style={{
              flex: 1, padding: '8px 4px', border: 'none',
              background: active ? 'rgba(57,135,229,0.14)' : done ? 'rgba(21,138,97,0.10)' : 'transparent',
              borderBottom: active ? '2px solid var(--accent)' : done ? '2px solid var(--accent-2)' : '2px solid var(--border)',
              color: active ? 'var(--accent)' : done ? 'var(--accent-2)' : 'var(--text-muted)',
              fontWeight: active || done ? 600 : 400, fontSize: 12, cursor: 'pointer',
              transition: 'all .15s ease',
              borderRadius: '6px 6px 0 0',
            }}
          >
            <span style={{ marginRight: 4, fontSize: 11 }}>
              {done ? '✓' : n}
            </span>
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── VehicleCard ───────────────────────────────────────────────────────────────

function VehicleCard({ detail }: { detail: VehicleDetail }) {
  const [techOpen, setTechOpen] = useState(false)
  const [jobsOpen, setJobsOpen] = useState(false)
  const v = detail.vehicle
  const t = detail.telematics

  const sohColor = t.battery_soh_pct >= 90 ? 'var(--good)' : t.battery_soh_pct >= 75 ? 'var(--warning)' : 'var(--critical)'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginTop: 10 }}>

      {/* Header strip */}
      <div style={{ background: 'rgba(57,135,229,0.08)', borderBottom: '1px solid var(--border)',
                    padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{v.model} {v.variant}</span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)',
                         background: 'var(--surface-2)', border: '1px solid var(--border)',
                         borderRadius: 6, padding: '2px 8px' }}>{v.vin}</span>
          {v.registration_number && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)',
                           background: 'var(--surface-2)', border: '1px solid var(--border)',
                           borderRadius: 6, padding: '2px 8px' }}>{v.registration_number}</span>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--accent-2)', fontWeight: 600 }}>
          Verified in CRM
        </span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Main info: two balanced columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px', marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InfoPair label="Owner" value={v.owner_name} />
            <InfoPair label="Phone" value={v.owner_phone} />
            <InfoPair label="Email" value={v.owner_email} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InfoPair label="Policy" value={v.policy_code} />
            <InfoPair label="Production date" value={fmtDate(v.production_date)} />
            <InfoPair label="Sale date" value={fmtDate(v.sale_date)} />
          </div>
        </div>

        {/* Telematics strip — prominent */}
        {t.found && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                        background: 'var(--surface-2)', borderRadius: 10,
                        padding: '10px 14px', gap: 0, marginBottom: 12 }}>
            <TeleStat label="Total km" value={t.total_km.toLocaleString()} />
            <TeleStat label="Battery SoC" value={`${t.battery_soh_pct}%`} valueColor={sohColor} />
            <TeleStat label="Voltage" value={`${t.battery_voltage_v} V`} />
          </div>
        )}

        {/* Collapsible: technical identifiers */}
        <button type="button" onClick={() => setTechOpen((o) => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                         border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)',
                         fontSize: 12, fontWeight: 600, marginBottom: techOpen ? 10 : 4 }}>
          <span>{techOpen ? '▾' : '▸'}</span>
          Technical identifiers
        </button>
        {techOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 24px',
                        padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8,
                        marginBottom: 10 }}>
            <InfoPair label="Battery S/N" value={v.battery_serial} mono />
            <InfoPair label="Motor S/N" value={v.motor_serial} mono />
            <InfoPair label="Controller S/N" value={v.controller_serial} mono />
            <InfoPair label="Charger S/N" value={v.charger_serial} mono />
            {v.vcu_id && <InfoPair label="VCU ID" value={v.vcu_id} mono />}
            {v.hmi_number && <InfoPair label="HMI Number" value={v.hmi_number} mono />}
            {v.battery_type && <InfoPair label="Battery type" value={`${v.battery_type} ${v.battery_version}`.trim()} />}
            {v.sn_sku && <InfoPair label="SKU" value={v.sn_sku} mono />}
          </div>
        )}

        {/* Service history toggle */}
        {detail.job_cards.length > 0 && (
          <div>
            <button type="button" onClick={() => setJobsOpen((o) => !o)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                             border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)',
                             fontSize: 12, fontWeight: 600, marginBottom: jobsOpen ? 10 : 0 }}>
              <span>{jobsOpen ? '▾' : '▸'}</span>
              Service history ({detail.job_cards.length})
            </button>
            {jobsOpen && (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 6 }}>
                <thead>
                  <tr>
                    {['Date', 'Odometer', 'Work type', 'Notes'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '5px 10px',
                                          borderBottom: '1px solid var(--border)',
                                          color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.job_cards.map((jc, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--hover)' }}>
                      <td style={{ padding: '5px 10px' }}>{fmtDate(jc.date)}</td>
                      <td style={{ padding: '5px 10px', fontVariantNumeric: 'tabular-nums' }}>{jc.odometer_km.toLocaleString()} km</td>
                      <td style={{ padding: '5px 10px' }}>{jc.work_type}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>{jc.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TeleStat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ textAlign: 'center', borderRight: '1px solid var(--border)', padding: '0 8px' }}
         className="last-child-no-border">
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--text-muted)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: valueColor ?? 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

// ── FileUploadZone ────────────────────────────────────────────────────────────

interface FileUploadZoneProps {
  label: string; accept: string; multiple?: boolean; category: string
  uploadedRefs: UploadRef[]; onAdd: (ref: UploadRef) => void; onRemove: (id: string) => void
}

function FileUploadZone({ label, accept, multiple, category, uploadedRefs, onAdd, onRemove }: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true); setErr(null)
    for (const file of Array.from(files)) {
      try { onAdd(await api.uploadFile(file, category)) }
      catch (e) { setErr(`Upload failed: ${e}`) }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div className="label-caps" style={{ marginBottom: 6 }}>{label}</div>
      <div className="upload-zone"
           onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
           onDragOver={(e) => e.preventDefault()}
           onClick={() => !uploading && inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple}
               style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
        {uploading
          ? <span className="t-muted" style={{ fontSize: 12.5 }}>Uploading…</span>
          : <span className="t-muted" style={{ fontSize: 12.5 }}>
              Drop here or <span style={{ color: 'var(--accent)' }}>browse</span>
            </span>
        }
      </div>
      {err && <div style={{ color: 'var(--critical)', fontSize: 12, marginTop: 4 }}>{err}</div>}
      {uploadedRefs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {uploadedRefs.map((r) => (
            <span key={r.id} className="file-chip">
              {r.filename}
              <button type="button"
                      onClick={(e) => { e.stopPropagation(); onRemove(r.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                               color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step 1: Vehicle ───────────────────────────────────────────────────────────

function Step1Vehicle({
  form, setField, vehicles, vinDetail, vinLoading, customPackage, setCustomPackage,
}: {
  form: ClaimCreate
  setField: <K extends keyof ClaimCreate>(k: K, v: ClaimCreate[K]) => void
  vehicles: Vehicle[]
  vinDetail: VehicleDetail | null
  vinLoading: boolean
  customPackage: string
  setCustomPackage: (v: string) => void
}) {
  const isOthers = form.warranty_package === 'OTHERS'
  return (
    <div>
      {/* VIN — full width, most important field */}
      <Field label="Vehicle Identification Number (VIN) *">
        <div style={{ position: 'relative' }}>
          <input className="input" list="vin-options" placeholder="Type or scan a VIN…"
                 value={form.vin} onChange={(e) => setField('vin', e.target.value)}
                 style={{ fontSize: 14, letterSpacing: '0.05em' }} />
          <datalist id="vin-options">
            {vehicles.map((v) => (
              <option key={v.vin} value={v.vin}>{v.model} {v.variant} · {v.owner_name}</option>
            ))}
          </datalist>
        </div>
        {vinLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                        color: 'var(--text-muted)', fontSize: 12.5 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                           border: '2px solid var(--accent)', borderTopColor: 'transparent',
                           animation: 'spin .7s linear infinite' }} />
            Fetching vehicle details from CRM…
          </div>
        )}
        {!vinLoading && form.vin.length >= 8 && !vinDetail && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(201,133,0,0.08)',
                        border: '1px solid rgba(201,133,0,0.25)', borderRadius: 8,
                        fontSize: 12.5, color: 'var(--text-secondary)' }}>
            VIN not found in CRM — claim will proceed with manual entry only.
          </div>
        )}
      </Field>

      {vinDetail && <VehicleCard detail={vinDetail} />}

      {/* Second row: registration + reporting time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
        <Field label="Registration number">
          <input className="input" placeholder="e.g. KA 01 EZ 1234"
                 value={form.registration_number}
                 onChange={(e) => setField('registration_number', e.target.value)} />
        </Field>
        <Field label="Vehicle reporting time">
          <input className="input" type="datetime-local"
                 value={form.vehicle_reporting_time}
                 onChange={(e) => setField('vehicle_reporting_time', e.target.value)} />
        </Field>
      </div>

      {/* Third row: warranty package (wider) */}
      <Field label="Warranty package">
        <select className="input" value={form.warranty_package ?? 'OBEN-STD'}
                onChange={(e) => setField('warranty_package', e.target.value)}>
          {WARRANTY_PACKAGES.map((p) => (
            <option key={p.code} value={p.code}>{p.label}</option>
          ))}
        </select>
        {isOthers && (
          <input className="input" style={{ marginTop: 8 }}
                 placeholder="Specify warranty package…"
                 value={customPackage} onChange={(e) => setCustomPackage(e.target.value)} />
        )}
      </Field>

      {/* Fourth row: last service + first visit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Last service date">
          <input className="input" type="date"
                 value={form.last_service_date}
                 onChange={(e) => setField('last_service_date', e.target.value)} />
        </Field>
        <Field label="Last service odometer (km)">
          <input className="input" type="number" min={0}
                 value={form.last_service_odometer || ''}
                 onChange={(e) => setField('last_service_odometer', Number(e.target.value))} />
        </Field>
      </div>

    </div>
  )
}

// ── Step 2: Condition ─────────────────────────────────────────────────────────

function Step2Condition({
  form, setField, modRefs, setModRefs,
}: {
  form: ClaimCreate
  setField: <K extends keyof ClaimCreate>(k: K, v: ClaimCreate[K]) => void
  modRefs: UploadRef[]
  setModRefs: React.Dispatch<React.SetStateAction<UploadRef[]>>
}) {
  return (
    <div>
      <SectionNote>
        Declare the vehicle's condition history. Modified vehicles and missed services affect warranty eligibility per Oben Annexure A.
      </SectionNote>

      <Field label="Any modification in vehicle?">
        <YesNo value={form.any_modification} onChange={(v) => setField('any_modification', v)} id="modification" />
      </Field>

      {form.any_modification && (
        <div style={{ background: 'rgba(201,133,0,0.07)', border: '1px solid rgba(201,133,0,0.25)',
                      borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <Field label="Modification details">
            <textarea className="input" rows={2}
                      placeholder="Describe the modification — type, part, who did it…"
                      value={form.modification_details}
                      onChange={(e) => setField('modification_details', e.target.value)} />
          </Field>
          <FileUploadZone label="Modification photos"
                          accept="image/*" multiple category="modification_photos"
                          uploadedRefs={modRefs}
                          onAdd={(r) => setModRefs((p) => [...p, r])}
                          onRemove={(id) => setModRefs((p) => p.filter((r) => r.id !== id))} />
        </div>
      )}

      <Field label="All applicable services done on time?">
        <YesNo value={form.all_services_on_time} onChange={(v) => setField('all_services_on_time', v)} id="services-on-time" />
      </Field>

      {!form.all_services_on_time && (
        <Field label="Missed service details"
               note="Missed scheduled service is a potential rejection category per Annexure A.">
          <textarea className="input" rows={2}
                    placeholder="Which service was missed, and when…"
                    value={form.missed_service_detail}
                    onChange={(e) => setField('missed_service_detail', e.target.value)} />
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
        <Field label="Dealer / service centre">
          <input className="input" placeholder="e.g. Oben Care Centre Bengaluru"
                 value={form.dealer}
                 onChange={(e) => setField('dealer', e.target.value)} />
        </Field>
        <Field label="Location type">
          <select className="input" value={form.location_type}
                  onChange={(e) => setField('location_type', e.target.value)}>
            <option value="">Select…</option>
            {LOCATION_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Odometer at intake (km)">
          <input className="input" type="number" min={0}
                 value={form.odometer_km || ''}
                 onChange={(e) => setField('odometer_km', Number(e.target.value))} />
        </Field>
        <Field label="Claim date">
          <input className="input" type="date"
                 value={form.claim_date}
                 onChange={(e) => setField('claim_date', e.target.value)} />
        </Field>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, margin: '4px 0 14px' }}>
        <input type="checkbox" checked={form.parts_genuine}
               onChange={(e) => setField('parts_genuine', e.target.checked)} />
        <span className="t-sec">Repair uses genuine Oben parts (dealer declaration)</span>
      </label>
    </div>
  )
}

// ── Step 3: Fault ─────────────────────────────────────────────────────────────

function Step3Fault({
  form, setField, componentOptions,
}: {
  form: ClaimCreate
  setField: <K extends keyof ClaimCreate>(k: K, v: ClaimCreate[K]) => void
  componentOptions: string[]
}) {
  const [assisting, setAssisting] = useState(false)
  const [assistMsg, setAssistMsg] = useState<string | null>(null)

  const faultSuggestions: string[] = useMemo(() => {
    const key = form.component.toLowerCase()
    return COMPONENT_FAULT_CODES[key] ?? []
  }, [form.component])

  async function handleSmartAssist() {
    if (!form.component) return
    setAssisting(true); setAssistMsg(null)
    try {
      const result = await api.suggestFill(form.component, form.fault_code, form.failure_description)
      setField('failure_type', result.failure_type)
      setField('safety_severity', result.safety_severity)
      setField('steps_to_replicate', result.steps_to_replicate)
      setField('service_team_feedback', result.service_team_feedback)
      setField('severity_remarks', result.severity_remarks)
      setAssistMsg('Smart filled: Failure type, Safety severity, Steps to replicate, Service feedback')
    } catch (e) {
      setAssistMsg(`Assist failed: ${e}`)
    } finally {
      setAssisting(false)
    }
  }

  return (
    <div>
      <SectionNote>
        Fill in the fault information. Use <strong>Smart Assist</strong> after entering the component and fault code — it pre-fills failure type, severity, and diagnostic steps based on Oben Annexure C guidelines.
      </SectionNote>

      <Field label="Title of issue *">
        <input className="input" placeholder="e.g. Motor not starting — M-sign error on HMI"
               value={form.fault_title}
               onChange={(e) => setField('fault_title', e.target.value)} required />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Failed component *">
          <input className="input" list="component-options"
                 placeholder="e.g. motor, battery, hmi"
                 value={form.component}
                 onChange={(e) => setField('component', e.target.value)} />
          <datalist id="component-options">
            {componentOptions.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Fault code">
          <input className="input" list="fault-code-options"
                 placeholder="e.g. 49X, BMS-001"
                 value={form.fault_code}
                 onChange={(e) => setField('fault_code', e.target.value)} />
          {faultSuggestions.length > 0 && (
            <datalist id="fault-code-options">
              {faultSuggestions.map((s) => <option key={s} value={s.split(' — ')[0]} label={s} />)}
            </datalist>
          )}
          {faultSuggestions.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Common codes: {faultSuggestions.map((s) => s.split(' — ')[0]).join(', ')}
            </div>
          )}
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <button type="button" className="btn"
                style={{ background: 'rgba(57,135,229,0.12)', borderColor: 'rgba(57,135,229,0.3)',
                         color: 'var(--accent)' }}
                disabled={assisting || !form.component}
                onClick={handleSmartAssist}>
          {assisting ? 'Analysing…' : '✦ Smart Assist'}
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          Auto-fills failure type, severity, diagnostic steps from Annexure C
        </span>
      </div>
      {assistMsg && (
        <div style={{ fontSize: 12, color: assistMsg.startsWith('Assist failed') ? 'var(--critical)' : 'var(--accent-2)',
                      marginBottom: 12, padding: '6px 10px',
                      background: assistMsg.startsWith('Assist failed') ? 'rgba(208,59,59,0.06)' : 'rgba(21,138,97,0.08)',
                      border: `1px solid ${assistMsg.startsWith('Assist failed') ? 'rgba(208,59,59,0.2)' : 'rgba(21,138,97,0.2)'}`,
                      borderRadius: 8 }}>
          {assistMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Failure type">
          <select className="input" value={form.failure_type}
                  onChange={(e) => setField('failure_type', e.target.value)}>
            <option value="">Select…</option>
            {FAILURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Safety severity">
          <select className="input" value={form.safety_severity}
                  onChange={(e) => setField('safety_severity', e.target.value)}>
            <option value="">Select…</option>
            {SAFETY_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Error replication">
          <YesNo value={form.error_replication}
                 onChange={(v) => setField('error_replication', v)} id="error-rep" />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Fault reported date">
          <input className="input" type="date"
                 value={form.fault_reported_date}
                 onChange={(e) => setField('fault_reported_date', e.target.value)} />
        </Field>
        <Field label="Issue reported by">
          <input className="input" placeholder="Customer / field / self-identified"
                 value={form.issue_reported_by}
                 onChange={(e) => setField('issue_reported_by', e.target.value)} />
        </Field>
      </div>

      <Field label="Customer voice (customer's own words)">
        <textarea className="input" rows={2}
                  placeholder="Exact or paraphrased words from the customer — any language, slang welcome…"
                  value={form.customer_voice}
                  onChange={(e) => setField('customer_voice', e.target.value)} />
      </Field>

      <Field label="Service centre observation">
        <textarea className="input" rows={3}
                  placeholder="Structured technician diagnosis — what was checked, what was found…"
                  value={form.service_observation}
                  onChange={(e) => setField('service_observation', e.target.value)} />
      </Field>

      <Field label="Steps to replicate">
        <textarea className="input" rows={4}
                  placeholder="Step-by-step procedure to reproduce the fault (auto-filled by Smart Assist)…"
                  value={form.steps_to_replicate}
                  onChange={(e) => setField('steps_to_replicate', e.target.value)} />
      </Field>

      <Field label="Failure description (full narrative) *">
        <textarea className="input" rows={4}
                  placeholder="Complete narrative — symptoms, conditions, history, customer complaint…"
                  value={form.failure_description}
                  onChange={(e) => setField('failure_description', e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Service team feedback">
          <textarea className="input" rows={3}
                    placeholder="Team's findings and actions taken…"
                    value={form.service_team_feedback}
                    onChange={(e) => setField('service_team_feedback', e.target.value)} />
        </Field>
        <Field label="Severity remarks">
          <textarea className="input" rows={3}
                    placeholder="Any additional notes on severity or safety implications…"
                    value={form.severity_remarks}
                    onChange={(e) => setField('severity_remarks', e.target.value)} />
        </Field>
      </div>
    </div>
  )
}

// ── Step 4: Parts & PFR ───────────────────────────────────────────────────────

function Step4Parts({
  form, setField,
}: {
  form: ClaimCreate
  setField: <K extends keyof ClaimCreate>(k: K, v: ClaimCreate[K]) => void
}) {
  return (
    <div>
      <SectionNote>
        Specify the parts involved. Old serial numbers are required when the part is being replaced.
      </SectionNote>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Primary part">
          <input className="input" placeholder="e.g. Motor Controller Unit"
                 value={form.primary_part}
                 onChange={(e) => setField('primary_part', e.target.value)} />
        </Field>
        <Field label="Product code">
          <input className="input" placeholder="e.g. MCU-OBEN-V2"
                 value={form.product_code}
                 onChange={(e) => setField('product_code', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Secondary part">
          <input className="input" placeholder="Secondary part replaced (if any)"
                 value={form.secondary_part}
                 onChange={(e) => setField('secondary_part', e.target.value)} />
        </Field>
        <Field label="Old serial numbers" note="Serials of the parts being removed/replaced">
          <input className="input" placeholder="e.g. MCU-2024-A001, CTRL-B012"
                 value={form.old_serial_numbers}
                 onChange={(e) => setField('old_serial_numbers', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="PFR name" note="Auto-generated — edit if needed">
          <input className="input" placeholder="e.g. PFR-000001-20261002"
                 value={form.pfr_name}
                 onChange={(e) => setField('pfr_name', e.target.value)} />
        </Field>
        <Field label="Elite care package">
          <input className="input" placeholder="e.g. Elite Care Plus (if applicable)"
                 value={form.elite_care_package}
                 onChange={(e) => setField('elite_care_package', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginTop: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.ho_review}
                 onChange={(e) => setField('ho_review', e.target.checked)} />
          <span className="t-sec">HO Review required (Head Office approval needed)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.back_data}
                 onChange={(e) => setField('back_data', e.target.checked)} />
          <span className="t-sec">Back data (retroactive entry)</span>
        </label>
      </div>
    </div>
  )
}

// ── Step 5: Team ──────────────────────────────────────────────────────────────

function Step5Team({
  form, setField,
}: {
  form: ClaimCreate
  setField: <K extends keyof ClaimCreate>(k: K, v: ClaimCreate[K]) => void
}) {
  // Auto-detect zone from dealer when dealer changes
  useEffect(() => {
    if (form.dealer && !form.zone) {
      const z = detectZone(form.dealer)
      if (z) setField('zone', z)
    }
  }, [form.dealer])

  return (
    <div>
      <SectionNote>
        Responsible persons for this claim. Service Engineer and Submitted By default to the current user — update if different.
      </SectionNote>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Service engineer">
          <input className="input" placeholder="Name of diagnosing technician"
                 value={form.service_engineer}
                 onChange={(e) => setField('service_engineer', e.target.value)} />
        </Field>
        <Field label="Submitted by">
          <input className="input" placeholder="Name of person submitting the claim"
                 value={form.submitted_by}
                 onChange={(e) => setField('submitted_by', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="ASM name (Area Service Manager)">
          <input className="input" placeholder="ASM responsible for this region"
                 value={form.asm_name}
                 onChange={(e) => setField('asm_name', e.target.value)} />
        </Field>
        <Field label="ASM email">
          <input className="input" type="email" placeholder="asm@obenelectric.com"
                 value={form.asm_email}
                 onChange={(e) => setField('asm_email', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Product specialist 1">
          <input className="input" placeholder="Technical specialist (primary)"
                 value={form.product_specialist_1}
                 onChange={(e) => setField('product_specialist_1', e.target.value)} />
        </Field>
        <Field label="Product specialist 2">
          <input className="input" placeholder="Technical specialist (secondary)"
                 value={form.product_specialist_2}
                 onChange={(e) => setField('product_specialist_2', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Zone" note="Auto-detected from dealer city">
          <select className="input" value={form.zone}
                  onChange={(e) => setField('zone', e.target.value)}>
            <option value="">Select…</option>
            {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </Field>
        <Field label="Role">
          <input className="input" placeholder="e.g. Service Head, Technician"
                 value={form.service_role}
                 onChange={(e) => setField('service_role', e.target.value)} />
        </Field>
        <Field label="Location type">
          <select className="input" value={form.location_type}
                  onChange={(e) => setField('location_type', e.target.value)}>
            <option value="">Select…</option>
            {LOCATION_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
      </div>
    </div>
  )
}

// ── Step 6: Documents ─────────────────────────────────────────────────────────

function Step6Documents({
  form, photoRefs, setPhotoRefs, videoRefs, setVideoRefs,
  ctrlRefs, setCtrlRefs, bmsRefs, setBmsRefs, modRefs, setModRefs,
}: {
  form: ClaimCreate
  photoRefs: UploadRef[]; setPhotoRefs: React.Dispatch<React.SetStateAction<UploadRef[]>>
  videoRefs: UploadRef[]; setVideoRefs: React.Dispatch<React.SetStateAction<UploadRef[]>>
  ctrlRefs: UploadRef[]; setCtrlRefs: React.Dispatch<React.SetStateAction<UploadRef[]>>
  bmsRefs: UploadRef[]; setBmsRefs: React.Dispatch<React.SetStateAction<UploadRef[]>>
  modRefs: UploadRef[]; setModRefs: React.Dispatch<React.SetStateAction<UploadRef[]>>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionNote>
        Upload all evidence — photos, videos, and diagnostic logs. Files upload immediately and are attached to the claim.
      </SectionNote>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FileUploadZone label="Defect photos (image/*)" accept="image/*" multiple
                        category="defect_photo" uploadedRefs={photoRefs}
                        onAdd={(r) => setPhotoRefs((p) => [...p, r])}
                        onRemove={(id) => setPhotoRefs((p) => p.filter((r) => r.id !== id))} />
        <FileUploadZone label="Defect videos (video/*)" accept="video/*" multiple
                        category="defect_video" uploadedRefs={videoRefs}
                        onAdd={(r) => setVideoRefs((p) => [...p, r])}
                        onRemove={(id) => setVideoRefs((p) => p.filter((r) => r.id !== id))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FileUploadZone label="Controller error log" accept="*"
                        category="controller_log" uploadedRefs={ctrlRefs}
                        onAdd={(r) => setCtrlRefs((p) => [...p, r])}
                        onRemove={(id) => setCtrlRefs((p) => p.filter((r) => r.id !== id))} />
        <FileUploadZone label="BMS error log" accept="*"
                        category="bms_log" uploadedRefs={bmsRefs}
                        onAdd={(r) => setBmsRefs((p) => [...p, r])}
                        onRemove={(id) => setBmsRefs((p) => p.filter((r) => r.id !== id))} />
      </div>
      {form.any_modification && (
        <FileUploadZone label="Modification photos" accept="image/*" multiple
                        category="modification_photos" uploadedRefs={modRefs}
                        onAdd={(r) => setModRefs((p) => [...p, r])}
                        onRemove={(id) => setModRefs((p) => p.filter((r) => r.id !== id))} />
      )}
    </div>
  )
}

// ── NewClaim (wizard orchestrator) ────────────────────────────────────────────

export function NewClaim({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [form, setForm] = useState<ClaimCreate>(() => makeEmpty(user ?? {}))
  const [customPackage, setCustomPackage] = useState('')
  const [step, setStep] = useState(1)

  // VIN auto-fetch
  const [vinDetail, setVinDetail] = useState<VehicleDetail | null>(null)
  const [vinLoading, setVinLoading] = useState(false)
  const vinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // File uploads by category
  const [photoRefs, setPhotoRefs] = useState<UploadRef[]>([])
  const [videoRefs, setVideoRefs] = useState<UploadRef[]>([])
  const [ctrlRefs, setCtrlRefs] = useState<UploadRef[]>([])
  const [bmsRefs, setBmsRefs] = useState<UploadRef[]>([])
  const [modRefs, setModRefs] = useState<UploadRef[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Decision | null>(null)

  useEffect(() => {
    api.vehicles().then(setVehicles).catch(() => {})
    api.policies().then(setPolicies).catch(() => {})
  }, [])

  const componentOptions = useMemo(() => {
    const set = new Set<string>()
    policies.forEach((p) => {
      p.covered_components.forEach((c) => set.add(c))
      p.excluded_components.forEach((c) => set.add(c))
    })
    return Array.from(set).sort()
  }, [policies])

  function setField<K extends keyof ClaimCreate>(key: K, value: ClaimCreate[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // VIN debounce + auto-fetch + smart fill
  useEffect(() => {
    setVinDetail(null)
    if (vinTimer.current) clearTimeout(vinTimer.current)
    if (form.vin.length < 8) return
    vinTimer.current = setTimeout(async () => {
      setVinLoading(true)
      try {
        const detail = await api.vehicleByVin(form.vin)
        setVinDetail(detail)
        const v = detail.vehicle
        // Auto-fill warranty package if still at default
        setForm((f) => ({
          ...f,
          warranty_package: v.policy_code || 'OBEN-STD',
          // Auto-fill vehicle snapshot fields
          registration_number: f.registration_number || v.registration_number,
          battery_type: v.battery_type,
          battery_version: v.battery_version,
          vcu_id: v.vcu_id,
          hmi_number: v.hmi_number,
          sn_sku: v.sn_sku,
          is_first_visit: detail.job_cards.length === 0,
          // Last service from latest job card
          last_service_date: detail.job_cards.length > 0
            ? detail.job_cards[detail.job_cards.length - 1].date : f.last_service_date,
          last_service_odometer: detail.job_cards.length > 0
            ? detail.job_cards[detail.job_cards.length - 1].odometer_km : f.last_service_odometer,
        }))
      } catch {
        setVinDetail(null)
      } finally {
        setVinLoading(false)
      }
    }, 600)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vin])

  // Auto-generate PFR name when VIN + claim_date are set
  useEffect(() => {
    if (form.vin.length >= 8 && form.claim_date) {
      const dateStr = form.claim_date.replace(/-/g, '')
      const vinSuffix = form.vin.slice(-6)
      setForm((f) => ({ ...f, pfr_name: f.pfr_name || `PFR-${vinSuffix}-${dateStr}` }))
    }
  }, [form.vin, form.claim_date])

  const isOthers = form.warranty_package === 'OTHERS'
  const effectivePackage = isOthers ? customPackage || 'OTHERS' : (form.warranty_package ?? 'OBEN-STD')

  const allAttachmentIds = [
    ...photoRefs, ...videoRefs, ...ctrlRefs, ...bmsRefs, ...modRefs,
  ].map((r) => r.id)

  const canSubmit =
    form.vin.trim() && form.component.trim() && form.failure_description.trim() &&
    form.fault_title.trim() && !busy

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setResult(null)
    try {
      const payload: ClaimCreate = { ...form, warranty_package: effectivePackage, attachments: allAttachmentIds }
      const { decision } = await api.submitClaim(payload)
      setResult(decision)
      onSubmitted?.()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setForm({ ...makeEmpty(user ?? {}), claim_date: today() })
    setCustomPackage(''); setVinDetail(null)
    setPhotoRefs([]); setVideoRefs([]); setCtrlRefs([]); setBmsRefs([]); setModRefs([])
    setResult(null); setError(null); setStep(1)
  }

  if (result) {
    return (
      <div>
        <ResultPanel decision={result} />
        <button className="btn" style={{ marginTop: 16 }} onClick={reset}>
          Raise another claim
        </button>
      </div>
    )
  }

  return (
    <div>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Raise a claim
        </h1>
        <p className="t-muted" style={{ margin: '6px 0 0', fontSize: 14, maxWidth: 640 }}>
          Submit a service PFR — the engine decides live against Oben T&C, grounded in CRM + Argus telematics, and routes ambiguous cases to the review queue.
        </p>
      </header>

      <form className="panel" style={{ padding: 24 }} onSubmit={submit}>
        <StepBar step={step} onJump={setStep} />

        {step === 1 && (
          <Step1Vehicle form={form} setField={setField} vehicles={vehicles}
                        vinDetail={vinDetail} vinLoading={vinLoading}
                        customPackage={customPackage} setCustomPackage={setCustomPackage} />
        )}
        {step === 2 && (
          <Step2Condition form={form} setField={setField}
                          modRefs={modRefs} setModRefs={setModRefs} />
        )}
        {step === 3 && (
          <Step3Fault form={form} setField={setField} componentOptions={componentOptions} />
        )}
        {step === 4 && (
          <Step4Parts form={form} setField={setField} />
        )}
        {step === 5 && (
          <Step5Team form={form} setField={setField} />
        )}
        {step === 6 && (
          <Step6Documents form={form}
                          photoRefs={photoRefs} setPhotoRefs={setPhotoRefs}
                          videoRefs={videoRefs} setVideoRefs={setVideoRefs}
                          ctrlRefs={ctrlRefs} setCtrlRefs={setCtrlRefs}
                          bmsRefs={bmsRefs} setBmsRefs={setBmsRefs}
                          modRefs={modRefs} setModRefs={setModRefs} />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button type="button" className="btn" onClick={() => setStep((s) => s - 1)}>
                ← Back
              </button>
            )}
            {step < STEP_LABELS.length && (
              <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
                Next →
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step === STEP_LABELS.length && (
              <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                {busy ? 'Deciding…' : 'Submit & decide'}
              </button>
            )}
            <button className="btn" type="button" onClick={reset} disabled={busy}>
              Reset
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--critical)', fontSize: 12.5, marginTop: 12 }}>{error}</div>
        )}
      </form>
    </div>
  )
}

// ── ResultPanel ───────────────────────────────────────────────────────────────

function ResultPanel({ decision }: { decision: Decision }) {
  const adminWarnings = decision.reasoning_trace.filter(
    (s) => s.stage === 'rule' && s.severity === 'warn'
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DecisionView decision={decision} />
      {adminWarnings.length > 0 && (
        <div className="panel" style={{ padding: '12px 16px', borderLeft: '3px solid var(--warning)' }}>
          <div className="label-caps" style={{ marginBottom: 8 }}>Admin warnings</div>
          {adminWarnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12.5, marginBottom: 4 }} className="t-sec">
              {w.detail}
              {w.clause && <span className="t-muted"> · clause {w.clause}</span>}
            </div>
          ))}
        </div>
      )}
      {decision.verdict === 'NEEDS_REVIEW' && (
        <div className="t-muted" style={{ fontSize: 12.5 }}>
          This claim was routed to the <strong>Review Queue</strong> for a human decision.
        </div>
      )}
    </div>
  )
}

// ── Route wrapper ─────────────────────────────────────────────────────────────

export function NewClaimPage({ onChanged }: { onChanged: () => void }) {
  const navigate = useNavigate()
  return (
    <div>
      <button className="btn" style={{ marginBottom: 18 }} onClick={() => navigate('/claims')}>
        ← Back to claims
      </button>
      <NewClaim onSubmitted={onChanged} />
    </div>
  )
}
