'use client'

import { useRouter } from 'next/navigation'

export default function AboutPage() {
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
          
          {/* Logo */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-[#2F5F7F] rounded-2xl flex items-center justify-center shadow-xl border-2 border-[#E8B44D]/20">
              <span className="text-4xl font-serif text-[#E8B44D]" style={{ fontFamily: 'Georgia, serif' }}>B</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-[#E8B44D]">Burrow</h1>
              <p className="text-white/70 text-sm">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-3xl mx-auto pb-24 space-y-6">
        
        {/* Main Story */}
        <section>
          <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-6 rounded-xl border border-[#E8B44D]/10 space-y-4">
            <p className="text-white/90 text-lg leading-relaxed">
              I made this for myself because I was drowning in information.
            </p>
            <p className="text-white/90 leading-relaxed">
              Every job meant emails, texts, calendar events, booking confirmations, client details, venue addresses, equipment lists, weather checks—scattered across a dozen places. The world moves fast. Things overlap. Things get missed. Things get mixed up.
            </p>
            <p className="text-white/90 leading-relaxed">
              I needed one place where I could dump everything, find it instantly, and make sense of it without needing WiFi or digging through my email at baggage claim.
            </p>
            <p className="text-white/80 leading-relaxed">
              So I built Burrow. Like a badger organizing its den—everything has a place, everything's within reach.
            </p>
          </div>
        </section>

        {/* What It Does */}
        <section>
          <h2 className="text-xl font-bold text-[#E8B44D] mb-3">What It Does</h2>
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <p className="text-white/90 text-sm leading-relaxed">
                <strong className="text-[#E8B44D]">One tap from my home screen.</strong> PWA installed on my phone. No opening Safari, no typing URLs. Just tap and everything's there.
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <p className="text-white/90 text-sm leading-relaxed">
                <strong className="text-[#E8B44D]">All job info in one spot.</strong> Date, time, venue, client, contacts, flights, hotels, notes, checklists. No hunting. No switching apps.
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <p className="text-white/90 text-sm leading-relaxed">
                <strong className="text-[#E8B44D]">Works offline.</strong> On a plane, in a venue with no signal—doesn't matter. Everything's cached. Changes sync when I'm back online.
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <p className="text-white/90 text-sm leading-relaxed">
                <strong className="text-[#E8B44D]">Quick checks.</strong> Weather at the venue. What time is it there. How do I get there. What do I need to pack. All the stuff I'd be googling anyway.
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <p className="text-white/90 text-sm leading-relaxed">
                <strong className="text-[#E8B44D]">Clean PDFs.</strong> Parse all the chaos into a readable itinerary. Send to the team. Everyone's on the same page. No more "wait, what's the address again?"
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 p-4 rounded-lg">
              <p className="text-white/90 text-sm leading-relaxed">
                <strong className="text-[#E8B44D]">Team access.</strong> Share jobs with the crew. Everyone sees updates. No more forwarding emails or screenshotting texts.
              </p>
            </div>
          </div>
        </section>

        {/* Why It Matters */}
        <section>
          <h2 className="text-xl font-bold text-[#E8B44D] mb-3">Why It Matters</h2>
          <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-5 rounded-xl border border-[#E8B44D]/10">
            <p className="text-white/90 leading-relaxed mb-3">
              I didn't have enough mental capacity to keep track of everything while traveling for Swanky events. Too much intake, not enough time to process. I'd miss details or mix up jobs.
            </p>
            <p className="text-white/90 leading-relaxed mb-3">
              This keeps me aligned. Keeps my team aligned. We show up prepared. We look professional. We don't miss shit.
            </p>
            <p className="text-white/80 leading-relaxed italic">
              It's not fancy. It's just what I needed. If you're managing events and feeling scattered, you probably need it too.
            </p>
          </div>
        </section>

        {/* Bottom Line */}
        <section>
          <div className="bg-gradient-to-r from-[#2F5F7F] to-[#3A6B86] p-6 rounded-xl text-center">
            <p className="text-xl text-white font-semibold mb-2">
              Built for a badger.
            </p>
            <p className="text-white/80 text-sm">
              Everything organized. Everything reachable. One burrow for all your jobs.
            </p>
          </div>
        </section>

        {/* Footer */}
        <section className="text-center pt-6">
          <div className="text-white/40 text-sm">
            <p>v1.0.0</p>
          </div>
        </section>

      </div>
    </div>
  )
}
