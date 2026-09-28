'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'

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

  // Refine after testing
  const [guidance, setGuidance] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState('')

  useEffect(() => {
    fetch('/api/prompts')
      .then(r => r.ok ? r.json() : { prompts: [] })
      .then(d => {
        const sets: BasePromptSet[] = d.prompts || []
        setPromptSets(sets)
        if (sets.length > 0) setSelectedSetId(sets[0].id)
        setLoadingPrompts(false)
      })
      .catch(() => setLoadingPrompts(false))

    fetch('/api/fldrs')
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        setJobs(Array.isArray(d) ? d : [])
        setLoadingJobs(false)
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
    await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts: updated }),
    }).catch(() => {})
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

  const deletePromptSet = (id: string) => {
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
      const job = jobs.find(j => j.id === saveTargetJobId)
      setSaveMessage(`Saved to ${job?.title || 'job'} — it's now in that job's prompt log for reuse later.`)
    } catch (e) {
      setSaveMessage('Failed to save to job. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] p-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-[#E8B44D] mb-2">Prompt Creator</h1>
          <p className="text-white/80 text-sm">
            Take Prompt 1 &amp; Prompt 2 from a saved set or a past job, swap in a new theme and character, and save the result to the next job.
          </p>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Base Prompt Library */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#E8B44D]">Base Prompt</h2>
            <button
              onClick={() => setShowAddForm(o => !o)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#2F5F7F] hover:bg-[#3A6B86] transition-colors text-white"
            >
              {showAddForm ? 'Cancel' : '+ Add Set'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setBaseTab('sets')}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
                baseTab === 'sets' ? 'bg-[#E8B44D] text-black' : 'bg-[#1a1a1a] text-white/50 hover:text-white'
              }`}
            >
              Saved Sets ({promptSets.length})
            </button>
            <button
              onClick={() => setBaseTab('jobs')}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
                baseTab === 'jobs' ? 'bg-[#E8B44D] text-black' : 'bg-[#1a1a1a] text-white/50 hover:text-white'
              }`}
            >
              Past Jobs ({jobsWithPrompts.length})
            </button>
          </div>

          {showAddForm && (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 space-y-3 mb-3">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Label (e.g. San Diego Beach Engraving)"
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm"
              />
              <div>
                <label className="block text-xs text-white/50 mb-1">Prompt 1</label>
                <textarea
                  value={newPrompt1}
                  onChange={e => setNewPrompt1(e.target.value)}
                  placeholder="Paste Prompt 1 here..."
                  rows={6}
                  className="w-full px-3 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm resize-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Prompt 2</label>
                <textarea
                  value={newPrompt2}
                  onChange={e => setNewPrompt2(e.target.value)}
                  placeholder="Paste Prompt 2 here..."
                  rows={6}
                  className="w-full px-3 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm resize-none font-mono"
                />
              </div>
              <button
                onClick={addPromptSet}
                disabled={!newLabel.trim() || (!newPrompt1.trim() && !newPrompt2.trim())}
                className="w-full py-2 bg-[#E8B44D] hover:bg-[#D4A03C] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors text-sm"
              >
                Save Prompt Set
              </button>
            </div>
          )}

          {baseTab === 'sets' && (
            loadingPrompts ? (
              <div className="text-sm text-white/40 text-center py-6">Loading...</div>
            ) : promptSets.length === 0 ? (
              <div className="text-sm text-white/40 text-center py-6 border border-dashed border-white/10 rounded-xl">
                No base prompt sets yet. Add one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {promptSets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedSetId(p.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedSetId === p.id
                        ? 'bg-[#E8B44D]/10 border-[#E8B44D]/40'
                        : 'bg-[#1a1a1a] border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${selectedSetId === p.id ? 'text-[#E8B44D]' : 'text-white'}`}>
                        {p.label}
                      </span>
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); deletePromptSet(p.id) }}
                        className="text-white/30 hover:text-red-400 transition-colors p-1"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-1 line-clamp-1">
                      {p.prompt1 ? `P1: ${p.prompt1}` : ''}
                    </p>
                    {p.prompt2 && (
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-1">P2: {p.prompt2}</p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {baseTab === 'jobs' && (
            loadingJobs ? (
              <div className="text-sm text-white/40 text-center py-6">Loading...</div>
            ) : jobsWithPrompts.length === 0 ? (
              <div className="text-sm text-white/40 text-center py-6 border border-dashed border-white/10 rounded-xl">
                No past jobs have saved prompts yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {jobsWithPrompts.map(job => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobBaseId(job.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedJobBaseId === job.id
                        ? 'bg-[#E8B44D]/10 border-[#E8B44D]/40'
                        : 'bg-[#1a1a1a] border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${selectedJobBaseId === job.id ? 'text-[#E8B44D]' : 'text-white'}`}>
                        {job.title}
                      </span>
                      <span className="text-xs text-white/30 flex-shrink-0">
                        {job.date_start ? new Date(job.date_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </span>
                    </div>
                    {job.job_info?.prompt_1 && (
                      <p className="text-xs text-white/40 mt-1 line-clamp-1">P1: {job.job_info.prompt_1}</p>
                    )}
                    {job.job_info?.prompt_2 && (
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-1">P2: {job.job_info.prompt_2}</p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}
        </section>

        {/* Generator */}
        <section>
          <h2 className="text-lg font-semibold text-[#E8B44D] mb-3">New Theme & Character</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">New Theme</label>
              <input
                value={theme}
                onChange={e => setTheme(e.target.value)}
                placeholder="e.g. Underwater fantasy world"
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">New Character Idea</label>
              <input
                value={character}
                onChange={e => setCharacter(e.target.value)}
                placeholder="e.g. A friendly robot mascot"
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Vision</label>
              <textarea
                value={vision}
                onChange={e => setVision(e.target.value)}
                placeholder="Just explain what you're going for in your own words — the more detail, the better the rewrite."
                rows={4}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm resize-none"
              />
            </div>

            {genError && (
              <div className="text-xs text-red-400 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                {genError}
              </div>
            )}

            <button
              onClick={generate}
              disabled={generating || !baseSource}
              className="w-full py-2.5 bg-[#E8B44D] hover:bg-[#D4A03C] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors text-sm"
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
                <button
                  onClick={() => setExpanded1(e => !e)}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[#E8B44D]">Prompt 1</h2>
                    <svg
                      className={`w-4 h-4 text-white/40 transition-transform ${expanded1 ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(generated.prompt1, 1) }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#2F5F7F] hover:bg-[#3A6B86] transition-colors text-white"
                  >
                    {copied1 ? 'Copied!' : 'Copy'}
                  </span>
                </button>
                <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
                  <p className={`text-sm text-white/90 whitespace-pre-wrap font-mono ${expanded1 ? '' : 'line-clamp-2'}`}>
                    {generated.prompt1}
                  </p>
                </div>
              </div>
            )}

            {generated.prompt2 && (
              <div>
                <button
                  onClick={() => setExpanded2(e => !e)}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[#E8B44D]">Prompt 2</h2>
                    <svg
                      className={`w-4 h-4 text-white/40 transition-transform ${expanded2 ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(generated.prompt2, 2) }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#2F5F7F] hover:bg-[#3A6B86] transition-colors text-white"
                  >
                    {copied2 ? 'Copied!' : 'Copy'}
                  </span>
                </button>
                <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
                  <p className={`text-sm text-white/90 whitespace-pre-wrap font-mono ${expanded2 ? '' : 'line-clamp-2'}`}>
                    {generated.prompt2}
                  </p>
                </div>
              </div>
            )}

            {/* Refine after testing */}
            <div className="bg-[#1a2332] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-white">Ran a test? Refine it</div>
              <p className="text-xs text-gray-400">
                Tell it what to adjust based on what you saw — it'll tweak these same two prompts instead of starting over.
              </p>
              <textarea
                value={guidance}
                onChange={e => setGuidance(e.target.value)}
                placeholder="e.g. The background is too busy, tone it down. Make the character bigger in frame."
                rows={3}
                className="w-full px-3 py-2 bg-[#0f1419] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm resize-none"
              />
              {refineError && (
                <div className="text-xs text-red-400 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  {refineError}
                </div>
              )}
              <button
                onClick={refine}
                disabled={refining || !guidance.trim()}
                className="w-full py-2 bg-[#E8B44D] hover:bg-[#D4A03C] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors text-sm"
              >
                {refining ? 'Refining...' : 'Refine with Guidance'}
              </button>
            </div>

            {/* Save to job */}
            <div className="bg-[#1a2332] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-white">Save to a Job</div>
              <p className="text-xs text-gray-400">
                Attach these prompts to a job's Prompt 1 / Prompt 2 fields, so they're logged there for future reuse.
              </p>
              <select
                value={saveTargetJobId}
                onChange={e => setSaveTargetJobId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1419] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm"
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
                className="w-full py-2 bg-[#2a7b9b] hover:bg-[#245f78] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {saving ? 'Saving...' : 'Save to Job'}
              </button>
              {saveMessage && (
                <p className="text-xs text-emerald-400">{saveMessage}</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
