import { describe, expect, it } from 'vitest'
import { canEditCard, transitionsFor } from './registryWorkflow'

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
  })

  it('lets a verifier review, verify and publish', () => {
    expect(to(transitionsFor('submitted', verifier))).toEqual(['in_review'])
    expect(to(transitionsFor('in_review', verifier))).toEqual(['verified', 'changes_requested', 'rejected', 'deactivated'])
    expect(to(transitionsFor('verified', verifier))).toEqual(['published', 'deactivated'])
    expect(to(transitionsFor('published', verifier))).toEqual(['in_review', 'deactivated'])
  })

  it('never lets anyone review their own model', () => {
    expect(to(transitionsFor('submitted', ownerVerifier))).toEqual(['draft'])
    expect(to(transitionsFor('in_review', ownerVerifier))).toEqual([])
  })

  it('lets a platform admin deactivate only', () => {
    expect(to(transitionsFor('published', admin))).toEqual(['deactivated'])
    expect(to(transitionsFor('submitted', admin))).toEqual([])
  })

  it('requires a note for requests, rejections and deactivation', () => {
    const t = transitionsFor('in_review', verifier)
    expect(t.filter(x => x.needsNote).map(x => x.to)).toEqual(['changes_requested', 'rejected', 'deactivated'])
  })

  it('allows card edits by the owner until deactivation', () => {
    expect(canEditCard('published', owner)).toBe(true)
    expect(canEditCard('deactivated', owner)).toBe(false)
    expect(canEditCard('draft', verifier)).toBe(false)
  })
})
