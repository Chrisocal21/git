'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'
import PageHeader from '@/components/PageHeader'
import { askConfirm, toast } from '@/components/Dialogs'
import { CloseIcon } from '@/components/Icons'
import { rememberJob } from '@/lib/jobsChanged'

// The saved sets as this phone last saw them. The server answers "none" when it can't read
// them, and saving sends the whole list, so without this one bad moment would wipe the library.
const SETS_KEY = 'burrow-prompt-sets'

interface BasePromptSet {
  id: string
  label: string
  prompt1: string
  prompt2: string
  createdAt: string
}

interface BaseSource {
  label: string
  prompt1: string
  prompt2: string
}

function stripQuotes(s: string) {
  return s.trim().replace(/^"""\s*/, '').replace(/\s*"""$/, '').trim()
}

export default function PromptCreatorPage() {
  const router = useRouter()
  // The job this page was opened from (its Prompts card), if any
  const [fromJobId, setFromJobId] = useState<string>('')

  const [promptSets, setPromptSets] = useState<BasePromptSet[]>([])
  const [loadingPrompts, setLoadingPrompts] = useState(true)
  const [selectedSetId, setSelectedSetId] = useState<string>('')

  const [jobs, setJobs] = useState<Fldr[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [selectedJobBaseId, setSelectedJobBaseId] = useState<string>('')

  // Which library the base prompt is coming from
  const [baseTab, setBaseTab] = useState<'sets' | 'jobs'>('sets')

  // Add prompt set form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPrompt1, setNewPrompt1] = useState('')
  const [newPrompt2, setNewPrompt2] = useState('')

  // Generator form
  const [theme, setTheme] = useState('')
  const [character, setCharacter] = useState('')
  const [vision, setVision] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<{ prompt1: string; prompt2: string } | null>(null)
  const [genError, setGenError] = useState('')
  const [copied1, setCopied1] = useState(false)
  const [copied2, setCopied2] = useState(false)
  const [expanded1, setExpanded1] = useState(false)
  const [expanded2, setExpanded2] = useState(false)

  // Save-to-job
  const [saveTargetJobId, setSaveTargetJobId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)

  // Refine after testing
  const [guidance, setGuidance] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState('')

  useEffect(() => {
    const jobId = new URLSearchParams(window.location.search).get('job') || ''
    if (jobId) {
      setFromJobId(jobId)
      setSaveTargetJobId(jobId)
    }

    let remembered: BasePromptSet[] = []
    try {
      const stored = JSON.parse(localStorage.getItem(SETS_KEY) || '[]')
      if (Array.isArray(stored)) remembered = stored
    } catch {}

    const show = (sets: BasePromptSet[]) => {
      setPromptSets(sets)
      if (sets.length > 0) setSelectedSetId(sets[0].id)
      setLoadingPrompts(false)
    }

    fetch('/api/prompts')
      .then(r => r.ok ? r.json() : { prompts: [] })
      .then(d => {
        const sets: BasePromptSet[] = d.prompts || []
        // An empty answer when this phone knows of sets is more likely a failed read than a cleared library
        if (sets.length === 0 && remembered.length > 0) return show(remembered)
        try { localStorage.setItem(SETS_KEY, JSON.stringify(sets)) } catch {}
        show(sets)
      })
      .catch(() => show(remembered))

    fetch('/api/fldrs')
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const list: Fldr[] = Array.isArray(d) ? d : []
        setJobs(list)
        setLoadingJobs(false)
        // Opened from a job that already has prompts: start from those
        const from = list.find(job => job.id === jobId)
        if (from && (from.job_info?.prompt_1 || from.job_info?.prompt_2)) {
          setBaseTab('jobs')
          setSelectedJobBaseId(from.id)
        }
      })
      .catch(() => setLoadingJobs(false))
  }, [])

  // Jobs that already have a saved prompt log — usable as a base, and browsable for reuse
  const jobsWithPrompts = useMemo(() => {
    return jobs
      .filter(f => !f.archived && (f.job_info?.prompt_1 || f.job_info?.prompt_2))
      .sort((a, b) => new Date(b.date_start || 0).getTime() - new Date(a.date_start || 0).getTime())
  }, [jobs])

  // Jobs a generated prompt set can be saved onto (exclude time-off blocks)
  const savableJobs = useMemo(() => {
    return jobs
      .filter(f => !f.archived && f.fldr_type !== 'time_off')
      .sort((a, b) => new Date(b.date_start || 0).getTime() - new Date(a.date_start || 0).getTime())
  }, [jobs])

  const savePromptSets = async (updated: BasePromptSet[]) => {
    setPromptSets(updated)
    try { localStorage.setItem(SETS_KEY, JSON.stringify(updated)) } catch {}
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: updated }),
      })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
    } catch {
      toast("Couldn't save your sets to the cloud. They're kept on this phone for now.", 'error')
    }
  }

  const addPromptSet = () => {
    if (!newLabel.trim() || (!newPrompt1.trim() && !newPrompt2.trim())) return
    const set: BasePromptSet = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      prompt1: newPrompt1.trim(),
      prompt2: newPrompt2.trim(),
      createdAt: new Date().toISOString(),
    }
    const updated = [...promptSets, set]
    savePromptSets(updated)
    setSelectedSetId(set.id)
    setBaseTab('sets')
    setNewLabel('')
    setNewPrompt1('')
    setNewPrompt2('')
    setShowAddForm(false)
  }

  const deletePromptSet = async (id: string) => {
    const target = promptSets.find(p => p.id === id)
    const confirmed = await askConfirm({
      title: 'Delete this saved set?',
      body: `\u201c${target?.label || 'This set'}\u201d and its two prompts will be gone for the whole team.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return
    const updated = promptSets.filter(p => p.id !== id)
    savePromptSets(updated)
    if (selectedSetId === id) setSelectedSetId(updated[0]?.id || '')
  }

  const selectedSet = promptSets.find(p => p.id === selectedSetId) || null
  const selectedJobBase = jobsWithPrompts.find(j => j.id === selectedJobBaseId) || null

  const baseSource: BaseSource | null = useMemo(() => {
    if (baseTab === 'sets' && selectedSet) {
      return { label: selectedSet.label, prompt1: selectedSet.prompt1, prompt2: selectedSet.prompt2 }
    }
    if (baseTab === 'jobs' && selectedJobBase) {
      return {
        label: selectedJobBase.title,
        prompt1: selectedJobBase.job_info?.prompt_1 || '',
        prompt2: selectedJobBase.job_info?.prompt_2 || '',
      }
    }
    return null
  }, [baseTab, selectedSet, selectedJobBase])

  const generate = async () => {
    if (!baseSource) {
      setGenError('Select a base prompt set or a past job first')
      return
    }
    if (!theme.trim() && !character.trim() && !vision.trim()) {
      setGenError('Enter a new theme, character idea, and/or vision')
      return
    }

    setGenerating(true)
    setGenError('')
    setGenerated(null)
    setSaveMessage('')

    try {
      const res = await fetch('/api/prompt-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePrompt1: baseSource.prompt1,
          basePrompt2: baseSource.prompt2,
          theme,
          character,
          vision,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate prompt')
      setGenerated({ prompt1: stripQuotes(data.prompt1 || ''), prompt2: stripQuotes(data.prompt2 || '') })
      setExpanded1(false)
      setExpanded2(false)
      setGuidance('')
      setRefineError('')
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate prompt')
    } finally {
      setGenerating(false)
    }
  }

  const refine = async () => {
    if (!generated) return
    if (!guidance.trim()) {
      setRefineError('Describe what to adjust based on your test')
      return
    }

    setRefining(true)
    setRefineError('')
    setSaveMessage('')

    try {
      const res = await fetch('/api/prompt-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'refine',
          currentPrompt1: generated.prompt1,
          currentPrompt2: generated.prompt2,
          guidance,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to refine prompt')
      setGenerated({ prompt1: stripQuotes(data.prompt1 || ''), prompt2: stripQuotes(data.prompt2 || '') })
      setExpanded1(false)
      setExpanded2(false)
      setGuidance('')
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : 'Failed to refine prompt')
    } finally {
      setRefining(false)
    }
  }

  const copyToClipboard = (text: string, which: 1 | 2) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      if (which === 1) { setCopied1(true); setTimeout(() => setCopied1(false), 2000) }
      else { setCopied2(true); setTimeout(() => setCopied2(false), 2000) }
    })
  }

  const saveToJob = async () => {
    if (!generated || !saveTargetJobId) return
    setSaving(true)
    setSaveMessage('')
    setSaveFailed(false)
    try {
      const res = await fetch(`/api/fldrs/${saveTargetJobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_info: {
            prompt_1: generated.prompt1 || null,
            prompt_2: generated.prompt2 || null,
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to save to job')
      const updatedFldr = await res.json()
      setJobs(prev => prev.map(j => j.id === updatedFldr.id ? updatedFldr : j))
      // So the job's own page shows them straight away
      rememberJob(updatedFldr)
      const job = jobs.find(j => j.id === saveTargetJobId)
      setSaveMessage(`Saved to ${job?.title || 'job'} — it's now in that job's prompt log for reuse later.`)
      toast(`Prompts saved to ${job?.title || 'the job'}`)
    } catch (e) {
      setSaveFailed(true)
      setSaveMessage("Couldn't save to the job. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-page text-white">
      <PageHeader title="Prompt Creator" />

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
        <p className="text-sm text-white/60 leading-relaxed">
          Take Prompt 1 &amp; Prompt 2 from a saved set or a past job, swap in a new theme and character, and save the result to the next job.
        </p>

        {fromJobId && (
          <div className="rounded-xl border border-gold/35 bg-gold/[0.06] px-3.5 py-3 text-sm leading-relaxed text-white/80">
            Working on <span className="font-semibold text-white">{jobs.find(job => job.id === fromJobId)?.title || 'this job'}</span>. What you make here saves back to it.
          </div>
        )}

        {/* Base Prompt Library */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Base Prompt</h2>
            <button
              onClick={() => setShowAddForm(o => !o)}
              className="btn-secondary min-h-[2.75rem] px-3.5 font-medium"
            >
              {showAddForm ? 'Cancel' : '+ Add Set'}
            </button>
          </div>

          {/* Tabs */}
          <div className="segmented mb-3" role="tablist" aria-label="Base prompt source">
            <button
              onClick={() => setBaseTab('sets')}
              role="tab"
              aria-selected={baseTab === 'sets'}
              className={`segment min-h-[2.75rem] ${baseTab === 'sets' ? 'segment-active' : ''}`}
            >
              Saved Sets ({promptSets.length})
            </button>
            <button
              onClick={() => setBaseTab('jobs')}
              role="tab"
              aria-selected={baseTab === 'jobs'}
              className={`segment min-h-[2.75rem] ${baseTab === 'jobs' ? 'segment-active' : ''}`}
            >
              Past Jobs ({jobsWithPrompts.length})
            </button>
          </div>

          {showAddForm && (
            <div className="card p-4 space-y-3 mb-3">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                aria-label="Name for this set"
                placeholder="Name it, e.g. San Diego Beach Engraving"
                className="input min-h-[2.75rem]"
              />
              <div>
                <label className="label">Prompt 1</label>
                <textarea
                  value={newPrompt1}
                  onChange={e => setNewPrompt1(e.target.value)}
                  placeholder="Paste Prompt 1 here..."
                  rows={6}
                  className="input resize-none font-mono"
                />
              </div>
              <div>
                <label className="label">Prompt 2</label>
                <textarea
                  value={newPrompt2}
                  onChange={e => setNewPrompt2(e.target.value)}
                  placeholder="Paste Prompt 2 here..."
                  rows={6}
                  className="input resize-none font-mono"
                />
              </div>
              <button
                onClick={addPromptSet}
                disabled={!newLabel.trim() || (!newPrompt1.trim() && !newPrompt2.trim())}
                className="btn-primary w-full min-h-[2.75rem]"
              >
                Save Prompt Set
              </button>
            </div>
          )}

          {baseTab === 'sets' && (
            loadingPrompts ? (
              <div className="text-sm text-white/45 text-center py-6">Loading...</div>
            ) : promptSets.length === 0 ? (
              <div className="text-sm text-white/50 text-center px-4 py-6 border border-dashed border-line-strong rounded-2xl">
                No base prompt sets yet. Add one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {promptSets.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-stretch rounded-xl border transition-colors ${
                      selectedSetId === p.id
                        ? 'bg-gold/10 border-gold/40'
                        : 'bg-surface border-line hover:bg-surface-raised hover:border-line-strong'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedSetId(p.id)}
                      aria-pressed={selectedSetId === p.id}
                      className="min-w-0 flex-1 p-3 text-left"
                    >
                      <span className={`block text-sm font-medium ${selectedSetId === p.id ? 'text-gold' : 'text-white'}`}>
                        {p.label}
                      </span>
                      {p.prompt1 && <span className="block text-xs text-white/45 mt-1 line-clamp-1">Prompt 1: {p.prompt1}</span>}
                      {p.prompt2 && <span className="block text-xs text-white/45 mt-0.5 line-clamp-1">Prompt 2: {p.prompt2}</span>}
                    </button>
                    <button
                      onClick={() => deletePromptSet(p.id)}
                      className="flex w-11 flex-shrink-0 items-center justify-center rounded-r-xl text-white/35 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      title="Delete this set"
                      aria-label={`Delete ${p.label}`}
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {baseTab === 'jobs' && (
            loadingJobs ? (
              <div className="text-sm text-white/45 text-center py-6">Loading...</div>
            ) : jobsWithPrompts.length === 0 ? (
              <div className="text-sm text-white/50 text-center px-4 py-6 border border-dashed border-line-strong rounded-2xl">
                No past jobs have saved prompts yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {jobsWithPrompts.map(job => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobBaseId(job.id)}
                    aria-pressed={selectedJobBaseId === job.id}
                    className={`w-full min-h-[2.75rem] text-left p-3 rounded-xl border transition-colors ${
                      selectedJobBaseId === job.id
                        ? 'bg-gold/10 border-gold/40'
                        : 'bg-surface border-line hover:bg-surface-raised hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${selectedJobBaseId === job.id ? 'text-gold' : 'text-white'}`}>
                        {job.title}
                      </span>
                      <span className="text-xs text-white/40 flex-shrink-0 tabular">
                        {job.date_start ? new Date(job.date_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </span>
                    </div>
                    {job.job_info?.prompt_1 && (
                      <p className="text-xs text-white/45 mt-1 line-clamp-1">Prompt 1: {job.job_info.prompt_1}</p>
                    )}
                    {job.job_info?.prompt_2 && (
                      <p className="text-xs text-white/45 mt-0.5 line-clamp-1">Prompt 2: {job.job_info.prompt_2}</p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}
        </section>

        {/* Generator */}
        <section>
          <h2 className="text-base font-semibold text-white mb-3">New Theme & Character</h2>
          <div className="space-y-3">
            <div>
              <label className="label">New Theme</label>
              <input
                value={theme}
                onChange={e => setTheme(e.target.value)}
                placeholder="e.g. Underwater fantasy world"
                className="input bg-surface"
              />
            </div>
            <div>
              <label className="label">New Character Idea</label>
              <input
                value={character}
                onChange={e => setCharacter(e.target.value)}
                placeholder="e.g. A friendly robot mascot"
                className="input bg-surface"
              />
            </div>
            <div>
              <label className="label">Vision</label>
              <textarea
                value={vision}
                onChange={e => setVision(e.target.value)}
                placeholder="Just explain what you're going for in your own words — the more detail, the better the rewrite."
                rows={4}
                className="input bg-surface resize-none"
              />
            </div>

            {genError && (
              <div role="alert" className="text-xs text-red-300 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg">
                {genError}
              </div>
            )}

            <button
              onClick={generate}
              disabled={generating || !baseSource}
              className="btn-primary w-full py-3"
            >
              {generating ? 'Generating...' : 'Generate New Prompts'}
            </button>
          </div>
        </section>

        {/* Output */}
        {generated && (generated.prompt1 || generated.prompt2) && (
          <section className="space-y-4">
            {generated.prompt1 && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button
                    onClick={() => setExpanded1(e => !e)}
                    aria-expanded={expanded1}
                    className="flex min-h-[2.75rem] flex-1 items-center gap-2 text-left"
                  >
                    <h2 className="text-base font-semibold text-white">Prompt 1</h2>
                    <svg
                      className={`w-4 h-4 text-white/40 transition-transform ${expanded1 ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="text-xs text-white/40">{expanded1 ? 'Show less' : 'Show all'}</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(generated.prompt1, 1)}
                    className="btn-secondary min-h-[2.75rem] px-4 font-medium"
                  >
                    {copied1 ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="card p-4">
                  <p className={`text-sm text-white/90 whitespace-pre-wrap font-mono ${expanded1 ? '' : 'line-clamp-2'}`}>
                    {generated.prompt1}
                  </p>
                </div>
              </div>
            )}

            {generated.prompt2 && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button
                    onClick={() => setExpanded2(e => !e)}
                    aria-expanded={expanded2}
                    className="flex min-h-[2.75rem] flex-1 items-center gap-2 text-left"
                  >
                    <h2 className="text-base font-semibold text-white">Prompt 2</h2>
                    <svg
                      className={`w-4 h-4 text-white/40 transition-transform ${expanded2 ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="text-xs text-white/40">{expanded2 ? 'Show less' : 'Show all'}</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(generated.prompt2, 2)}
                    className="btn-secondary min-h-[2.75rem] px-4 font-medium"
                  >
                    {copied2 ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="card p-4">
                  <p className={`text-sm text-white/90 whitespace-pre-wrap font-mono ${expanded2 ? '' : 'line-clamp-2'}`}>
                    {generated.prompt2}
                  </p>
                </div>
              </div>
            )}

            {/* Refine after testing */}
            <div className="card p-4 space-y-3">
              <div className="text-sm font-semibold text-white">Ran a test? Refine it</div>
              <p className="text-xs text-white/55 leading-relaxed">
                Tell it what to adjust based on what you saw — it'll tweak these same two prompts instead of starting over.
              </p>
              <textarea
                value={guidance}
                onChange={e => setGuidance(e.target.value)}
                placeholder="e.g. The background is too busy, tone it down. Make the character bigger in frame."
                rows={3}
                className="input resize-none"
              />
              {refineError && (
                <div role="alert" className="text-xs text-red-300 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg">
                  {refineError}
                </div>
              )}
              <button
                onClick={refine}
                disabled={refining || !guidance.trim()}
                className="btn-primary w-full min-h-[2.75rem]"
              >
                {refining ? 'Refining...' : 'Refine with Guidance'}
              </button>
            </div>

            {/* Save to job */}
            <div className="card p-4 space-y-3">
              <div className="text-sm font-semibold text-white">Save to a Job</div>
              <p className="text-xs text-white/55 leading-relaxed">
                Attach these prompts to a job's Prompt 1 / Prompt 2 fields, so they're logged there for future reuse.
              </p>
              <select
                value={saveTargetJobId}
                onChange={e => setSaveTargetJobId(e.target.value)}
                aria-label="Job to save the prompts to"
                className="input min-h-[2.75rem]"
              >
                <option value="">Select a job...</option>
                {savableJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title}{job.date_start ? ` — ${new Date(job.date_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={saveToJob}
                disabled={!saveTargetJobId || saving}
                className="btn-brand w-full min-h-[2.75rem]"
              >
                {saving ? 'Saving...' : 'Save to Job'}
              </button>
              {saveMessage && (
                <p role={saveFailed ? 'alert' : 'status'} className={`text-[13px] leading-relaxed ${saveFailed ? 'text-red-300' : 'text-emerald-400'}`}>
                  {saveMessage}
                </p>
              )}
              {saveMessage && !saveFailed && (
                <button onClick={() => router.push(`/jobs/${saveTargetJobId}`)} className="btn-secondary w-full min-h-[2.75rem] font-medium">
                  Open the Job
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
