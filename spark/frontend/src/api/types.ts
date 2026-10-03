// Shapes mirroring the FastAPI backend responses.

export type Verdict = 'VALID' | 'REJECTED' | 'NEEDS_REVIEW'
export type ReviewStatus = 'OPEN' | 'RESOLVED'
export type HumanDecision = 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED'

export interface Claim {
  id: number
  vin: string
  component: string
  failure_description: string
  odometer_km: number
  claim_date: string
  dealer: string
  parts_genuine: boolean
  status: string
}

export interface TraceStep {
  stage: string
  detail: string
  clause?: string | null
  severity?: string
}

export interface Anomaly {
  type: string
  detail: string
  severity: 'low' | 'medium' | 'high'
}

export interface Evidence {
  crm: {
    found: boolean
    sale_date: string | null
    owner_name: string
    job_cards: number
    prior_claim_ids: string[]
  }
  telematics: {
    found: boolean
    running_status: string
    total_km: number
    battery_soh_pct: number
    battery_voltage_v: number
    dc_fast_charge_cycles: number
    ac_charge_cycles: number
    total_charge_cycles: number
  }
}

export interface Decision {
  id: number
  claim_id: number
  verdict: Verdict
  confidence: number
  rejection_category: string | null
  summary: string
  reasoning_trace: TraceStep[]
  anomalies: Anomaly[]
  evidence: Evidence
  rules_result: Record<string, unknown>
  llm_result: Record<string, unknown>
  created_by: string
  overridden: boolean
  created_at: string
}

export interface ReviewTask {
  id: number
  claim_id: number
  decision_id: number
  routing_reason: string
  priority: number
  sla_due_at: string | null
  status: ReviewStatus
  human_decision: HumanDecision | null
}

export interface QueueItem {
  task: ReviewTask
  claim: Claim
  decision: Decision
}

// A claim paired with its latest decision (may be null if not yet decided)
// and its open review task (present only while awaiting a human).
export interface ClaimRow {
  claim: Claim
  decision: Decision | null
  task: ReviewTask | null
}

// One page of claims from GET /claims, plus dataset-wide counts for the tabs.
export type ClaimStatusFilter = 'ALL' | 'REVIEW' | Verdict

export interface ClaimPage {
  items: ClaimRow[]
  total: number
  page: number
  page_size: number
  counts: Record<ClaimStatusFilter, number>
}

export interface ComponentFailure {
  component: string
  total: number
  valid: number
  rejected: number
  needs_review: number
  anomalies: number
  approval_rate: number | null
  avg_odometer_km: number
  top_rejection: string | null
  rejection_breakdown: { category: string; count: number }[]
}

export interface FailureModeSummary {
  components: ComponentFailure[]
  total_components: number
  total_claims: number
}

export interface AnalyticsSummary {
  totals: { claims: number; valid: number; rejected: number; needs_review: number }
  open_reviews: number
  anomaly_count: number
  avg_confidence: number
  auto_approval_rate: number
  verdict_distribution: { verdict: Verdict; count: number }[]
  rejection_categories: { category: string; count: number }[]
}

export interface Vehicle {
  id: number
  vin: string
  model: string
  variant: string
  sale_date: string
  owner_name: string
  policy_code: string
  production_date: string
  owner_phone: string
  owner_email: string
  battery_serial: string
  motor_serial: string
  controller_serial: string
  charger_serial: string
  registration_number: string
  battery_type: string
  battery_version: string
  vcu_id: string
  hmi_number: string
  sn_sku: string
}

export interface VehicleDetail {
  vehicle: Vehicle
  job_cards: { date: string; odometer_km: number; work_type: string; notes: string }[]
  prior_claim_ids: string[]
  telematics: {
    found: boolean
    total_km: number
    battery_soh_pct: number
    battery_voltage_v: number
    dc_fast_charge_cycles: number
    ac_charge_cycles: number
    running_status: string
  }
}

export interface UploadRef {
  id: string
  filename: string
  content_type: string
  size: number
  category: string
  url: string
}

export interface ClaimCreate {
  vin: string
  component: string
  failure_description: string
  odometer_km: number
  claim_date: string
  dealer: string
  parts_genuine: boolean
  warranty_package?: string
  attachments: string[]
  fault_title: string
  fault_code: string
  service_observation: string
  // Vehicle snapshot
  registration_number: string
  vehicle_reporting_time: string
  last_service_date: string
  last_service_odometer: number
  battery_type: string
  battery_version: string
  vcu_id: string
  hmi_number: string
  sn_sku: string
  is_first_visit: boolean
  any_modification: boolean
  modification_details: string
  all_services_on_time: boolean
  missed_service_detail: string
  // Parts & PFR
  primary_part: string
  product_code: string
  secondary_part: string
  old_serial_numbers: string
  failure_type: string
  elite_care_package: string
  ho_review: boolean
  back_data: boolean
  pfr_name: string
  // Team
  service_engineer: string
  submitted_by: string
  asm_name: string
  asm_email: string
  product_specialist_1: string
  product_specialist_2: string
  zone: string
  location_type: string
  service_role: string
  // Extended fault
  safety_severity: string
  customer_voice: string
  issue_reported_by: string
  error_replication: boolean
  service_team_feedback: string
  severity_remarks: string
  steps_to_replicate: string
  fault_reported_date: string
}

export interface SuggestResult {
  failure_type: string
  safety_severity: string
  steps_to_replicate: string
  service_team_feedback: string
  severity_remarks: string
}

export interface TrendsSummary {
  total_claims: number
  monthly_failures: { month: string; count: number }[]
  top_parts: { part: string; count: number }[]
  top_failure_modes: { mode: string; count: number }[]
  top_dealers: { dealer: string; count: number }[]
  top_components: { component: string; count: number }[]
}

// The versioned warranty policy (T&C) — mirrors the backend Policy table.
export interface Policy {
  id: number
  code: string
  version: string
  title: string
  coverage_years: number
  coverage_km: number
  battery_coverage_years: number
  battery_coverage_km: number
  battery_min_soh_pct: number
  service_schedule_required: boolean
  max_service_overdue_days: number
  covered_components: string[]
  excluded_components: string[]
  clauses: Record<string, string>
  created_at?: string
}

// The write shape (no id/created_at) used by create / renew.
export type PolicyCreate = Omit<Policy, 'id' | 'created_at'>

// A draft returned by /policies/extract — a PolicyCreate plus review metadata.
export type PolicyDraft = PolicyCreate & {
  _note?: string
  _source_excerpt?: string
}
