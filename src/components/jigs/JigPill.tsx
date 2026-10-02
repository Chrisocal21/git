export type PillTone = 'green' | 'blue' | 'amber' | 'red' | 'gray'

const TONES: Record<PillTone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300',
  blue: 'bg-blue-500/15 text-blue-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
  gray: 'bg-white/10 text-white/55',
}

/** Status pill, same look as the job status badges */
export default function JigPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`badge flex-shrink-0 ${TONES[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}
