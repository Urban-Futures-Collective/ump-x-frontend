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

// Vokabular und Auslesen der Rollen liegen in shared/utils/roles.ts, weil der Server
// für die Admin-Routen dieselben Namen prüft.

export function useUmpRoles() {
  const { loggedIn, user } = useOidcAuth()

  const roles = computed<string[]>(() => {
    if (!loggedIn.value) return []
    return rolesOfSession(user.value)
  })

  // Modell-Zugriffsrollen: `modelserver` (alle) + `modelserver_<id>` (je Modellserver).
  // UMP filtert die Prozessliste serverseitig danach; hier v. a. für spätere Anzeige.
  const modelServerRoles = computed(() =>
    roles.value.filter(r => r === 'modelserver' || r.startsWith('modelserver_')),
  )

  // Admin-Gate: hängt allein an den Admin-Rollen aus dem Token. Die beiden Rollen
  // einzeln, weil das Admin-Portal je nach Rolle andere Bereiche zeigt.
  const isAccessAdmin = computed(() => roles.value.includes(ROLE_ACCESS_ADMIN))
  const isPlatformAdmin = computed(() => roles.value.includes(ROLE_PLATFORM_ADMIN))
  const isAdmin = computed(() => isAccessAdmin.value || isPlatformAdmin.value)

  return { roles, modelServerRoles, isAdmin, isAccessAdmin, isPlatformAdmin }
}
