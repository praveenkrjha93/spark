import type {
  AnalyticsSummary,
  Claim,
  ClaimCreate,
  ClaimPage,
  ClaimRow,
  Decision,
  FailureModeSummary,
  HumanDecision,
  Policy,
  PolicyCreate,
  PolicyDraft,
  QueueItem,
  SuggestResult,
  TrendsSummary,
  UploadRef,
  Vehicle,
  VehicleDetail,
} from './types'

// In dev, Vite proxies /api -> http://127.0.0.1:8000 (see vite.config.ts).
const BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json() as Promise<T>
}

// File uploads: let the browser set the multipart boundary (no JSON header).
async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  analytics: () => req<AnalyticsSummary>('/analytics/summary'),
  failureModes: () => req<FailureModeSummary>('/analytics/failure-modes'),
  trends: () => req<TrendsSummary>('/analytics/trends'),
  queue: (status = 'OPEN') => req<QueueItem[]>(`/review/queue?status=${status}`),
  claims: (params?: { status?: string; q?: string; page?: number; page_size?: number }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    if (params?.q) sp.set('q', params.q)
    if (params?.page) sp.set('page', String(params.page))
    if (params?.page_size) sp.set('page_size', String(params.page_size))
    const qs = sp.toString()
    return req<ClaimPage>(`/claims${qs ? `?${qs}` : ''}`)
  },
  claim: (id: number) => req<ClaimRow>(`/claims/${id}`),
  reviewDecision: (
    taskId: number,
    body: { human_decision: HumanDecision; override_notes: string; resolved_by: string },
  ) =>
    req<{ task: unknown; decision: Decision }>(`/review/${taskId}/decision`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // --- Raise a claim ---
  vehicles: () => req<Vehicle[]>('/vehicles'),
  vehicleByVin: (vin: string) => req<VehicleDetail>(`/vehicles/${encodeURIComponent(vin)}`),
  uploadFile: (file: File, category: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', category)
    return upload<UploadRef>('/uploads', fd)
  },
  submitClaim: (body: ClaimCreate) =>
    req<{ claim: Claim; decision: Decision }>('/claims', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  suggestFill: (component: string, fault_code: string, failure_description: string) =>
    req<SuggestResult>('/claims/suggest', {
      method: 'POST',
      body: JSON.stringify({ component, fault_code, failure_description }),
    }),

  // --- Manage T&C (warranty policies) ---
  policies: () => req<Policy[]>('/policies'),
  createPolicy: (body: PolicyCreate) =>
    req<Policy>('/policies', { method: 'POST', body: JSON.stringify(body) }),
  importPolicy: (file: File) => { const fd = new FormData(); fd.append('file', file); return upload<Policy[]>('/policies/import', fd) },
  extractPolicy: (file: File) => { const fd = new FormData(); fd.append('file', file); return upload<PolicyDraft>('/policies/extract', fd) },
}
