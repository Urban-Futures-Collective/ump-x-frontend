import type { RegistryStatus } from '~/types/registry'

// Review workflow of the model registry, as in concept F12:
//
//   draft → submitted → in_review → verified → published
//               ↑           │ │                    │
//               └── changes_requested  rejected     └→ in_review (reset)
//   in_review / verified / published → deactivated      rejected → draft (owner reopens)
//   deactivated → in_review (reactivate, a new review round)
//
// "Changes requested" was taken out on 2026-10-23 and is back since 2026-11-04 (#111,
// item 32): the reviewer names what to change, the owner edits the card and submits
// again.
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
  // A rejected model can be reworked and submitted again (#111, item 32).
  { from: ['rejected'], to: 'draft', who: 'owner' },
  { from: ['changes_requested'], to: 'submitted', who: 'owner' },
  { from: ['submitted'], to: 'in_review', who: 'verifier' },
  { from: ['in_review'], to: 'verified', who: 'verifier' },
  { from: ['in_review'], to: 'changes_requested', who: 'verifier', needsNote: true },
  { from: ['in_review'], to: 'rejected', who: 'verifier', needsNote: true },
  { from: ['verified'], to: 'published', who: 'verifier' },
  { from: ['published'], to: 'in_review', who: 'verifier', needsNote: true },
  { from: ['in_review', 'verified', 'published'], to: 'deactivated', who: 'verifierOrAdmin', needsNote: true },
  // A deactivated model can be reactivated; it goes through review again (#111, item 32).
  { from: ['deactivated'], to: 'in_review', who: 'verifierOrAdmin', needsNote: true },
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

/**
 * i18n key under registry.action for a step. Most steps are named after their target;
 * going back to draft from rejected and back to review from deactivated read differently.
 */
export function stepKey(from: RegistryStatus, to: RegistryStatus): string {
  if (from === 'rejected' && to === 'draft') return 'reopen'
  if (from === 'deactivated' && to === 'in_review') return 'reactivate'
  return to
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
 * Rejected counts as closed until the owner reworks it as a draft.
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
 * A verified or published model whose server interface changed (or stopped answering)
 * sits under "interface" as well.
 */
export function verifyTabsOf(status: RegistryStatus, interfaceState: string): VerifyTab[] {
  if (status === 'draft') return []
  // A server that changed or stopped answering after verification: the verifier decides
  // whether to verify again, review again or take the model offline (design V3).
  const flagged = (status === 'verified' || status === 'published') && (interfaceState === 'drifted' || interfaceState === 'unreachable')
  const extra: VerifyTab[] = flagged ? ['interface'] : []
  // Waiting for the owner, but the review is not over: it stays with the open ones.
  if (AWAITING_REVIEW.includes(status) || status === 'changes_requested') return ['todo', ...extra]
  if (status === 'published') return ['published', ...extra]
  return ['closed']
}
