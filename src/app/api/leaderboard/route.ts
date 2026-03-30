import { NextResponse } from 'next/server'
import { getAllFldrs, isD1Enabled } from '@/lib/d1'
import { fldrStore } from '@/lib/store'

export interface LeaderboardEntry {
  name: string
  jobCount: number
  jobs: Array<{ id: string; title: string; date: string }>
}

export async function GET() {
  try {
    const fldrs = isD1Enabled()
      ? await getAllFldrs()
      : fldrStore.getAll()

    // Count jobs per team member across all fldrs.
    // Key = lowercased name so "MIchael" and "Michael" merge into one entry.
    // We track all spelling variants seen and pick the most common one as the display name.
    const counts = new Map<string, LeaderboardEntry & { variants: Map<string, number> }>()

    for (const fldr of fldrs) {
      // Collect names from both sources and deduplicate within this job
      const seenInThisJob = new Set<string>()

      // Source 1: job_info.team_members (string array)
      for (const member of fldr.job_info?.team_members ?? []) {
        const name = member.trim()
        if (name) seenInThisJob.add(name)
      }

      // Source 2: people array (Person objects with name + role)
      for (const person of fldr.people ?? []) {
        const name = person.name?.trim()
        if (name) seenInThisJob.add(name)
      }

      for (const name of Array.from(seenInThisJob)) {
        const key = name.toLowerCase()
        if (!counts.has(key)) {
          counts.set(key, { name, jobCount: 0, jobs: [], variants: new Map() })
        }
        const entry = counts.get(key)!
        entry.jobCount++
        entry.jobs.push({ id: fldr.id, title: fldr.title, date: fldr.date_start })
        // Track how many times each spelling appears so we can pick the best one
        entry.variants.set(name, (entry.variants.get(name) ?? 0) + 1)
      }
    }

    // Resolve display name: whichever spelling appeared most often wins
    const leaderboard = Array.from(counts.values()).map(({ variants, ...entry }) => {
      const bestName = Array.from(variants.entries()).sort((a, b) => b[1] - a[1])[0][0]
      return { ...entry, name: bestName }
    }).sort((a, b) => {
      if (b.jobCount !== a.jobCount) return b.jobCount - a.jobCount
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ leaderboard, total_jobs: fldrs.length })
  } catch (error) {
    console.error('[leaderboard] Error:', error)
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
  }
}
