import { describe, expect, it } from 'vitest'
import { apiErrorExplanation, apiErrorMessage, apiErrorStatus } from './apiError'

// Shaped like an ofetch FetchError: the line in `message`, the body in `data`,
// the status in `statusCode`.
function fetchError(statusCode: number, data?: unknown) {
  return Object.assign(new Error(`[POST] "/ump/v1.0/processes/x/execution": ${statusCode}`), { statusCode, data })
}

describe('apiErrorExplanation', () => {
  it('takes detail from the OGC body', () => {
    expect(apiErrorExplanation(fetchError(403, { title: 'Forbidden', detail: 'Missing role \'x\'.' }))).toBe('Missing role \'x\'.')
  })

  it('falls back to title', () => {
    expect(apiErrorExplanation(fetchError(500, { title: 'Upstream Timeout' }))).toBe('Upstream Timeout')
  })

  it('takes a plain-text body', () => {
    expect(apiErrorExplanation(fetchError(500, 'Internal Server Error'))).toBe('Internal Server Error')
  })

  it('ignores an HTML error page', () => {
    expect(apiErrorExplanation(fetchError(502, '<html><body>Bad Gateway</body></html>'))).toBeNull()
  })

  it('returns null without a body', () => {
    expect(apiErrorExplanation(fetchError(500))).toBeNull()
  })
})

describe('apiErrorStatus', () => {
  it('reads statusCode', () => {
    expect(apiErrorStatus(fetchError(500))).toBe(500)
  })

  it('returns null for a network error', () => {
    expect(apiErrorStatus(new TypeError('fetch failed'))).toBeNull()
  })
})

describe('apiErrorMessage', () => {
  it('keeps the ofetch line when no explanation came', () => {
    expect(apiErrorMessage(fetchError(500))).toBe('[POST] "/ump/v1.0/processes/x/execution": 500')
  })
})
