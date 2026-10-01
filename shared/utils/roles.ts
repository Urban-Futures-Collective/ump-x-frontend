// The role vocabulary, shared by app and server.
//
// The app uses it to show or hide menus; the server uses it to decide who may call an
// admin route and which roles may be assigned. One shared list prevents a role from being
// visible in the menu but rejected on the server, or the other way round.
//
// The `user_role_` prefix separates user roles from model server roles in Keycloak.
// Roles are compared literally, without any mapping (as UMP does).

export const UMP_CLIENT = 'ump-client'

export const ROLE_VIEWER = 'user_role_viewer'
export const ROLE_USER = 'user_role_user'
export const ROLE_PROVIDER = 'user_role_provider'
export const ROLE_VERIFIER = 'user_role_verifier'
export const ROLE_ACCESS_ADMIN = 'user_role_access_admin'
export const ROLE_PLATFORM_ADMIN = 'user_role_platform_admin'

// The six platform roles. Only these can be assigned through UMP-X; a role created by
// hand in the Keycloak console does not become assignable (allowlist rather than a list
// fetched from Keycloak).
export const PLATFORM_ROLES = [
  ROLE_VIEWER,
  ROLE_USER,
  ROLE_PROVIDER,
  ROLE_VERIFIER,
  ROLE_ACCESS_ADMIN,
  ROLE_PLATFORM_ADMIN,
] as const

// The platform roles contained in the realm's default roles, so every new account has
// them. The account list marks an account that lacks one.
export const DEFAULT_ROLES = [ROLE_VIEWER, ROLE_USER, ROLE_PROVIDER] as const

// The roles shown as badges in the account list. The default roles are left out: nearly
// everyone has them, so a badge would say nothing.
export const BADGE_ROLES = [ROLE_VERIFIER, ROLE_ACCESS_ADMIN, ROLE_PLATFORM_ADMIN] as const

// Both admin roles open the admin portal; which sections it shows depends on which of
// the two a user has.
export const ADMIN_ROLES = [ROLE_ACCESS_ADMIN, ROLE_PLATFORM_ADMIN] as const

// Only the claim parts needed for roles (Keycloak's standard shape).
export interface KeycloakRoleClaims {
  realm_access?: { roles?: string[] }
  resource_access?: Record<string, { roles?: string[] }>
}

// Realm and ump-client roles from one claim source (ID token claims or userinfo).
export function rolesFrom(src: KeycloakRoleClaims | undefined | null): string[] {
  if (!src) return []
  return [
    ...(src.realm_access?.roles ?? []),
    ...(src.resource_access?.[UMP_CLIENT]?.roles ?? []),
  ]
}

// All roles of a session. Depending on the mapper, nuxt-oidc-auth stores them in
// `claims` (ID token) or `userInfo`; both are read.
export function rolesOfSession(session: { claims?: unknown, userInfo?: unknown } | null | undefined): string[] {
  return [...new Set([
    ...rolesFrom(session?.claims as KeycloakRoleClaims | undefined),
    ...rolesFrom(session?.userInfo as KeycloakRoleClaims | undefined),
  ])]
}

export type PlatformRole = typeof PLATFORM_ROLES[number]

export function isPlatformRole(r: unknown): r is PlatformRole {
  return typeof r === 'string' && (PLATFORM_ROLES as readonly string[]).includes(r)
}

// How a platform role applies to an account. `direct`: assigned on the account itself.
// `viaDefault`: comes with the realm's default roles; revoking it replaces the default
// role on the account by its other parts. Effective but neither of the two means it comes
// from somewhere else (a group, another composite) and cannot be revoked here.
export interface PlatformRoleStatus { role: PlatformRole, effective: boolean, direct: boolean, viaDefault: boolean }

// `fromDefault`: the realm roles the account gets through the default role, empty if the
// account does not hold the default role.
export function platformRoleStatus(direct: string[], effective: string[], fromDefault: string[] = []): PlatformRoleStatus[] {
  return PLATFORM_ROLES.map(role => ({
    role,
    effective: effective.includes(role) || direct.includes(role),
    direct: direct.includes(role),
    viaDefault: !direct.includes(role) && fromDefault.includes(role),
  }))
}
