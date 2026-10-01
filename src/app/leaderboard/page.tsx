'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaderboardEntry } from '@/app/api/leaderboard/route'
import PageHeader from '@/components/PageHeader'

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
        <span className={`text-sm font-bold tabular ${s.text}`}>{rank + 1}</span>
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 shrink-0">
      <span className="text-xs font-bold tabular text-white/45">{rank + 1}</span>
    </div>
  )
}

// Podium places get a tinted border; everyone else gets the standard hairline
const RANK_COLORS = [
  'border-yellow-500/40',
  'border-gray-400/30',
  'border-orange-600/40',
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
    <div className="min-h-page text-white">
      <PageHeader
        title="Leaderboard"
        subtitle={!loading ? `${totalJobs} total jobs tracked` : undefined}
        width="max-w-lg"
        actions={<TrophyIcon className="w-6 h-6 text-gold mr-1" />}
      />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-2xl border border-line bg-surface animate-pulse" />
          ))
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardIcon className="w-10 h-10 mx-auto mb-3 text-white/20" />
            <p className="text-white/70">No team member data yet.</p>
            <p className="text-sm text-white/45 mt-1">Add team members to jobs to see the leaderboard.</p>
          </div>
        ) : (
          leaderboard.map((entry, i) => {
            const isExpanded = expanded === entry.name
            const rankColor = RANK_COLORS[i] ?? 'border-line'
            const topThree = i < 3

            return (
              <div
                key={entry.name}
                className={`card shadow-card ${rankColor} overflow-hidden transition-colors`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : entry.name)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <RankBadge rank={i} />

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${topThree ? 'text-white' : 'text-white/80'}`}>
                      {entry.name}
                    </p>
                    <p className="text-xs text-white/45 tabular">
                      {entry.jobCount} {entry.jobCount === 1 ? 'job' : 'jobs'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-20 sm:w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((entry.jobCount / leaderboard[0].jobCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`font-display text-lg font-semibold tabular min-w-[2ch] text-right ${topThree ? 'text-gold' : 'text-white/60'}`}>
                      {entry.jobCount}
                    </span>
                    <ChevronIcon up={isExpanded} className="w-4 h-4 text-white/35" />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-line bg-canvas/40 px-4 py-3 space-y-1">
                    {entry.jobs
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(job => (
                        <button
                          key={job.id}
                          onClick={() => router.push(`/jobs/${job.id}`)}
                          className="group w-full flex justify-between items-center text-sm py-1.5 text-left"
                        >
                          <span className="text-white/80 group-hover:text-gold transition-colors truncate flex-1">{job.title}</span>
                          <span className="text-white/40 text-xs ml-3 shrink-0 tabular">
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
