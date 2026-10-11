'use client'

import { useEffect, useRef } from 'react'
import { BoxIcon, CalendarIcon, ChecklistIcon, HomeIcon, MoreIcon, AirplaneIcon, UsersIcon } from '@/components/Icons'

export interface NavSection {
  id: string
  label: string
}

interface SectionNavProps {
  sections: NavSection[]
  /** The section on screen */
  active: string
  onSelect: (id: string) => void
}

const ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  overview: HomeIcon,
  event: CalendarIcon,
  logistics: ChecklistIcon,
  travel: AirplaneIcon,
  team: UsersIcon,
  more: MoreIcon,
}

/**
 * The tab bar under the job's name. Tapping a name shows that section and only that section,
 * so the screen never holds more than what's being worked on.
 */
export default function SectionNav({ sections, active, onSelect }: SectionNavProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  // On a very narrow phone the bar can be wider than the screen: keep the chosen tab in view
  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-section="${active}"]`)
    if (!row || !chip) return
    const left = chip.offsetLeft - 8
    const right = chip.offsetLeft + chip.offsetWidth + 8
    if (left < row.scrollLeft) row.scrollLeft = left
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth
  }, [active])

  return (
    <nav aria-label="Job sections" className="sticky top-14 z-20 mb-4 bg-canvas/85 pb-2 pt-1 backdrop-blur-xl">
      <div
        ref={rowRef}
        role="tablist"
        className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map(section => {
          const Icon = ICONS[section.id]
          const on = active === section.id
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              data-section={section.id}
              aria-selected={on}
              onClick={() => onSelect(section.id)}
              className={`flex h-[3.75rem] min-w-[3.6rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition-colors active:bg-white/10 ${
                on ? 'bg-brand/20 text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              {Icon && <Icon className={`h-[22px] w-[22px] ${on ? 'text-brand-light' : ''}`} />}
              {section.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
