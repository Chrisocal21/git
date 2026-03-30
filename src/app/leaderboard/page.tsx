'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaderboardEntry } from '@/app/api/leaderboard/route'

const TrophyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
    <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
    <path d="M6 2h12v7a6 6 0 0 1-12 0V2Z" />
    <path d="M12 15v5" />
    <path d="M8 20h8" />
  </svg>
)

const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4M12 15h4M8 11h.01M8 15h.01" />
  </svg>
)

const ChevronIcon = ({ up, className }: { up: boolean; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

const RANK_BADGE_STYLES = [
  { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  { bg: 'bg-gray-400/20',   text: 'text-gray-300'   },
  { bg: 'bg-orange-700/20', text: 'text-orange-400'  },
]

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank < 3) {
    const s = RANK_BADGE_STYLES[rank]
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.bg} shrink-0`}>
        <span className={`text-sm font-bold ${s.text}`}>{rank + 1}</span>
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 shrink-0">
      <span className="text-xs font-bold text-gray-500">{rank + 1}</span>
    </div>
  )
}

const RANK_COLORS = [
  'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
  'from-gray-400/20 to-gray-400/5 border-gray-400/30',
  'from-orange-700/20 to-orange-700/5 border-orange-700/30',
]

export default function LeaderboardPage() {
  const router = useRouter()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [totalJobs, setTotalJobs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        setLeaderboard(data.leaderboard ?? [])
        setTotalJobs(data.total_jobs ?? 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#111111] text-white pb-8">
      <div className="sticky top-0 z-10 bg-[#111111]/90 backdrop-blur-sm border-b border-white/10 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Back
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight">Leaderboard</h1>
            {!loading && (
              <p className="text-xs text-gray-500">{totalJobs} total jobs tracked</p>
            )}
          </div>
          <TrophyIcon className="w-6 h-6 text-[#E8B44D]" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            <ClipboardIcon className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p>No team member data yet.</p>
            <p className="text-sm mt-1">Add team members to jobs to see the leaderboard.</p>
          </div>
        ) : (
          leaderboard.map((entry, i) => {
            const isExpanded = expanded === entry.name
            const rankColor = RANK_COLORS[i] ?? 'from-white/10 to-white/5 border-white/10'
            const topThree = i < 3

            return (
              <div
                key={entry.name}
                className={`rounded-xl border bg-gradient-to-br ${rankColor} overflow-hidden transition-all`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : entry.name)}
                  className="w-full flex items-center gap-4 px-4 py-4 text-left"
                >
                  <RankBadge rank={i} />

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${topThree ? 'text-white' : 'text-gray-300'}`}>
                      {entry.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.jobCount} {entry.jobCount === 1 ? 'job' : 'jobs'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#E8B44D] rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((entry.jobCount / leaderboard[0].jobCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`text-lg font-bold min-w-[2ch] text-right ${topThree ? 'text-[#E8B44D]' : 'text-gray-400'}`}>
                      {entry.jobCount}
                    </span>
                    <ChevronIcon up={isExpanded} className="w-4 h-4 text-gray-600" />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/10 px-4 py-3 space-y-2">
                    {entry.jobs
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(job => (
                        <button
                          key={job.id}
                          onClick={() => router.push(`/jobs/${job.id}`)}
                          className="w-full flex justify-between items-center text-sm py-1 hover:text-[#E8B44D] transition-colors text-left"
                        >
                          <span className="text-gray-300 truncate flex-1">{job.title}</span>
                          <span className="text-gray-600 ml-3 shrink-0">
                            {new Date(job.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
