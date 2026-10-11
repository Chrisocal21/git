'use client';

import PageHeader from '@/components/PageHeader'
import { askConfirm, toast } from '@/components/Dialogs'
import { getSyncQueue } from '@/lib/offlineStorage'

export default function CloudSettingsPage() {
  const handleClearCache = async () => {
    const unsent = getSyncQueue().length
    const confirmed = await askConfirm({
      title: 'Clear saved copies of jobs?',
      body:
        'The jobs saved on this device are removed and loaded fresh from the cloud next time. You stay signed in, and your profile and Quick Notes stay.' +
        (unsent > 0 ? `\n\n${unsent} ${unsent === 1 ? 'change that has' : 'changes that have'} not reached the cloud yet will be kept and sent.` : ''),
      confirmLabel: 'Clear',
      tone: 'danger',
    })
    if (!confirmed) return
    // Only the copies of jobs go. Sign-in, profiles, notes and anything waiting to be sent are left alone.
    Object.keys(localStorage)
      .filter(key => key === 'git-fldrs' || key.startsWith('git_offline_fldrs'))
      .forEach(key => localStorage.removeItem(key))
    toast('Cleared. Jobs load fresh from the cloud the next time you open them.')
  }

  return (
    <div className="min-h-page text-white">
      <PageHeader title="Cloud Settings" subtitle="Advanced admin tools" width="max-w-md" />

      <div className="px-4 py-6 max-w-md mx-auto">
      <div className="space-y-3">
        <a
          href="/import"
          className="card shadow-card flex min-h-[2.75rem] items-center justify-between gap-3 p-4 hover:bg-surface-raised hover:border-line-strong transition-colors"
        >
          <div>
            <div className="font-semibold text-base mb-1">Import History</div>
            <div className="text-[15px] leading-relaxed text-white/55">
              Bring trips from the old TripFldr app into Burrow as jobs
            </div>
          </div>
          <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>

        {/* Migrate to D1 moved each phone's saved jobs up to the cloud when the cloud was new. It's retired. */}
        <div className="card shadow-card p-4">
          <div className="font-semibold text-base mb-1">Migrate to D1</div>
          <div className="text-[15px] leading-relaxed text-white/55">
            Retired. This moved the jobs saved on a phone up to the cloud, back when the cloud was new. Jobs save there by themselves now, and running it again could put an old copy from one phone over newer work.
          </div>
        </div>

        <div className="card shadow-card p-4">
          <div className="font-semibold text-base mb-1">Clear Cache</div>
          <div className="text-[15px] leading-relaxed text-white/55 mb-3">
            Remove the copies of jobs saved on this device. Sign-in, profiles and unsent changes are kept.
          </div>
          <button
            onClick={handleClearCache}
            className="btn-danger min-h-[2.75rem]"
          >
            Clear All Cache
          </button>
        </div>
      </div>

      <div className="mt-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/25 rounded-xl">
        <div className="text-[13px] text-yellow-300">
          WARNING: This page is only accessible via direct URL
        </div>
      </div>
      </div>
    </div>
  )
}
