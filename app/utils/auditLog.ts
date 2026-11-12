// Audit log (#111, item 13): UMP records every registry change and run with who did it
// (GET /registry/v1/audit, for verifiers, access admins and platform admins). No design
// exists yet; the page is a plain list and can follow one later.

export interface ApiAuditEvent {
  id: number
  occurred_at: string
  actor_sub: string | null
  actor_roles: string[]
  action: string
  model_id: string | null
  job_id: string | null
  outcome: 'success' | 'denied' | 'failure'
  details: Record<string, unknown>
}

/** Every action UMP writes, grouped for the filter. */
export const AUDIT_ACTIONS = [
  'model.create', 'model.card.update', 'model.status.change', 'model.reverify', 'model.owner.transfer',
  'model.interface.changed', 'model.interface.drifted', 'model.interface.restored', 'model.interface.unreachable',
  'access.request', 'access.withdraw', 'access.grant', 'access.deny', 'access.revoke',
  'server.create', 'server.update', 'server.discover', 'server.rediscover',
  'job.execute', 'job.complete',
] as const

/** i18n key of an action; unknown actions show as they are. */
export const actionKey = (action: string) => `audit.action.${action.replaceAll('.', '_')}`

/** What changed, in short, from the event details. */
export type AuditSummary =
  | { kind: 'status', from: string, to: string, note?: string, skipped?: boolean }
  | { kind: 'fields', fields: string[] }
  | { kind: 'role', role: string, note?: string }
  | { kind: 'job', jobId: string }
  | { kind: 'none' }

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export function auditSummary(e: Pick<ApiAuditEvent, 'action' | 'details' | 'job_id'>): AuditSummary {
  const d = e.details ?? {}
  if (e.action === 'model.status.change' && text(d.from) && text(d.to)) {
    return { kind: 'status', from: text(d.from)!, to: text(d.to)!, note: text(d.note), skipped: d.verification_job_skipped === true }
  }
  if (e.action === 'model.card.update' && d.changes && typeof d.changes === 'object') {
    return { kind: 'fields', fields: Object.keys(d.changes as object) }
  }
  if (e.action.startsWith('access.') && text(d.role)) return { kind: 'role', role: text(d.role)!, note: text(d.note) }
  if (e.job_id) return { kind: 'job', jobId: e.job_id }
  return { kind: 'none' }
}
