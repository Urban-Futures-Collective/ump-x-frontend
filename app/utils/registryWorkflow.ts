import type { RegistryStatus } from '~/types/registry'

// Review workflow of the model registry, as in concept F12:
//
//   draft → submitted → in_review → verified → published
//                           │                      │
//                        rejected                  └→ in_review (reset)
//   in_review / verified / published → deactivated
//
// No "changes requested": the review has no comments for now (decided 2026-10-23), so
// a reviewer accepts or rejects. The API still knows the status; a model that is in it
// can be resubmitted by its owner.
//
// The backend will enforce these rules; the frontend uses the same table to offer only
// the actions that can succeed.

export interface Actor {
  isOwner: boolean
  isProvider: boolean
  isVerifier: boolean
  isPlatformAdmin: boolean
}

export interface Transition {
  to: RegistryStatus
  /** A reason or comment is required (shown to the owner). */
  needsNote: boolean
}

type Who = 'owner' | 'verifier' | 'verifierOrAdmin'

const RULES: { from: RegistryStatus[], to: RegistryStatus, who: Who, needsNote?: boolean }[] = [
  { from: ['draft'], to: 'submitted', who: 'owner' },
  { from: ['submitted'], to: 'draft', who: 'owner' },
  { from: ['changes_requested'], to: 'submitted', who: 'owner' },
  { from: ['submitted'], to: 'in_review', who: 'verifier' },
  { from: ['in_review'], to: 'verified', who: 'verifier' },
  { from: ['in_review'], to: 'rejected', who: 'verifier', needsNote: true },
  { from: ['verified'], to: 'published', who: 'verifier' },
  { from: ['published'], to: 'in_review', who: 'verifier' },
  { from: ['in_review', 'verified', 'published'], to: 'deactivated', who: 'verifierOrAdmin', needsNote: true },
]

function allowed(who: Who, a: Actor): boolean {
  // Owners act as providers; reviewers never review their own model (four-eyes).
  if (who === 'owner') return a.isOwner && a.isProvider
  if (who === 'verifier') return a.isVerifier && !a.isOwner
  return a.isPlatformAdmin || (a.isVerifier && !a.isOwner)
}

export function transitionsFor(status: RegistryStatus, actor: Actor): Transition[] {
  return RULES
    .filter(r => r.from.includes(status) && allowed(r.who, actor))
    .map(r => ({ to: r.to, needsNote: !!r.needsNote }))
}

/** Statuses a verifier has to act on. */
export const AWAITING_REVIEW: RegistryStatus[] = ['submitted', 'in_review', 'verified']

/** Card edits are allowed in every status except deactivated (F12). */
export function canEditCard(status: RegistryStatus, actor: Actor): boolean {
  return actor.isOwner && actor.isProvider && status !== 'deactivated'
}

/** Groups on the Contribute page, in display order (design P1). */
export const CONTRIBUTE_GROUPS = ['action', 'awaiting', 'live', 'closed'] as const
export type ContributeGroup = typeof CONTRIBUTE_GROUPS[number]

/**
 * Where an owner finds a model: things only they can move on, things with the
 * verifiers, models in Commons, and models that are no longer going anywhere.
 * Rejected counts as closed: the owner cannot resubmit it.
 */
export function contributeGroup(status: RegistryStatus): ContributeGroup {
  if (status === 'draft' || status === 'changes_requested') return 'action'
  if (AWAITING_REVIEW.includes(status)) return 'awaiting'
  if (status === 'published') return 'live'
  return 'closed'
}

/** Tabs on the Verify page, in display order (design V1). */
export const VERIFY_TABS = ['todo', 'interface', 'published', 'closed'] as const
export type VerifyTab = typeof VERIFY_TABS[number]

/**
 * Where a verifier finds a model. Drafts are the owner's business and appear nowhere.
 * A published model whose server interface changed sits under "interface" as well as
 * under "published", so see verifyTabsOf.
 */
export function verifyTabsOf(status: RegistryStatus, interfaceState: string): VerifyTab[] {
  if (status === 'draft') return []
  if (AWAITING_REVIEW.includes(status)) return ['todo']
  if (status === 'published') return interfaceState === 'drifted' ? ['published', 'interface'] : ['published']
  return ['closed']
}
