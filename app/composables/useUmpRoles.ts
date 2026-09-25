// Liest die Rollen des eingeloggten Users zentral aus der OIDC-Session.
// Einzige Stelle, die weiß, WO im Token die Rollen stehen (realm_access / resource_access)
// — Komponenten/Guards fragen nur roles/isAdmin/modelServerRoles ab, kein Rollen-Wissen
// verstreut. Kein neuer Netzwerk-Call: alles aus der bereits vorhandenen Session.
//
// Wichtig (BFF): Access-/ID-Token werden client-seitig gestrippt (oidc-strip-token.ts),
// die Rollen müssen also in einem Session-Feld liegen, das überlebt. nuxt-oidc-auth füllt
// zwei solche Felder — je nachdem, wo Keycloaks Roles-Mapper die Rollen ablegt:
//   - user.userInfo — komplette Antwort des /userinfo-Endpoints (Mapper „Add to userinfo")
//   - user.claims   — nur die via `optionalClaims` extrahierten ID-Token-Claims
//                     (nuxt.config: optionalClaims = ['realm_access','resource_access'])
// Wir lesen aus BEIDEN und vereinigen — robust, egal welches Ziel der Mapper hat.
// Voraussetzung fürs Admin-Gate: die Admin-Rollen landen in ID-Token oder Userinfo.
// Siehe docs/model-access-admin-decision-de.md.

const UMP_CLIENT = 'ump-client'
// Seit 2026-09 das Rollenmodell aus dem Weekly (viewer, user, provider, verifier,
// access admin, platform admin) als Realm-Rollen. `ump_admin` gibt es nicht mehr.
// Welche der beiden Admin-Rollen das Admin-Portal öffnet, ist mit Rico noch offen,
// bis dahin reicht eine von beiden. Die Schreibweise mit Bindestrich ist die aus
// Keycloak, nicht ein Tippfehler hier.
const ADMIN_ROLES = ['user_role_access_admin', 'user_role_platform-admin']

// Nur die Claim-Teile, die wir für Rollen brauchen (Keycloak-Standardform).
interface KeycloakRoleClaims {
  realm_access?: { roles?: string[] }
  resource_access?: Record<string, { roles?: string[] }>
}

// Zieht realm- + ump-client-Rollen aus einer Claim-Quelle (claims ODER userInfo).
function rolesFrom(src: KeycloakRoleClaims | undefined): string[] {
  if (!src) return []
  return [
    ...(src.realm_access?.roles ?? []),
    ...(src.resource_access?.[UMP_CLIENT]?.roles ?? []),
  ]
}

export function useUmpRoles() {
  const { loggedIn, user } = useOidcAuth()

  const roles = computed<string[]>(() => {
    if (!loggedIn.value) return []
    const fromClaims = rolesFrom(user.value?.claims as KeycloakRoleClaims | undefined)
    const fromUserInfo = rolesFrom(user.value?.userInfo as KeycloakRoleClaims | undefined)
    return [...new Set([...fromClaims, ...fromUserInfo])]
  })

  // Modell-Zugriffsrollen: `modelserver` (alle) + `modelserver_<id>` (je Modellserver).
  // UMP filtert die Prozessliste serverseitig danach; hier v. a. für spätere Anzeige.
  const modelServerRoles = computed(() =>
    roles.value.filter(r => r === 'modelserver' || r.startsWith('modelserver_')),
  )

  // Admin-Gate: hängt allein an den Admin-Rollen aus dem Token.
  const isAdmin = computed(() => ADMIN_ROLES.some(r => roles.value.includes(r)))

  return { roles, modelServerRoles, isAdmin }
}
