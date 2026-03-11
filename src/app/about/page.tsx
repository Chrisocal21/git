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
        
        {/* Why Burrow? */}
        <section>
          <h2 className="text-2xl font-bold text-[#E8B44D] mb-4">Why Burrow?</h2>
          <div className="bg-gradient-to-br from-[#2F5F7F]/20 to-[#1a3a4d]/20 p-6 rounded-xl border border-[#E8B44D]/10 space-y-4">
            <p className="text-white/90 text-lg leading-relaxed">
              Because a badger needs its burrow to collect its stuff.
            </p>
            <p className="text-white/90 leading-relaxed">
              When you're traveling for work, you've got flights, hotels, venues, client info, addresses, checklists—everything scattered everywhere. Emails. Texts. Calendar. Notes app. Screenshots.
            </p>
            <p className="text-white/90 leading-relaxed">
              Burrow is one place to keep it all. Everything for a job, organized and ready when you need it. Works offline. Syncs when you're back online.
            </p>
            <p className="text-white/80 leading-relaxed">
              Simple. Organized. Like a badger's burrow.
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
              Everything organized. Everything ready.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
