'use client'

import { useRouter } from 'next/navigation'

export default function HowToPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] p-6 pb-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-4xl font-bold text-[#E8B44D] mb-2">How to Use Burrow</h1>
          <p className="text-white/80">Quick guide to get you started</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-3xl mx-auto pb-24 space-y-6">
        
        {/* Getting Started */}
        <section>
          <h2 className="text-2xl font-bold text-[#E8B44D] mb-4">Getting Started</h2>
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <h3 className="text-[#E8B44D] font-semibold mb-2">Install to Home Screen</h3>
              <p className="text-white/80 text-sm mb-2">Tap your browser's share button → "Add to Home Screen"</p>
              <p className="text-white/60 text-xs">One tap access. Works like a native app.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <h3 className="text-[#E8B44D] font-semibold mb-2">Navigation</h3>
              <p className="text-white/80 text-sm mb-2">Three icons at the bottom: Jobs | Map | New</p>
              <p className="text-white/60 text-xs">Menu button for profile, homebase time, and settings.</p>
            </div>
          </div>
        </section>

        {/* Managing Jobs */}
        <section>
          <h2 className="text-2xl font-bold text-[#E8B44D] mb-4">Managing Jobs</h2>
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <h3 className="text-[#E8B44D] font-semibold mb-2">Create a Job</h3>
              <p className="text-white/80 text-sm mb-2">Tap "New" button → Fill in details → Save</p>
              <p className="text-white/60 text-xs">Choose job type (Caricatures or Names/Monograms), add date, location, client info.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <h3 className="text-[#E8B44D] font-semibold mb-2">Filter Jobs</h3>
              <p className="text-white/80 text-sm mb-2">Team/My Jobs toggle + All/Current/Complete status</p>
              <p className="text-white/60 text-xs">Find exactly what you need. Current hides completed jobs.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <h3 className="text-[#E8B44D] font-semibold mb-2">View & Edit</h3>
              <p className="text-white/80 text-sm mb-2">Tap any job card → Make changes → Auto-saves</p>
              <p className="text-white/60 text-xs">Weather, timezone, and map info update automatically.</p>
            </div>
          </div>
        </section>

        {/* Quick Features */}
        <section>
          <h2 className="text-2xl font-bold text-[#E8B44D] mb-4">Quick Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-4 rounded-lg border border-[#E8B44D]/10">
              <svg className="w-6 h-6 mb-2 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <h3 className="text-[#E8B44D] font-semibold mb-1 text-sm">Auto-Sync</h3>
              <p className="text-white/70 text-xs">All changes sync to cloud automatically. Access from any device.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-4 rounded-lg border border-[#E8B44D]/10">
              <svg className="w-6 h-6 mb-2 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <h3 className="text-[#E8B44D] font-semibold mb-1 text-sm">Offline Mode</h3>
              <p className="text-white/70 text-xs">Works without internet. Changes sync when you reconnect.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-4 rounded-lg border border-[#E8B44D]/10">
              <svg className="w-6 h-6 mb-2 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <h3 className="text-[#E8B44D] font-semibold mb-1 text-sm">Weather</h3>
              <p className="text-white/70 text-xs">Auto weather forecast for every job location on event day.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-4 rounded-lg border border-[#E8B44D]/10">
              <svg className="w-6 h-6 mb-2 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <h3 className="text-[#E8B44D] font-semibold mb-1 text-sm">Map View</h3>
              <p className="text-white/70 text-xs">See all jobs on a map. Plan routes. Check distances.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-4 rounded-lg border border-[#E8B44D]/10">
              <svg className="w-6 h-6 mb-2 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-[#E8B44D] font-semibold mb-1 text-sm">Homebase Time</h3>
              <p className="text-white/70 text-xs">Menu shows San Diego time. Always know homebase hours.</p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-4 rounded-lg border border-[#E8B44D]/10">
              <svg className="w-6 h-6 mb-2 text-[#E8B44D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-[#E8B44D] font-semibold mb-1 text-sm">Team Sharing</h3>
              <p className="text-white/70 text-xs">Share jobs with team. Everyone sees updates in real-time.</p>
            </div>
          </div>
        </section>

        {/* Pro Tips */}
        <section>
          <h2 className="text-2xl font-bold text-[#E8B44D] mb-4">Pro Tips</h2>
          <div className="bg-gradient-to-br from-[#E8B44D]/10 to-[#2F5F7F]/10 p-5 rounded-xl border border-[#E8B44D]/20">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-[#E8B44D] text-lg">→</span>
                <span className="text-white/90"><strong className="text-[#E8B44D]">Use address autocomplete</strong> when creating jobs for accurate locations and automatic weather</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#E8B44D] text-lg">→</span>
                <span className="text-white/90"><strong className="text-[#E8B44D]">Add checklists</strong> for equipment, materials, or setup steps—check off as you go</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#E8B44D] text-lg">→</span>
                <span className="text-white/90"><strong className="text-[#E8B44D]">Add airport codes</strong> for travel jobs—keeps flight info organized</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#E8B44D] text-lg">→</span>
                <span className="text-white/90"><strong className="text-[#E8B44D]">Use notes freely</strong>—client preferences, venue details, anything you need to remember</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#E8B44D] text-lg">→</span>
                <span className="text-white/90"><strong className="text-[#E8B44D]">Check Map view</strong> when planning travel—see where all your jobs are in relation to each other</span>
              </li>
            </ul>
          </div>
        </section>

        {/* That's It */}
        <section>
          <div className="bg-gradient-to-r from-[#2F5F7F] to-[#3A6B86] p-6 rounded-xl text-center">
            <p className="text-xl text-white font-semibold mb-2">
              That's it. Simple and quick.
            </p>
            <p className="text-white/70 text-sm">
              If you get lost, come back here. Everything you need to know.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
