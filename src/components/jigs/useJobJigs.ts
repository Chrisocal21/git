'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { jigsGet, JigApiError } from '@/lib/jigsClient'
import type { JigAllocation, JobJigsResponse } from '@/types/jigs'

export interface JobJigs {
  allocations: JigAllocation[]
  loading: boolean
  /** True once the job's list has really been fetched, so an empty list can be trusted */
  loaded: boolean
  /** Why jigs can't be used right now, or null when they can */
  problem: string | null
  online: boolean
  /** The profile picked in the menu, or null when nobody is picked */
  userName: string | null
  reload: () => Promise<void>
  /** Every change comes back as the job's fresh list; drop it straight in */
  replace: (list: JigAllocation[]) => void
}

/** Loads the jigs on one job. Held in one place so every product on the job shares a single request. */
export function useJobJigs(jobId: string | undefined, enabled: boolean): JobJigs {
  const [allocations, setAllocations] = useState<JigAllocation[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!jobId) return
    try {
      const data = await jigsGet<JobJigsResponse | unknown[]>(`/api/jigs/job/${encodeURIComponent(jobId)}`)
      // Offline with nothing saved, the service worker answers API calls with []
      if (!data || Array.isArray(data) || !Array.isArray((data as JobJigsResponse).allocations)) {
        setProblem("You're offline.")
        return
      }
      const body = data as JobJigsResponse
      if (!body.d1) {
        setProblem("The database isn't connected.")
        return
      }
      setAllocations(body.allocations)
      setLoaded(true)
      setProblem(null)
    } catch (e) {
      const code = e instanceof JigApiError ? e.code : null
      setProblem(
        code === 'not_migrated'
          ? "Jigs aren't set up in the database yet."
          : code === 'offline'
          ? "You're offline."
          : "Couldn't load the jigs."
      )
    } finally {
      setLoading(false)
    }
  }, [jobId])

  const reloadRef = useRef(reload)
  reloadRef.current = reload

  useEffect(() => {
    setUserName(getCurrentUser()?.name ?? null)
    setOnline(navigator.onLine)
    const goOnline = () => {
      setOnline(true)
      reloadRef.current()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (!jobId || !enabled) return
    setLoading(true)
    reload()
  }, [jobId, enabled, reload])

  return { allocations, loading, loaded, problem, online, userName, reload, replace: setAllocations }
}
