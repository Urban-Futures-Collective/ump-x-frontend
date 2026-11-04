import { describe, expect, it } from 'vitest'
import { runsOfAvailableModels } from './jobsList'

const jobs = [
  { id: '1', processId: 'bikebox:growbike' },
  { id: '2', processId: 'modelserver-1:abm-test-model' },
]

describe('runsOfAvailableModels', () => {
  it('leaves out runs of models that are no longer listed', () => {
    expect(runsOfAvailableModels(jobs, ['bikebox:growbike']).map(j => j.id)).toEqual(['1'])
  })

  it('keeps a run without a process id', () => {
    const run: { id: string, processId?: string } = { id: '3' }
    expect(runsOfAvailableModels([run], [])).toEqual([run])
  })

  it('hides nothing without a process list', () => {
    expect(runsOfAvailableModels(jobs, null)).toEqual(jobs)
  })
})
