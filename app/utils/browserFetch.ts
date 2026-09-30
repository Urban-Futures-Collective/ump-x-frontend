// fetch wrapper for calls to the user's model provider.
//
// The AI SDK adds its own `user-agent` header to every request
// (withUserAgentSuffix in @ai-sdk/provider-utils). Harmless on a server, but in
// the browser every custom header ends up in the CORS preflight, and Anthropic
// rejects the preflight (400) when user-agent is among the requested headers.
// Without this wrapper, calls work with OpenAI but fail with Anthropic, with no
// hint at the cause in the error.
//
// Only the (url, init) form is handled, which is how the SDK calls fetch. A
// Request object would pass through unchanged and fail visibly on Anthropic.
export const browserFetch: typeof globalThis.fetch = (eingabe, optionen) => {
  const koepfe = new Headers(optionen?.headers)
  koepfe.delete('user-agent')
  return globalThis.fetch(eingabe, { ...optionen, headers: koepfe })
}
