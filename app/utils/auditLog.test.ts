import { describe, expect, it } from 'vitest'
import { actionKey, auditSummary } from './auditLog'

describe('audit log', () => {
  it('turns an action into an i18n key', () => {
    expect(actionKey('model.status.change')).toBe('audit.action.model_status_change')
  })

  it('summarises a status change', () => {
    expect(auditSummary({ action: 'model.status.change', job_id: null, details: { from: 'in_review', to: 'verified', note: null, verification_job_skipped: true } }))
      .toEqual({ kind: 'status', from: 'in_review', to: 'verified', note: undefined, skipped: true })
  })

  it('lists the changed card fields', () => {
    expect(auditSummary({ action: 'model.card.update', job_id: null, details: { changes: { license: {}, purpose: {} } } }))
      .toEqual({ kind: 'fields', fields: ['license', 'purpose'] })
  })

  it('names the role of an access decision', () => {
    expect(auditSummary({ action: 'access.grant', job_id: null, details: { role: 'bikebox:growbike', note: 'ok' } }))
      .toEqual({ kind: 'role', role: 'bikebox:growbike', note: 'ok' })
  })

  it('falls back to the job, then to nothing', () => {
    expect(auditSummary({ action: 'job.execute', job_id: 'j1', details: {} })).toEqual({ kind: 'job', jobId: 'j1' })
    expect(auditSummary({ action: 'server.create', job_id: null, details: {} })).toEqual({ kind: 'none' })
  })
})
