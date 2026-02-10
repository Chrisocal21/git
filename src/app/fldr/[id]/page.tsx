'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Fldr, QuickReference, JobInfo, ReferenceLink, Person } from '@/types/fldr'
import { ChevronDownIcon } from '@/components/Icons'
import CopyButton from '@/components/CopyButton'
import { FldrDetailSkeleton } from '@/components/SkeletonLoader'
import { 
  getCachedFldr, 
  cacheFldr, 
  addToSyncQueue, 
  hasUnsyncedChanges,
  isOnline,
  syncQueuedChanges,
  clearAllCache
} from '@/lib/offlineStorage'

export default function FldrDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [fldr, setFldr] = useState<Fldr | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    quickRef: false,
    preTrip: false,
    jobInfo: false,
    checklist: false,
    people: false,
    notes: false,
  })
  const [generatingWrapUp, setGeneratingWrapUp] = useState(false)
  const [online, setOnline] = useState(true)
  const [hasUnsynced, setHasUnsynced] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [, setRefreshCounter] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDateStart, setEditDateStart] = useState('')
  const [editDateEnd, setEditDateEnd] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check online status
    const updateOnlineStatus = () => {
      setOnline(isOnline())
      setHasUnsynced(hasUnsyncedChanges())
    }
    
    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (params.id) {
      const fldrId = params.id as string
      
      // Try to load from cache first (fallback 1: offlineStorage)
      let cached = getCachedFldr(fldrId)
      
      // Fallback 2: Check the main list cache
      if (!cached) {
        try {
          const listCache = localStorage.getItem('git-fldrs')
          if (listCache) {
            const allFldrs = JSON.parse(listCache)
            cached = allFldrs.find((f: Fldr) => f.id === fldrId)
          }
        } catch (e) {
          console.error('Failed to parse list cache:', e)
        }
      }
      
      if (cached) {
        setFldr(cached)
        setEditTitle(cached.title)
        setEditDateStart(cached.date_start)
        setEditDateEnd(cached.date_end || '')
        setEditLocation(cached.location || '')
        setLoading(false)
      }
      
      // Don't fetch from server - we're using localStorage as primary storage
      // Server memory resets on Vercel serverless, so it's unreliable
      // Only sync happens on explicit save (in saveFldr function)
      if (!cached) {
        // No cached data - redirect to list
        console.error('No cached data found for fldr:', fldrId)
        router.push('/fldr')
      }
    }
  }, [params.id, router])

  const saveFldr = useCallback(async (updates: Partial<Fldr>) => {
    if (!fldr) return
    setSaving(true)
    try {
      // Check if fldr should be marked as ready/complete
      const updatedFldr = { ...fldr, ...updates }
      const hasQuickRef = updatedFldr.quick_reference && (
        updatedFldr.quick_reference.flight_info ||
        updatedFldr.quick_reference.hotel_name ||
        updatedFldr.quick_reference.onsite_address
      )
      const hasJobInfo = updatedFldr.job_info && (
        updatedFldr.job_info.client_name ||
        updatedFldr.job_info.item
      )
      
      // Auto-update status if it's currently incomplete and has key info
      if (updatedFldr.status === 'incomplete' && (hasQuickRef || hasJobInfo)) {
        updates.status = 'ready'
      }
      
      // Update local state and cache immediately
      const newFldr = { ...fldr, ...updates }
      setFldr(newFldr)
      cacheFldr(newFldr)
      setLastSaved(new Date())
      
      // Also update the list cache so changes appear on list page
      try {
        const listCache = localStorage.getItem('git-fldrs')
        if (listCache) {
          const allFldrs = JSON.parse(listCache)
          const index = allFldrs.findIndex((f: Fldr) => f.id === fldr.id)
          if (index !== -1) {
            allFldrs[index] = newFldr
            localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
          }
        }
      } catch (e) {
        console.error('Failed to update list cache:', e)
      }
      
      // If online, save to server
      if (isOnline()) {
        try {
          const response = await fetch(`/api/fldrs/${fldr.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
          if (response.ok) {
            const updated = await response.json()
            setFldr(updated)
            cacheFldr(updated)
            setLastSaved(new Date())
            
            // Update list cache with server response
            try {
              const listCache = localStorage.getItem('git-fldrs')
              if (listCache) {
                const allFldrs = JSON.parse(listCache)
                const index = allFldrs.findIndex((f: Fldr) => f.id === fldr.id)
                if (index !== -1) {
                  allFldrs[index] = updated
                  localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
                }
              }
            } catch (e) {
              console.error('Failed to update list cache:', e)
            }
          }
        } catch (error) {
          // If save fails, add to sync queue
          addToSyncQueue(fldr.id, updates)
          setHasUnsynced(true)
        }
      } else {
        // Offline: add to sync queue
        addToSyncQueue(fldr.id, updates)
        setHasUnsynced(true)
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }, [fldr])

  // Debounced save - clear existing timeout and set new one
  const debouncedSave = useCallback((updates: Partial<Fldr>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setSaving(true)
    saveTimeoutRef.current = setTimeout(() => {
      saveFldr(updates)
    }, 1000) // Save 1 second after typing stops
  }, [saveFldr])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Update "time ago" display every minute
  useEffect(() => {
    if (!lastSaved) return
    const interval = setInterval(() => {
      // Force re-render to update "time ago" text
      setRefreshCounter(c => c + 1)
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [lastSaved])

  const toggleCard = (cardName: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }))
  }

  const updateQuickRef = (field: keyof QuickReference, value: string) => {
    if (!fldr) return
    const quickRef = fldr.quick_reference || {
      flight_info: null,
      hotel_name: null,
      hotel_address: null,
      onsite_address: null,
      local_airport: null,
      departure_airport: null,
    }
    const updated = { ...quickRef, [field]: value || null }
    setFldr({ ...fldr, quick_reference: updated })
    debouncedSave({ quick_reference: updated })
  }

  const updateJobInfo = (field: keyof JobInfo, value: any) => {
    if (!fldr) return
    const jobInfo = fldr.job_info || {
      client_name: null,
      item: null,
      quantity: null,
      job_type: null,
      client_contact_name: null,
      client_contact_phone: null,
      client_contact_email: null,
      event_details: null,
      reference_links: [],
      team_members: [],
      pre_engrave_details: null,
    }
    const updated = { ...jobInfo, [field]: value }
    setFldr({ ...fldr, job_info: updated })
    debouncedSave({ job_info: updated })
  }

  const addReferenceLink = () => {
    if (!fldr) return
    const jobInfo = fldr.job_info || {
      client_name: null,
      item: null,
      quantity: null,
      job_type: null,
      client_contact_name: null,
      client_contact_phone: null,
      client_contact_email: null,
      event_details: null,
      reference_links: [],
      team_members: [],
      pre_engrave_details: null,
    }
    const newLink: ReferenceLink = { label: '', url: '' }
    updateJobInfo('reference_links', [...jobInfo.reference_links, newLink])
  }

  const updateReferenceLink = (index: number, field: 'label' | 'url', value: string) => {
    if (!fldr?.job_info) return
    const links = [...fldr.job_info.reference_links]
    links[index] = { ...links[index], [field]: value }
    updateJobInfo('reference_links', links)
  }

  const removeReferenceLink = (index: number) => {
    if (!fldr?.job_info) return
    const links = fldr.job_info.reference_links.filter((_, i) => i !== index)
    updateJobInfo('reference_links', links)
  }

  const addTeamMember = () => {
    if (!fldr) return
    const jobInfo = fldr.job_info || {
      client_name: null,
      item: null,
      quantity: null,
      job_type: null,
      client_contact_name: null,
      client_contact_phone: null,
      client_contact_email: null,
      event_details: null,
      reference_links: [],
      team_members: [],
      pre_engrave_details: null,
    }
    updateJobInfo('team_members', [...jobInfo.team_members, ''])
  }

  const updateTeamMember = (index: number, value: string) => {
    if (!fldr?.job_info) return
    const members = [...fldr.job_info.team_members]
    members[index] = value
    updateJobInfo('team_members', members)
  }

  const removeTeamMember = (index: number) => {
    if (!fldr?.job_info) return
    const members = fldr.job_info.team_members.filter((_, i) => i !== index)
    updateJobInfo('team_members', members)
  }

  const updateNotes = (value: string) => {
    if (!fldr) return
    setFldr({ ...fldr, notes: value })
    debouncedSave({ notes: value })
  }

  const updateWrapUp = (value: string) => {
    if (!fldr) return
    setFldr({ ...fldr, wrap_up: value })
    debouncedSave({ wrap_up: value })
  }

  const addChecklistItem = () => {
    if (!fldr) return
    const checklist = fldr.checklist || []
    const newItem = { item: '', completed: false }
    const updated = [...checklist, newItem]
    setFldr({ ...fldr, checklist: updated })
    debouncedSave({ checklist: updated })
  }

  const updateChecklistItem = (index: number, value: string) => {
    if (!fldr?.checklist) return
    const items = [...fldr.checklist]
    items[index] = { ...items[index], item: value }
    setFldr({ ...fldr, checklist: items })
    debouncedSave({ checklist: items })
  }

  const toggleChecklistItem = (index: number) => {
    if (!fldr?.checklist) return
    const items = [...fldr.checklist]
    items[index] = { ...items[index], completed: !items[index].completed }
    setFldr({ ...fldr, checklist: items })
    debouncedSave({ checklist: items })
  }

  const removeChecklistItem = (index: number) => {
    if (!fldr?.checklist) return
    const items = fldr.checklist.filter((_, i) => i !== index)
    setFldr({ ...fldr, checklist: items })
    debouncedSave({ checklist: items })
  }

  const addPerson = () => {
    if (!fldr) return
    const people = fldr.people || []
    const newPerson: Person = { name: '', role: null, phone: null, email: null }
    const updated = [...people, newPerson]
    setFldr({ ...fldr, people: updated })
    debouncedSave({ people: updated })
  }

  const updatePerson = (index: number, field: keyof Person, value: string) => {
    if (!fldr?.people) return
    const people = [...fldr.people]
    people[index] = { ...people[index], [field]: value || null }
    setFldr({ ...fldr, people })
    debouncedSave({ people })
  }

  const removePerson = (index: number) => {
    if (!fldr?.people) return
    const people = fldr.people.filter((_, i) => i !== index)
    setFldr({ ...fldr, people })
    debouncedSave({ people })
  }

  const enableModule = (module: 'checklist' | 'people' | 'job_info') => {
    if (!fldr) return
    if (module === 'checklist') {
      setFldr({ ...fldr, checklist: [] })
      debouncedSave({ checklist: [] })
      setExpandedCards(prev => ({ ...prev, checklist: true }))
    } else if (module === 'people') {
      setFldr({ ...fldr, people: [] })
      debouncedSave({ people: [] })
      setExpandedCards(prev => ({ ...prev, people: true }))
    } else if (module === 'job_info') {
      const jobInfo: JobInfo = {
        client_name: null,
        item: null,
        quantity: null,
        job_type: null,
        client_contact_name: null,
        client_contact_phone: null,
        client_contact_email: null,
        event_details: null,
        reference_links: [],
        team_members: [],
        pre_engrave_details: null,
      }
      setFldr({ ...fldr, job_info: jobInfo })
      debouncedSave({ job_info: jobInfo })
      setExpandedCards(prev => ({ ...prev, jobInfo: true, preTrip: true }))
    }
  }

  const updateStatus = async (newStatus: 'incomplete' | 'ready' | 'active' | 'complete') => {
    if (!fldr) return
    setSaving(true)
    try {
      setFldr({ ...fldr, status: newStatus })
      await saveFldr({ status: newStatus })
    } finally {
      setSaving(false)
    }
  }

  const generateWrapUp = async () => {
    if (!fldr || !fldr.notes.trim()) return
    
    setGeneratingWrapUp(true)
    try {
      const response = await fetch('/api/wrap-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: fldr.notes,
          fldr_title: fldr.title,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        const wrapUp = data.wrap_up
        // Save wrap-up to fldr and update local state
        const updatedFldr = { ...fldr, wrap_up: wrapUp }
        setFldr(updatedFldr)
        await saveFldr({ wrap_up: wrapUp })
      }
    } catch (error) {
      console.error('Failed to generate wrap-up:', error)
    } finally {
      setGeneratingWrapUp(false)
    }
  }

  const handleSync = async () => {
    if (!isOnline()) return
    setSaving(true)
    const success = await syncQueuedChanges()
    if (success) {
      setHasUnsynced(false)
      // Don't fetch from server - it might be stale
      // Local cache is the source of truth
    }
    setSaving(false)
  }

  const handleHardRefresh = async () => {
    if (confirm('Clear all offline data? This will remove all locally saved changes!')) {
      clearAllCache()
      setHasUnsynced(false)
      // Redirect to list since we cleared everything
      router.push('/fldr')
    }
  }

  const enableEditMode = () => {
    if (!fldr) return
    setEditTitle(fldr.title)
    setEditDateStart(fldr.date_start)
    setEditDateEnd(fldr.date_end || '')
    setEditLocation(fldr.location || '')
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
  }

  const saveBasicInfo = async () => {
    if (!fldr || !editTitle.trim() || !editDateStart) return
    
    setSaving(true)
    const updates = {
      title: editTitle,
      date_start: editDateStart,
      date_end: editDateEnd || null,
      location: editLocation || null,
    }
    
    setFldr({ ...fldr, ...updates })
    await saveFldr(updates)
    setEditMode(false)
    setSaving(false)
  }

  if (loading || !fldr) {
    return <FldrDetailSkeleton />
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/fldr')}
            className="text-[#3b82f6] hover:text-[#2563eb]"
          >
            ← Back
          </button>
          {!editMode && (
            <button
              onClick={enableEditMode}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✏️ Edit
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold">GIT</h1>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {/* Online/Offline indicator */}
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-400">{online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          {saving && (
            <span className="text-xs text-yellow-400">Saving...</span>
          )}
          {!saving && lastSaved && (
            <span className="text-xs text-gray-500">
              Saved {new Date().getTime() - lastSaved.getTime() < 60000
                ? 'just now'
                : `${Math.floor((new Date().getTime() - lastSaved.getTime()) / 60000)}m ago`}
            </span>
          )}
        </div>
      </div>

      {/* Sync status bar */}
      {hasUnsynced && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-yellow-500">Unsynced changes</span>
          </div>
          <div className="flex gap-2">
            {online && (
              <button
                onClick={handleSync}
                className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded text-xs font-medium transition-colors"
              >
                Sync Now
              </button>
            )}
            <button
              onClick={handleHardRefresh}
              disabled={!online}
              className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-yellow-500/50 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hard Refresh
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        {editMode ? (
          <div className="space-y-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="Trip or event name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editDateStart}
                  onChange={(e) => setEditDateStart(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  End Date <span className="text-xs text-gray-500">(optional)</span>
                </label>
                <input
                  type="date"
                  value={editDateEnd}
                  onChange={(e) => setEditDateEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Location <span className="text-xs text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="City, State"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveBasicInfo}
                disabled={!editTitle.trim() || !editDateStart || saving}
                className="flex-1 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-2xl font-bold">{fldr.title}</h2>
              <div className={`px-2 py-1 rounded text-xs font-medium border ${
                fldr.status === 'incomplete' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                fldr.status === 'ready' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                fldr.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>
                {fldr.status}
              </div>
            </div>
            <div className="text-gray-400">
              {formatDate(fldr.date_start)}
              {fldr.date_end && ` - ${formatDate(fldr.date_end)}`}
            </div>
            {fldr.location && (
              <div className="text-gray-500 mt-1">{fldr.location}</div>
            )}
          </>
        )}
      </div>

      {/* Status Actions */}
      {(fldr.status === 'ready' || fldr.status === 'incomplete') && (
        <div className="mb-4">
          <button
            onClick={() => updateStatus('active')}
            disabled={saving}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Activating...' : '▶️ Activate Job'}
          </button>
        </div>
      )}
      {fldr.status === 'active' && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => updateStatus('complete')}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Completing...' : '✓ Mark Complete'}
          </button>
          <button
            onClick={() => updateStatus('ready')}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Pausing...' : '⏸ Pause'}
          </button>
        </div>
      )}
      {fldr.status === 'complete' && (
        <div className="mb-4">
          <button
            onClick={() => updateStatus('active')}
            disabled={saving}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Reactivating...' : '↻ Reactivate Job'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {/* Quick Reference Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleCard('quickRef')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
          >
            <span className="font-semibold">Quick Reference</span>
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform ${
                expandedCards.quickRef ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedCards.quickRef && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Flight Info</label>
                <textarea
                  value={fldr.quick_reference?.flight_info || ''}
                  onChange={(e) => updateQuickRef('flight_info', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                  rows={2}
                  placeholder="Flight number, times..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Hotel Name</label>
                <input
                  type="text"
                  value={fldr.quick_reference?.hotel_name || ''}
                  onChange={(e) => updateQuickRef('hotel_name', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                  placeholder="Hotel name"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-400">Hotel Address</label>
                  <CopyButton text={fldr.quick_reference?.hotel_address || ''} label="Copy address" />
                </div>
                <textarea
                  value={fldr.quick_reference?.hotel_address || ''}
                  onChange={(e) => updateQuickRef('hotel_address', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                  rows={2}
                  placeholder="Full hotel address"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-400">Onsite Address</label>
                  <CopyButton text={fldr.quick_reference?.onsite_address || ''} label="Copy address" />
                </div>
                <textarea
                  value={fldr.quick_reference?.onsite_address || ''}
                  onChange={(e) => updateQuickRef('onsite_address', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                  rows={2}
                  placeholder="Event location address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Local Airport</label>
                  <input
                    type="text"
                    value={fldr.quick_reference?.local_airport || ''}
                    onChange={(e) => updateQuickRef('local_airport', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="e.g. LAX"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Departure Airport</label>
                  <input
                    type="text"
                    value={fldr.quick_reference?.departure_airport || ''}
                    onChange={(e) => updateQuickRef('departure_airport', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="e.g. JFK"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pre-trip Info Card - Only show if job_info enabled */}
        {fldr.job_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCard('preTrip')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
            >
              <span className="font-semibold">Pre-trip Info</span>
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform ${
                  expandedCards.preTrip ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCards.preTrip && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pre-engrave Details</label>
                  <textarea
                    value={fldr.job_info?.pre_engrave_details || ''}
                    onChange={(e) => updateJobInfo('pre_engrave_details', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={3}
                    placeholder="Pre-engrave prep notes..."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Team Members</label>
                    <button
                      onClick={addTeamMember}
                      className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                    >
                      + Add
                    </button>
                  </div>
                  {fldr.job_info?.team_members.map((member, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={member}
                        onChange={(e) => updateTeamMember(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                        placeholder="Name"
                      />
                      <button
                        onClick={() => removeTeamMember(index)}
                        className="px-3 text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(!fldr.job_info?.team_members || fldr.job_info.team_members.length === 0) && (
                    <p className="text-xs text-gray-500">No team members yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Job Info Card - Only show if job_info enabled */}
        {fldr.job_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCard('jobInfo')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
            >
              <span className="font-semibold">Job Info</span>
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform ${
                  expandedCards.jobInfo ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCards.jobInfo && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={fldr.job_info?.client_name || ''}
                    onChange={(e) => updateJobInfo('client_name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Client/company name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Item</label>
                    <input
                      type="text"
                      value={fldr.job_info?.item || ''}
                      onChange={(e) => updateJobInfo('item', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Product"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={fldr.job_info?.quantity || ''}
                      onChange={(e) => updateJobInfo('quantity', parseInt(e.target.value) || null)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Job Type</label>
                  <select
                    value={fldr.job_info?.job_type || ''}
                    onChange={(e) => updateJobInfo('job_type', e.target.value || null)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                  >
                    <option value="">Select type</option>
                    <option value="caricatures">Caricatures</option>
                    <option value="names_monograms">Names/Monograms</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={fldr.job_info?.client_contact_name || ''}
                    onChange={(e) => updateJobInfo('client_contact_name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Contact person"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-gray-400">Phone</label>
                      <CopyButton text={fldr.job_info?.client_contact_phone || ''} label="Copy phone" />
                    </div>
                    <input
                      type="tel"
                      value={fldr.job_info?.client_contact_phone || ''}
                      onChange={(e) => updateJobInfo('client_contact_phone', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-gray-400">Email</label>
                      <CopyButton text={fldr.job_info?.client_contact_email || ''} label="Copy email" />
                    </div>
                    <input
                      type="email"
                      value={fldr.job_info?.client_contact_email || ''}
                      onChange={(e) => updateJobInfo('client_contact_email', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Event Details</label>
                  <textarea
                    value={fldr.job_info?.event_details || ''}
                    onChange={(e) => updateJobInfo('event_details', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={3}
                    placeholder="Event context, special instructions..."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Reference Links</label>
                    <button
                      onClick={addReferenceLink}
                      className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                    >
                      + Add
                    </button>
                  </div>
                  {(fldr.job_info?.reference_links || []).map((link, index) => (
                    <div key={index} className="space-y-2 mb-3 p-3 bg-[#0a0a0a] rounded-lg">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateReferenceLink(index, 'label', e.target.value)}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                        placeholder="Label"
                      />
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => updateReferenceLink(index, 'url', e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                          placeholder="URL"
                        />
                        <button
                          onClick={() => removeReferenceLink(index)}
                          className="px-3 text-red-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!fldr.job_info?.reference_links || fldr.job_info.reference_links.length === 0) && (
                    <p className="text-xs text-gray-500">No reference links yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checklist Card - Only show if enabled */}
        {fldr.checklist !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCard('checklist')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
            >
              <span className="font-semibold">Checklist</span>
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform ${
                  expandedCards.checklist ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCards.checklist && (
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">
                    {(fldr.checklist || []).filter(i => i.completed).length} / {(fldr.checklist || []).length} complete
                  </span>
                  <button
                    onClick={addChecklistItem}
                    className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                  >
                    + Add Item
                  </button>
                </div>
                {(fldr.checklist || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleChecklistItem(index)}
                      className="w-4 h-4 rounded border-[#2a2a2a] bg-[#0a0a0a] accent-[#3b82f6]"
                    />
                    <input
                      type="text"
                      value={item.item}
                      onChange={(e) => updateChecklistItem(index, e.target.value)}
                      className={`flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm ${
                        item.completed ? 'line-through text-gray-500' : ''
                      }`}
                      placeholder="Item"
                    />
                    <button
                      onClick={() => removeChecklistItem(index)}
                      className="px-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}  
                {(fldr.checklist || []).length === 0 && (
                  <p className="text-xs text-gray-500 py-2">No items yet</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* People Card - Only show if enabled */}
        {fldr.people !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCard('people')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
            >
              <span className="font-semibold">People</span>
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform ${
                  expandedCards.people ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCards.people && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{(fldr.people || []).length} people</span>
                  <button
                    onClick={addPerson}
                    className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                  >
                    + Add Person
                  </button>
                </div>
                {(fldr.people || []).map((person, index) => (
                  <div key={index} className="p-3 bg-[#0a0a0a] rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePerson(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm font-medium"
                        placeholder="Name"
                      />
                      <button
                        onClick={() => removePerson(index)}
                        className="px-2 text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                    <input
                      type="text"
                      value={person.role || ''}
                      onChange={(e) => updatePerson(index, 'role', e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Role"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="tel"
                          value={person.phone || ''}
                          onChange={(e) => updatePerson(index, 'phone', e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                          placeholder="Phone"
                        />
                        <CopyButton text={person.phone || ''} label="Copy" />
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="email"
                          value={person.email || ''}
                          onChange={(e) => updatePerson(index, 'email', e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                          placeholder="Email"
                        />
                        <CopyButton text={person.email || ''} label="Copy" />
                      </div>
                    </div>
                  </div>
                ))}
                {fldr.people.length === 0 && (
                  <p className="text-xs text-gray-500 py-2">No people yet</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notes Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleCard('notes')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
          >
            <span className="font-semibold">Notes</span>
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform ${
                expandedCards.notes ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedCards.notes && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea
                  value={fldr.notes}
                  onChange={(e) => updateNotes(e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                  placeholder="Add notes..."
                />
              </div>
              <button
                onClick={generateWrapUp}
                disabled={!fldr.notes.trim() || generatingWrapUp}
                className="w-full py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 hover:border-[#3b82f6] disabled:border-[#2a2a2a] disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                {generatingWrapUp ? 'Generating Wrap-up...' : '✨ Generate Wrap-up'}
              </button>
              {fldr.wrap_up && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Wrap-up Summary</label>
                  <textarea
                    value={fldr.wrap_up}
                    onChange={(e) => updateWrapUp(e.target.value)}
                    className="w-full min-h-[120px] px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                    placeholder="Wrap-up will appear here..."
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(fldr.wrap_up!)}
                    className="mt-2 w-full py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg text-sm font-medium transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Module Section */}
      <div className="mt-6 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
        <h3 className="text-sm font-semibold mb-3 text-gray-400">Add Module</h3>
        <div className="flex flex-wrap gap-2">
          {fldr.job_info === null && (
            <button
              onClick={() => enableModule('job_info')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Job Info
            </button>
          )}
          {fldr.checklist === null && (
            <button
              onClick={() => enableModule('checklist')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Checklist
            </button>
          )}
          {fldr.people === null && (
            <button
              onClick={() => enableModule('people')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + People
            </button>
          )}
        </div>
        {fldr.job_info !== null && fldr.checklist !== null && fldr.people !== null && (
          <p className="text-xs text-gray-500">All modules enabled</p>
        )}
      </div>
    </div>
  )
}
