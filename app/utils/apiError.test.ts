import { describe, expect, it } from 'vitest'
import { apiErrorExplanation, apiErrorMessage, apiErrorStatus } from './apiError'

// Nachgebaut wie ein FetchError von ofetch: die Zeile in `message`, der Rumpf
// in `data`, der Status in `statusCode`.
function fetchFehler(statusCode: number, data?: unknown) {
  return Object.assign(new Error(`[POST] "/ump/v1.0/processes/x/execution": ${statusCode}`), { statusCode, data })
}

describe('apiErrorExplanation', () => {
  it('nimmt detail aus dem OGC-Rumpf', () => {
    expect(apiErrorExplanation(fetchFehler(403, { title: 'Forbidden', detail: 'Missing role \'x\'.' }))).toBe('Missing role \'x\'.')
  })

  it('fällt auf title zurück', () => {
    expect(apiErrorExplanation(fetchFehler(500, { title: 'Upstream Timeout' }))).toBe('Upstream Timeout')
  })

  it('nimmt einen reinen Text-Rumpf', () => {
    expect(apiErrorExplanation(fetchFehler(500, 'Internal Server Error'))).toBe('Internal Server Error')
  })

  it('ignoriert eine HTML-Fehlerseite', () => {
    expect(apiErrorExplanation(fetchFehler(502, '<html><body>Bad Gateway</body></html>'))).toBeNull()
  })

  it('gibt null ohne Rumpf', () => {
    expect(apiErrorExplanation(fetchFehler(500))).toBeNull()
  })
})

describe('apiErrorStatus', () => {
  it('liest statusCode', () => {
    expect(apiErrorStatus(fetchFehler(500))).toBe(500)
  })

  it('gibt null bei einem Netzfehler', () => {
    expect(apiErrorStatus(new TypeError('fetch failed'))).toBeNull()
  })
})

describe('apiErrorMessage', () => {
  it('bleibt bei der ofetch-Zeile, wenn keine Erklärung kam', () => {
    expect(apiErrorMessage(fetchFehler(500))).toBe('[POST] "/ump/v1.0/processes/x/execution": 500')
  })
})
