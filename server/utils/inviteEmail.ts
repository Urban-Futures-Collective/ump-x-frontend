// Sends the Keycloak invitation: a link to set a password and confirm the email address.
// The link is valid for three days. No admin ever sees or sets a password.
const INVITE_LIFESPAN_SECONDS = 3 * 24 * 60 * 60

export async function sendInvitation(userId: string): Promise<void> {
  await keycloakAdmin(`/users/${userId}/execute-actions-email`, {
    method: 'PUT',
    query: { lifespan: INVITE_LIFESPAN_SECONDS },
    body: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
  })
}
