import type { Verdict } from '../api/types'

export const VERDICT_META: Record<
  Verdict,
  { label: string; badge: string; color: string }
> = {
  VALID: { label: 'Valid', badge: 'badge-good', color: 'var(--good)' },
  REJECTED: { label: 'Rejected', badge: 'badge-critical', color: 'var(--critical)' },
  NEEDS_REVIEW: { label: 'Needs review', badge: 'badge-warning', color: 'var(--warning)' },
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parts = iso.split('T')[0].split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

export function titleCase(s: string): string {
  return s
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

export function priorityLabel(p: number): { label: string; badge: string } {
  if (p <= 1) return { label: 'P1 · Urgent', badge: 'badge-critical' }
  if (p <= 3) return { label: `P${p} · Normal`, badge: 'badge-warning' }
  return { label: `P${p} · Low`, badge: 'badge-neutral' }
}

export function relativeDue(iso: string | null): string {
  if (!iso) return '—'
  const due = new Date(iso).getTime()
  const now = Date.now()
  const hrs = Math.round((due - now) / 3_600_000)
  if (hrs < 0) return `${Math.abs(hrs)}h overdue`
  if (hrs < 24) return `in ${hrs}h`
  return `in ${Math.round(hrs / 24)}d`
}
