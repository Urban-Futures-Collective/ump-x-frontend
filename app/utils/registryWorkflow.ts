import type { RegistryStatus } from '~/types/registry'

// Review workflow of the model registry, as in concept F12:
//
//   draft → submitted → in_review → verified → published
//               ↑           │ │                    │
//               └── changes_requested  rejected     └→ in_review (reset)
//   in_review / verified / published → deactivated
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
  { from: ['in_review'], to: 'changes_requested', who: 'verifier', needsNote: true },
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
