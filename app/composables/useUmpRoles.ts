// Liest die Rollen des eingeloggten Users zentral aus der OIDC-Session.
// Einzige Stelle, die weiß, WO im Token die Rollen stehen (realm_access / resource_access)
// — Komponenten/Guards fragen nur roles/isAdmin/modelServerRoles ab, kein Rollen-Wissen
// verstreut. Kein neuer Netzwerk-Call: alles aus der bereits vorhandenen Session-Claim.
//
// Voraussetzung fürs Admin-Gate: `ump-client` muss die Client-Rollen (u. a. das spätere
// ump_admin) in einen Claim mappen, den die Frontend-Session sieht. Solange das fehlt,
// ist isAdmin nur über den Dev-Override (runtimeConfig.public.devForceAdmin) erreichbar.
// Siehe docs/model-access-admin-decision.md (Punkt 3, offener Roles-Mapper).

const UMP_CLIENT = 'ump-client'
const ADMIN_ROLE = 'ump_admin'

// Nur die Claim-Teile, die wir für Rollen brauchen (Keycloak-Standardform).
interface KeycloakRoleClaims {
  realm_access?: { roles?: string[] }
  resource_access?: Record<string, { roles?: string[] }>
}

export function useUmpRoles() {
  const { loggedIn, user } = useOidcAuth()
  const { devForceAdmin } = useRuntimeConfig().public

  const roles = computed<string[]>(() => {
    if (!loggedIn.value) return []
    const claims = user.value?.claims as KeycloakRoleClaims | undefined
    const realmRoles = claims?.realm_access?.roles ?? []
    const clientRoles = claims?.resource_access?.[UMP_CLIENT]?.roles ?? []
    return [...new Set([...realmRoles, ...clientRoles])]
  })

  // Modell-Zugriffsrollen: `modelserver` (alle) + `modelserver_<id>` (je Modellserver).
  // UMP filtert die Prozessliste serverseitig danach; hier v. a. für spätere Anzeige.
  const modelServerRoles = computed(() =>
    roles.value.filter(r => r === 'modelserver' || r.startsWith('modelserver_')),
  )

  // Admin-Gate: echte ump_admin-Rolle ODER Dev-Override (bis die Rolle in Keycloak existiert).
  const isAdmin = computed(() => devForceAdmin === true || roles.value.includes(ADMIN_ROLE))

  return { roles, modelServerRoles, isAdmin }
}
