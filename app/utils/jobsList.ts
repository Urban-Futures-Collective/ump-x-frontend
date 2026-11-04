/**
 * Runs whose model is still in the process list. Runs of removed models (e.g. from
 * before the switch to the model registry) can neither be repeated nor opened from
 * their model, so the list leaves them out. Without a process list (still loading,
 * or failed) nothing is hidden: an empty list must not look like "no runs". A run
 * without a process id cannot be matched and stays.
 */
export function runsOfAvailableModels<T extends { processId?: string }>(jobs: T[], processIds: string[] | null): T[] {
  if (!processIds) return jobs
  const known = new Set(processIds)
  return jobs.filter(job => !job.processId || known.has(job.processId))
}
