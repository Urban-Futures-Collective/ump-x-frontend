# Privacy inventory (GDPR)

Status: 2026-10-01. A technical inventory of where UMP-X processes personal data and
what is still missing. This is not legal advice; it is meant as input for the data
protection officer and as the basis for the privacy policy.

## Missing pages

The footer links to `/datenschutz` (privacy policy), `/impressum` (legal notice) and
`/barrierefreiheit` (accessibility statement). None of these pages exist yet, so all
three links currently lead to a 404.

## Where personal data is processed

| Where | Data | Purpose | Retention | Open point |
|---|---|---|---|---|
| Keycloak (`auth.urbanfuturescollective.org`) | Name, email, username, login events, sessions | Accounts and sign-in | Until the account is deleted | Who is the controller; deletion process |
| Keycloak admin events | Which admin account changed which user | Accountability | 90 days (realm setting) | Shows only the service account `ump-x-admin`, see server logs |
| UMP-X server logs | Keycloak ID of the admin plus target account, username on creation, search terms in the account list | Accountability for admin actions | Depends on Dokploy log retention | Define retention |
| Reverse proxy logs | IP address, URL, user agent | Operations, security | Not defined | Define retention |
| UMP jobs | Keycloak ID of the user who started a run, inputs, results | Running models, "My Scenarios" | No deletion yet, kept indefinitely | Retention period, deletion on account removal |
| Invitation emails | Email address, name | Account invitation | Mail server logs on the Plesk host | Mention in the privacy policy |
| Base map | IP address, page area viewed | Map display | Third party | Tiles come from `tile.openstreetmap.org` (OSM Foundation, UK); disclose, or serve tiles via an own proxy or tile server |
| Place search on the map | Search term, IP address | Jump to a place when drawing an area or points | Third party | Requests go from the browser to `nominatim.openstreetmap.org` (OSM Foundation, UK), only when the user searches; disclose together with the map tiles |
| AI chat | Chat messages, job summaries the chat looks up | Assistant for models and runs | Third party, depending on provider | Requests go from the browser directly to the provider the user selects (OpenRouter, OpenAI, Anthropic or a compatible endpoint), often outside the EU. Needs a notice in the chat and in the privacy policy |
| MCP server (`mcp.urbanfuturescollective.org`) | Requests from external clients with the user's token | Access for external AI clients | Not checked | Add to the inventory once its logging is known |

## Browser storage

| Name | Type | Content | Needed for |
|---|---|---|---|
| Session cookie (nuxt-oidc-auth) | Cookie | Encrypted server session reference | Sign-in, strictly necessary |
| Locale cookie (i18n) | Cookie | `de` or `en` | Language preference |
| `ump-x-commons-ansicht` | Cookie, 1 year | `tile` or `row` | View preference on Commons |
| `ump-x-ki` | localStorage | AI provider, model, API key of the user | AI chat, only if the user enters a key; cleared on logout |
| Chat history | sessionStorage | Chat messages | AI chat, gone when the tab closes |

No tracking or analytics services, fonts are bundled locally (no Google Fonts). All
storage is either strictly necessary or a preference the user sets, so a consent banner
is most likely not required. To be confirmed by the data protection officer.

## Infrastructure and processors

| Service | Role | Needed |
|---|---|---|
| IONOS | Hosting of the servers (Keycloak, UMP-X, mail) | Data processing agreement (DPA) |
| Dokploy | Deployment of UMP-X on our own server | No processor, self-hosted |
| UMP backend and model servers (e.g. HCU modelserver) | Run the models, receive inputs | Clarify roles between the partners (joint controllership or processing) |
| OSM Foundation | Map tiles | Not a processor; disclose as third party or replace |
| AI providers | Chosen by the user with their own key | Not our processor; disclose |

## Organisational tasks

1. **Privacy policy, legal notice, accessibility statement** as pages behind the footer links.
2. **Controller:** name the legal entity responsible for UMP-X and, if required, the data
   protection officer.
3. **Records of processing activities:** essentially the tables above.
4. **Data subject rights:** a process for access, rectification and erasure across
   Keycloak and UMP (account plus jobs). Account deletion in the admin portal depends on this.
5. **Retention periods** for jobs, logs, inactive and never activated accounts.
6. **Technical and organisational measures:** HTTPS everywhere, role checks on the server,
   admin actions logged, secrets only in Dokploy and Keycloak. Planned: AI keys stored
   encrypted in the UMP database (see below).
7. **Agreements** between the partners operating UMP, Keycloak and the model servers.

## Already in place

- No tracking, no external fonts, no third-party scripts.
- Sign-in via a server-side session; the access token never reaches the browser.
- Admin actions only through named server routes with role check and allowlist, each
  logged with the caller's ID.
- AI keys currently stay in the user's browser and do not pass through our server.

## Planned changes that affect this inventory

- **AI keys on the server:** keys are to be stored encrypted in the UMP database and the
  chat routed through our server. Then the key, and the chat content in transit, are
  processed by us. This needs its own entry in the records of processing, a retention
  and deletion rule (including on account removal), key management for the encryption,
  and an updated privacy policy. The provider becomes a recipient we send data to, not
  only one the user contacts directly.
