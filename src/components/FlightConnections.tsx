'use client'

import { useMemo, useState } from 'react'
import { FlightSegment } from '@/types/fldr'

// Per-traveler connection graph: orders segments by departure time and checks
// that each flight starts where the previous one landed.

const UNASSIGNED = 'Unassigned'

type Issue = 'gap' | 'tight' | 'long' | 'overlap' | 'missing'

interface Link {
  from: FlightSegment
  to: FlightSegment
  issue: Issue | null
  layoverMin: number | null
  note: string | null
}

const code = (c: string | null | undefined) => (c || '').trim().toUpperCase()
const ms = (t: string | null | undefined) => {
  if (!t) return null
  const v = new Date(t).getTime()
  return Number.isNaN(v) ? null : v
}

function fmtDur(min: number) {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

function fmtTime(t: string | null) {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

function analyze(segments: FlightSegment[]) {
  // Sort by departure time; segments with no time keep their original order at the end
  const sorted = segments
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const ta = ms(a.s.departure_time)
      const tb = ms(b.s.departure_time)
      if (ta === null && tb === null) return a.i - b.i
      if (ta === null) return 1
      if (tb === null) return -1
      return ta - tb
    })
    .map(x => x.s)

  const links: Link[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i]
    const to = sorted[i + 1]
    const arr = code(from.arrival_code)
    const dep = code(to.departure_code)
    const arrT = ms(from.arrival_time)
    const depT = ms(to.departure_time)
    const layoverMin = arrT !== null && depT !== null ? Math.round((depT - arrT) / 60000) : null

    let issue: Issue | null = null
    let note: string | null = null
    if (!arr || !dep) {
      issue = 'missing'
      note = 'Missing airport code'
    } else if (arr !== dep) {
      issue = 'gap'
      note = `Lands ${arr}, next flight leaves ${dep}`
    } else if (layoverMin !== null && layoverMin < 0) {
      issue = 'overlap'
      note = 'Next flight departs before this one lands'
    } else if (layoverMin !== null && layoverMin < 45) {
      issue = 'tight'
      note = 'Tight connection'
    } else if (layoverMin !== null && layoverMin > 24 * 60) {
      note = 'Overnight+ stay' // a stay between trips, not a problem
    } else if (layoverMin !== null && layoverMin > 8 * 60) {
      issue = 'long'
      note = 'Long layover'
    }
    links.push({ from, to, issue, layoverMin, note })
  }
  return { sorted, links }
}

const issueStyle: Record<Issue, string> = {
  gap: 'text-red-400 border-red-500/40 bg-red-500/10',
  overlap: 'text-red-400 border-red-500/40 bg-red-500/10',
  missing: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  tight: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  long: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
}

export default function FlightConnections({ segments }: { segments: FlightSegment[] }) {
  // Group segments by traveler (a segment with several travelers appears in each group)
  const groups = useMemo(() => {
    const map = new Map<string, FlightSegment[]>()
    for (const seg of segments) {
      const names = seg.travelers && seg.travelers.length > 0 ? seg.travelers : [UNASSIGNED]
      for (const n of names) {
        if (!map.has(n)) map.set(n, [])
        map.get(n)!.push(seg)
      }
    }
    return Array.from(map.entries())
  }, [segments])

  const [selected, setSelected] = useState<string | null>(null)

  if (segments.length === 0) return null

  const active = groups.find(([n]) => n === selected) ? selected! : groups[0][0]
  const activeSegs = groups.find(([n]) => n === active)![1]
  const { sorted, links } = analyze(activeSegs)

  // Trip-level checks: does the itinerary end where it started?
  const first = code(sorted[0]?.departure_code)
  const last = code(sorted[sorted.length - 1]?.arrival_code)
  const openEnded = sorted.length > 0 && first && last && first !== last
  const issues = links.filter(l => l.issue && l.issue !== 'long').length + (openEnded ? 1 : 0)

  return (
    <div className="p-3 bg-black/20 border border-white/10 rounded-lg space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#2a7b9b]">Connection Check</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${issues === 0 ? 'text-green-400 border-green-500/40 bg-green-500/10' : 'text-red-400 border-red-500/40 bg-red-500/10'}`}>
          {issues === 0 ? 'All connected' : `${issues} ${issues === 1 ? 'issue' : 'issues'}`}
        </span>
      </div>

      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {groups.map(([name, segs]) => {
            const a = analyze(segs)
            const bad = a.links.some(l => l.issue && l.issue !== 'long')
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelected(name)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  name === active
                    ? 'bg-[#2a7b9b]/25 border-[#2a7b9b] text-white'
                    : 'border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {name}
                {bad && <span className="ml-1 text-red-400">●</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Graph: airports as nodes, flights as edges, layovers between flights */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-start gap-0 min-w-max">
          {sorted.map((seg, i) => {
            const link = links[i] // link from this segment to the next
            const prevLink = links[i - 1]
            const dep = code(seg.departure_code) || '???'
            const arr = code(seg.arrival_code) || '???'
            // The departure node is only drawn for the first segment; later ones
            // reuse the arrival node of the previous flight unless there's a gap.
            const showDepNode = i === 0 || (prevLink && prevLink.issue === 'gap')
            return (
              <div key={seg.id} className="flex items-start">
                {showDepNode && (
                  <>
                    {i > 0 && (
                      <div className="flex flex-col items-center px-1 pt-1">
                        <span className="text-red-400 text-xs font-bold">✕</span>
                      </div>
                    )}
                    <Node label={dep} bad={i > 0} />
                  </>
                )}
                <Edge seg={seg} />
                <Node label={arr} bad={link?.issue === 'gap' || link?.issue === 'missing'} />
                {link && (
                  <LayoverBadge link={link} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Issue list */}
      <ul className="space-y-1">
        {links.filter(l => l.issue).map((l, i) => (
          <li key={i} className={`text-xs px-2 py-1 border rounded ${issueStyle[l.issue!]}`}>
            {code(l.from.arrival_code) || '???'} → {code(l.to.departure_code) || '???'}: {l.note}
            {l.layoverMin !== null && l.layoverMin >= 0 && l.issue !== 'gap' ? ` (${fmtDur(l.layoverMin)})` : ''}
          </li>
        ))}
        {openEnded && (
          <li className="text-xs px-2 py-1 border rounded text-red-400 border-red-500/40 bg-red-500/10">
            Trip starts at {first} but ends at {last} — no flight back to {first}
          </li>
        )}
        {sorted.some(s => !ms(s.departure_time) || !ms(s.arrival_time)) && (
          <li className="text-xs px-2 py-1 border rounded text-yellow-400 border-yellow-500/40 bg-yellow-500/10">
            Some segments are missing times, so order and layovers are approximate
          </li>
        )}
        {active === UNASSIGNED && (
          <li className="text-xs text-gray-500">Add travelers to segments to see each person&apos;s itinerary.</li>
        )}
      </ul>
    </div>
  )
}

function Node({ label, bad }: { label: string; bad?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-mono font-bold text-sm ${
          bad ? 'border-red-500/60 text-red-300 bg-red-500/10' : 'border-[#2a7b9b] text-white bg-[#2a7b9b]/15'
        }`}
      >
        {label}
      </div>
    </div>
  )
}

function Edge({ seg }: { seg: FlightSegment }) {
  return (
    <div className="flex flex-col items-center w-28 pt-1">
      <div className="text-[10px] text-gray-400 leading-tight text-center">
        {[seg.airline, seg.flight_number].filter(Boolean).join(' ') || 'Flight'}
      </div>
      <div className="flex items-center w-full my-1">
        <div className="flex-1 h-px bg-[#2a7b9b]" />
        <span className="text-[#2a7b9b] text-xs leading-none">▶</span>
      </div>
      <div className="text-[10px] text-gray-500 leading-tight text-center">{fmtTime(seg.departure_time)}</div>
    </div>
  )
}

function LayoverBadge({ link }: { link: Link }) {
  const color = link.issue === 'gap' || link.issue === 'overlap'
    ? 'text-red-400'
    : link.issue
    ? 'text-yellow-400'
    : 'text-gray-500'
  return (
    <div className="flex flex-col items-center w-20 pt-3">
      <div className={`h-px w-full border-t border-dashed ${link.issue === 'gap' ? 'border-red-500/60' : 'border-white/20'}`} />
      <div className={`text-[10px] mt-1 text-center leading-tight ${color}`}>
        {link.issue === 'gap'
          ? 'not connected'
          : link.layoverMin !== null && link.layoverMin >= 0
          ? fmtDur(link.layoverMin)
          : '—'}
      </div>
    </div>
  )
}
