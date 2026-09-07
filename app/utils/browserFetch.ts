// Hülle um fetch für Aufrufe an den Modellanbieter des Nutzers.
//
// Das AI SDK hängt an jede Anfrage einen eigenen `user-agent`
// (withUserAgentSuffix in @ai-sdk/provider-utils). Auf einem Server ist das
// harmlos, im Browser nicht: dort landet jeder selbst gesetzte Kopf in der
// CORS-Vorabfrage, und Anthropic beantwortet die nur, wenn ausschließlich
// Header angefragt werden, die es kennt.
//
// Am 2026-09-04 gegen api.anthropic.com gemessen:
//   Vorabfrage mit content-type, x-api-key, anthropic-version,
//   anthropic-dangerous-direct-browser-access  -> 200, allow-origin: *
//   dieselbe Vorabfrage zusätzlich mit user-agent                -> 400
//
// Ohne diese Hülle lautet der Befund also „geht bei OpenAI, bricht bei
// Anthropic", und die Ursache steht in keiner Fehlermeldung.
//
// Bewusst nur der (url, init)-Fall: so ruft das SDK fetch auf. Käme je ein
// Request-Objekt herein, ginge der Kopf unverändert durch — dann fällt es beim
// nächsten Anthropic-Aufruf sofort auf.
export const browserFetch: typeof globalThis.fetch = (eingabe, optionen) => {
  const koepfe = new Headers(optionen?.headers)
  koepfe.delete('user-agent')
  return globalThis.fetch(eingabe, { ...optionen, headers: koepfe })
}
