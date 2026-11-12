import type { Ref } from 'vue'
import type { Job } from '~/types/ump'
import type { OgcJob } from '~/composables/useUmpJobs'

// The verification run, shared by reviewing (V2) and re-verifying (V3): the reviewer
// starts a run in a new tab and enters its job id. UMP accepts only a successful run of
// this model, started by the reviewer after the review round began (or, when
// re-verifying, after the last verification); the check here catches the obvious
// mistakes first.
export function useVerificationRun(processId: Ref<string>) {
  const { t } = useI18n()
  const { base } = useUmpBase()

  const jobId = ref('')
  const job = ref<Job | null>(null)
  const jobProblem = ref<string | null>(null)
  const checking = ref(false)

  async function checkJob() {
    const id = jobId.value.trim()
    if (!id) return
    checking.value = true
    job.value = null
    jobProblem.value = null
    try {
      const found = toJob(await $fetch<OgcJob>(`${base}/jobs/${id}`))
      if (found.processId && found.processId !== processId.value) jobProblem.value = t('registry.review.jobOtherModel', { model: found.processId })
      else if (found.status !== 'successful') jobProblem.value = t('registry.review.jobNotDone', { status: found.status })
      job.value = found
    }
    catch (e) {
      jobProblem.value = apiErrorMessage(e)
    }
    finally {
      checking.value = false
    }
  }

  const jobReady = computed(() => !!job.value && !jobProblem.value)
  const jobDuration = computed(() => {
    const j = job.value
    if (!j?.created || !j.finished) return ''
    const s = Math.round((new Date(j.finished).getTime() - new Date(j.created).getTime()) / 1000)
    return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`
  })

  return { jobId, job, jobProblem, checking, checkJob, jobReady, jobDuration }
}
