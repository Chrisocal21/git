'use client'

import { useEffect, useRef } from 'react'

export interface NavSection {
  id: string
  label: string
}

interface SectionNavProps {
  sections: NavSection[]
  /** The section currently at the top of the screen */
  active: string
  onSelect: (id: string) => void
}

/** The row of section names that rides under the header, for jumping around a long job */
export default function SectionNav({ sections, active, onSelect }: SectionNavProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  // Keep the lit-up name in view when the row is wider than the phone
  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-section="${active}"]`)
    if (!row || !chip) return
    const left = chip.offsetLeft - 16
    const right = chip.offsetLeft + chip.offsetWidth + 16
    if (left < row.scrollLeft) row.scrollLeft = left
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth
  }, [active])

  return (
    <nav aria-label="Job sections" className="sticky top-14 z-20 mb-3 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div
        ref={rowRef}
        className="relative mx-auto flex max-w-2xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map(section => (
          <button
            key={section.id}
            type="button"
            data-section={section.id}
            onClick={() => onSelect(section.id)}
            aria-current={active === section.id ? 'true' : undefined}
            // On a phone the names share the row evenly; from tablet width they sit at their own size
            className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-center text-xs font-semibold transition-colors sm:flex-none sm:px-3.5 ${
              active === section.id ? 'bg-brand text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
