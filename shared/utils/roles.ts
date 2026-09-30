// Das Rollen-Vokabular, einmal für App und Server.
//
// Die App blendet damit Menüs ein und aus, der Server entscheidet damit, wer eine
// Admin-Route aufrufen darf, und prüft, welche Rolle überhaupt vergeben werden darf.
// Zwei Kopien dieser Liste wären zwei Wahrheiten, und eine Rolle, die nur in einer
// steht, wäre im Menü sichtbar und auf dem Server gesperrt oder umgekehrt.
//
// Schreibweise `user_role_…` (Rico, 2026-09-30): so sieht man in Keycloak, was zu
// Nutzern gehört und was zu Modellservern. Rollen werden Buchstabe für Buchstabe
// verglichen, ohne jede Übersetzung (UMP tut das genauso).

export const UMP_CLIENT = 'ump-client'

export const ROLE_VIEWER = 'user_role_viewer'
export const ROLE_USER = 'user_role_user'
export const ROLE_PROVIDER = 'user_role_provider'
export const ROLE_VERIFIER = 'user_role_verifier'
export const ROLE_ACCESS_ADMIN = 'user_role_access_admin'
export const ROLE_PLATFORM_ADMIN = 'user_role_platform_admin'

// Die sechs Plattformrollen. Nur diese darf ein platform admin über UMP-X vergeben;
// eine Rolle, die jemand in der Keycloak-Konsole von Hand anlegt, wird dadurch nicht
// vergebbar (Allowlist statt Liste aus Keycloak, siehe F11).
export const PLATFORM_ROLES = [
  ROLE_VIEWER,
  ROLE_USER,
  ROLE_PROVIDER,
  ROLE_VERIFIER,
  ROLE_ACCESS_ADMIN,
  ROLE_PLATFORM_ADMIN,
] as const

// Beide Admin-Rollen öffnen das Admin-Portal (Rico, 2026-09-25). Was darin zu sehen
// ist, hängt davon ab, welche der beiden jemand hat.
export const ADMIN_ROLES = [ROLE_ACCESS_ADMIN, ROLE_PLATFORM_ADMIN] as const

// Nur die Claim-Teile, die wir für Rollen brauchen (Keycloak-Standardform).
export interface KeycloakRoleClaims {
  realm_access?: { roles?: string[] }
  resource_access?: Record<string, { roles?: string[] }>
}

// Realm- und ump-client-Rollen aus einer Claim-Quelle (ID-Token-Claims oder Userinfo).
export function rolesFrom(src: KeycloakRoleClaims | undefined | null): string[] {
  if (!src) return []
  return [
    ...(src.realm_access?.roles ?? []),
    ...(src.resource_access?.[UMP_CLIENT]?.roles ?? []),
  ]
}

// Alle Rollen einer Sitzung. nuxt-oidc-auth legt sie je nach Mapper in `claims`
// (ID-Token) oder `userInfo` ab; gelesen wird aus beiden.
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

// Wie eine Plattformrolle bei einem Konto steht. `direkt` heißt: am Konto selbst
// vergeben, also hier entfernbar. Ist sie nur wirksam, aber nicht direkt vergeben,
// kommt sie über eine zusammengesetzte Rolle, in der Regel die Standardrollen
// (default-roles-urbanmodelplatform); entziehen lässt sie sich dann nicht am Konto.
export interface PlatformRoleStatus { role: PlatformRole, wirksam: boolean, direkt: boolean }

export function platformRoleStatus(direkt: string[], wirksam: string[]): PlatformRoleStatus[] {
  return PLATFORM_ROLES.map(role => ({
    role,
    wirksam: wirksam.includes(role) || direkt.includes(role),
    direkt: direkt.includes(role),
  }))
}
