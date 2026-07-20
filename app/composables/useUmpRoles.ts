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
// Voraussetzung fürs Admin-Gate: `ump-client` mappt ump_admin in ID-Token/Userinfo
// (Rico, umgesetzt 2026-07-20; end-to-end verifiziert). Siehe docs/model-access-admin-decision.md.

const UMP_CLIENT = 'ump-client'
const ADMIN_ROLE = 'ump_admin'

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

  // Admin-Gate: hängt allein an der ump_admin-Rolle aus dem Token.
  const isAdmin = computed(() => roles.value.includes(ADMIN_ROLE))

  return { roles, modelServerRoles, isAdmin }
}
