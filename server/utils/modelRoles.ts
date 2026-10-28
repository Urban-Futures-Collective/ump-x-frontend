// Model-access roles in Keycloak (concept F12, D8; F11). Publishing a model creates two
// realm roles: `{provider}` for the whole model server and `{provider}:{process}` for
// the one model. UMP reads exactly these names from the token when a model is run.
// Publishing does not assign them to anyone; access admins do that later.
//
// The names come only from the model UMP returns, never from the caller: the service
// account may create any role, so a caller-supplied name would be a way in.

// UMP's own rule for server names (lower case, digits, dashes) and a process id without
// separators or whitespace. Anything else is refused rather than created.
const SERVER = /^[a-z0-9][a-z0-9-]{1,62}$/
const PROCESS = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function modelAccessRoleNames(provider: string, remoteProcessId: string): string[] {
  if (!SERVER.test(provider) || !PROCESS.test(remoteProcessId)) {
    throw new Error(`Unexpected model id: ${provider}:${remoteProcessId}`)
  }
  return [provider, `${provider}:${remoteProcessId}`]
}

// Creates the roles that are missing. "Already exists" (409) counts as success, so
// publishing again or after a partial failure is harmless.
export async function ensureRealmRoles(names: string[]): Promise<void> {
  for (const name of names) {
    try {
      await keycloakAdmin('/roles', {
        method: 'POST',
        body: { name, description: 'Model access (created when the model was published)' },
      })
    }
    catch (e) {
      if ((e as { statusCode?: number }).statusCode !== 409) throw e
    }
  }
}
