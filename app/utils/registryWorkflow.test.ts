import { describe, expect, it } from 'vitest'
import { stepKey, canEditCard, contributeGroup, transitionsFor, verifyTabsOf } from './registryWorkflow'

const owner = { isOwner: true, isProvider: true, isVerifier: false, isPlatformAdmin: false }
const verifier = { isOwner: false, isProvider: true, isVerifier: true, isPlatformAdmin: false }
const ownerVerifier = { ...verifier, isOwner: true }
const admin = { isOwner: false, isProvider: false, isVerifier: false, isPlatformAdmin: true }
const to = (list: { to: string }[]) => list.map(t => t.to)

describe('registry workflow', () => {
  it('lets the owner submit and withdraw', () => {
    expect(to(transitionsFor('draft', owner))).toEqual(['submitted'])
    expect(to(transitionsFor('submitted', owner))).toEqual(['draft'])
    expect(to(transitionsFor('changes_requested', owner))).toEqual(['submitted'])
    expect(to(transitionsFor('rejected', owner))).toEqual(['draft'])
  })

  it('lets a verifier review, verify and publish', () => {
    expect(to(transitionsFor('submitted', verifier))).toEqual(['in_review'])
    expect(to(transitionsFor('in_review', verifier))).toEqual(['verified', 'changes_requested', 'rejected', 'deactivated'])
    expect(to(transitionsFor('verified', verifier))).toEqual(['published', 'deactivated'])
    expect(to(transitionsFor('published', verifier))).toEqual(['in_review', 'deactivated'])
    expect(to(transitionsFor('deactivated', verifier))).toEqual(['in_review'])
    expect(to(transitionsFor('deactivated', owner))).toEqual([])
  })

  it('never lets anyone review their own model', () => {
    expect(to(transitionsFor('submitted', ownerVerifier))).toEqual(['draft'])
    expect(to(transitionsFor('in_review', ownerVerifier))).toEqual([])
  })

  it('lets a platform admin deactivate only', () => {
    expect(to(transitionsFor('published', admin))).toEqual(['deactivated'])
    expect(to(transitionsFor('deactivated', admin))).toEqual(['in_review'])
    expect(to(transitionsFor('submitted', admin))).toEqual([])
  })

  it('requires a note for requests, rejections and deactivation', () => {
    const t = transitionsFor('in_review', verifier)
    expect(t.filter(x => x.needsNote).map(x => x.to)).toEqual(['changes_requested', 'rejected', 'deactivated'])
    // UMP asks for a reason when a published model goes back into review, too.
    expect(transitionsFor('published', verifier).find(x => x.to === 'in_review')?.needsNote).toBe(true)
  })

  it('allows card edits by the owner until deactivation', () => {
    expect(canEditCard('published', owner)).toBe(true)
    expect(canEditCard('deactivated', owner)).toBe(false)
    expect(canEditCard('draft', verifier)).toBe(false)
  })
})

describe('contribute groups', () => {
  it('puts each status where the owner expects it', () => {
    expect(contributeGroup('draft')).toBe('action')
    expect(contributeGroup('changes_requested')).toBe('action')
    expect(contributeGroup('submitted')).toBe('awaiting')
    expect(contributeGroup('in_review')).toBe('awaiting')
    expect(contributeGroup('verified')).toBe('awaiting')
    expect(contributeGroup('published')).toBe('live')
    expect(contributeGroup('rejected')).toBe('closed')
    expect(contributeGroup('deactivated')).toBe('closed')
  })
})

describe('verify tabs', () => {
  it('lists each model where a verifier looks for it', () => {
    expect(verifyTabsOf('draft', 'unchecked')).toEqual([])
    expect(verifyTabsOf('submitted', 'unchecked')).toEqual(['todo'])
    expect(verifyTabsOf('verified', 'in_sync')).toEqual(['todo'])
    expect(verifyTabsOf('published', 'in_sync')).toEqual(['published'])
    expect(verifyTabsOf('published', 'drifted')).toEqual(['published', 'interface'])
    expect(verifyTabsOf('changes_requested', 'in_sync')).toEqual(['todo'])
    expect(verifyTabsOf('rejected', 'unchecked')).toEqual(['closed'])
    expect(verifyTabsOf('deactivated', 'in_sync')).toEqual(['closed'])
  })
})

describe('action labels', () => {
  it('names reopening and reactivating apart from their target', () => {
    expect(stepKey('rejected', 'draft')).toBe('reopen')
    expect(stepKey('deactivated', 'in_review')).toBe('reactivate')
    expect(stepKey('published', 'in_review')).toBe('in_review')
    expect(stepKey('submitted', 'draft')).toBe('draft')
  })
})
