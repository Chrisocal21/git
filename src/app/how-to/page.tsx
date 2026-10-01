'use client'

import { BurrowLogo } from '@/components/BurrowLogo'
import PageHeader from '@/components/PageHeader'

// Icon values are SVG path data (24px outline set)
const QUICK_FEATURES = [
  {
    title: 'Auto-Sync',
    body: 'All changes sync to cloud automatically. Access from any device.',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  },
  {
    title: 'Offline Mode',
    body: 'Works without internet. Changes sync when you reconnect.',
    icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  },
  {
    title: 'Weather',
    body: 'Auto weather forecast for every job location on event day.',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  },
  {
    title: 'Map View',
    body: 'See all jobs on a map. Plan routes. Check distances.',
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  },
  {
    title: 'Homebase Time',
    body: 'Menu shows San Diego time. Always know homebase hours.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Team Sharing',
    body: 'Share jobs with team. Everyone sees updates in real-time.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
]

function Step({ title, action, detail }: { title: string; action: string; detail: string }) {
  return (
    <div className="card p-4">
      <h3 className="text-white font-semibold text-sm mb-1.5">{title}</h3>
      <p className="text-white/80 text-sm mb-1">{action}</p>
      <p className="text-white/50 text-xs">{detail}</p>
    </div>
  )
}

function Tip({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-gold leading-5" aria-hidden="true">→</span>
      <span className="text-white/75 leading-relaxed"><strong className="text-white font-semibold">{lead}</strong>{children}</span>
    </li>
  )
}

export default function HowToPage() {
  return (
    <div className="min-h-page text-white">
      <PageHeader title="About & How to Use" subtitle="Burrow · Version 1.0.0" width="max-w-3xl" />

      {/* Content */}
      <div className="px-4 py-8 max-w-3xl mx-auto space-y-10">

        {/* Why Burrow? */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <BurrowLogo className="w-10 h-10 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white">Why Burrow?</h2>
          </div>
          <div className="card shadow-card p-6 space-y-4">
            <p className="text-white text-lg leading-relaxed">
              Because a badger needs its burrow to collect its stuff.
            </p>
            <p className="text-white/75 leading-relaxed">
              When you're traveling for work, you've got flights, hotels, venues, client info, addresses, checklists—everything scattered everywhere. Emails. Texts. Calendar. Notes app. Screenshots.
            </p>
            <p className="text-white/75 leading-relaxed">
              Burrow is one place to keep it all. Everything for a job, organized and ready when you need it. Works offline. Syncs when you're back online.
            </p>
            <p className="text-white/75 leading-relaxed">
              Simple. Organized. Like a badger's burrow.
            </p>
          </div>
        </section>

        {/* Getting Started */}
        <section>
          <h2 className="eyebrow text-gold mb-3">Getting Started</h2>
          <div className="space-y-3">
            <Step
              title="Install to Home Screen"
              action={'Tap your browser\'s share button → "Add to Home Screen"'}
              detail="One tap access. Works like a native app."
            />
            <Step
              title="Navigation"
              action="Tap the badger at the bottom: Jobs | Calendar | Map | New"
              detail="Gold marks where you are. Tap the badger again to tuck it away."
            />
            <Step
              title="Menu"
              action="Top right on the Jobs page → profile, homebase time, and the rest"
              detail="Scan QR, Team Calendar, Weather, Prompt Creator, Tools, Flight Map, Quick Notes."
            />
            <Step
              title="Getting Back"
              action="Every page has a back arrow, top left"
              detail="The header stays put while you scroll."
            />
          </div>
        </section>

        {/* Managing Jobs */}
        <section>
          <h2 className="eyebrow text-gold mb-3">Managing Jobs</h2>
          <div className="space-y-3">
            <Step
              title="Create a Job"
              action={'Badger → "New" → New Job → Title, dates, location → Create Job'}
              detail="Job type (Caricatures or Personalization), client info, and everything else go in on the job page. Time Off lives under New too."
            />
            <Step
              title="Filter Jobs"
              action="All / My Jobs toggle + Completed Archive"
              detail="Find exactly what you need. Completed jobs stay out of the way until you open the archive."
            />
            <Step
              title="View & Edit"
              action="Tap any job card → Make changes → Auto-saves"
              detail="Save stays at the top if you want to be sure. A gold dot means unsaved changes. Weather, timezone, and map info update automatically."
            />
            <Step
              title="Read the Colors"
              action="Gold = the main action. Teal = tabs, toggles, and links."
              detail="Status pills: yellow pending, green confirmed, blue in progress."
            />
          </div>
        </section>

        {/* Quick Features */}
        <section>
          <h2 className="eyebrow text-gold mb-3">Quick Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {QUICK_FEATURES.map(feature => (
              <div key={feature.title} className="card p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold mb-1 text-sm">{feature.title}</h3>
                  <p className="text-white/60 text-xs leading-relaxed">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pro Tips */}
        <section>
          <h2 className="eyebrow text-gold mb-3">Pro Tips</h2>
          <div className="card p-5">
            <ul className="space-y-3 text-sm">
              <Tip lead="Use address autocomplete"> when creating jobs for accurate locations and automatic weather</Tip>
              <Tip lead="Add checklists"> for equipment, materials, or setup steps—check off as you go</Tip>
              <Tip lead="Add airport codes"> for travel jobs—keeps flight info organized</Tip>
              <Tip lead="Use notes freely">—client preferences, venue details, anything you need to remember</Tip>
              <Tip lead="Check Map view"> when planning travel—see where all your jobs are in relation to each other</Tip>
            </ul>
          </div>
        </section>

        {/* That's It */}
        <section>
          <div className="rounded-2xl border border-brand/40 bg-brand/10 p-6 text-center">
            <p className="font-display text-xl text-white font-semibold mb-2">
              Built for a badger.
            </p>
            <p className="text-white/65 text-sm">
              Everything organized. Everything ready. If you get lost, come back here.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
