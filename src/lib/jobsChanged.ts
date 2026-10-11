import type { Fldr } from '@/types/fldr'

// When a job or a time off entry is added, changed or removed from somewhere other than
// the screen that lists it (the dock's New button, a sheet on the calendar), the lists
// need to hear about it. This is how: whoever made the change announces it, and any
// screen showing jobs takes it on straight away, then loads the list again to be sure.

const EVENT = 'burrow:jobs-changed'
const LIST_KEY = 'git-fldrs'

export interface JobsChange {
  /** The entry as the server now has it */
  saved?: Fldr
  /** The entry that was deleted */
  deletedId?: string
}

export function announceJobsChanged(change: JobsChange = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<JobsChange>(EVENT, { detail: change }))
}

/** Runs `handler` whenever jobs change elsewhere. Returns the function that stops listening. */
export function onJobsChanged(handler: (change: JobsChange) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<JobsChange>).detail || {})
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

/** A list of jobs with one change applied to it */
export function applyJobsChange(jobs: Fldr[], change: JobsChange): Fldr[] {
  let next = jobs
  if (change.deletedId) next = next.filter(job => job.id !== change.deletedId)
  if (change.saved) {
    const saved = change.saved
    next = next.some(job => job.id === saved.id) ? next.map(job => (job.id === saved.id ? saved : job)) : [...next, saved]
  }
  return next
}

/** Puts a new or changed entry into the jobs list this phone keeps, so it shows up before the next load */
export function rememberJob(job: Fldr): void {
  try {
    const cached = localStorage.getItem(LIST_KEY)
    // With no list saved yet there's nothing to add to; the next load brings everything
    if (!cached) return
    localStorage.setItem(LIST_KEY, JSON.stringify(applyJobsChange(JSON.parse(cached), { saved: job })))
  } catch (e) {
    console.error('[Cache] Failed to update the jobs list:', e)
  }
}

/** Takes a deleted entry out of the jobs list this phone keeps */
export function forgetJob(id: string): void {
  try {
    const cached = localStorage.getItem(LIST_KEY)
    if (!cached) return
    localStorage.setItem(LIST_KEY, JSON.stringify(applyJobsChange(JSON.parse(cached), { deletedId: id })))
  } catch (e) {
    console.error('[Cache] Failed to update the jobs list:', e)
  }
}
