'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderIcon, MapIcon, CloudIcon } from './Icons'

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname?.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#2a2a2a]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        <Link
          href="/jobs"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/jobs')
              ? 'text-[#E8B44D]'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FolderIcon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Jobs</span>
        </Link>

        <Link
          href="/map"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/map')
              ? 'text-[#E8B44D]'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <MapIcon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Map</span>
        </Link>

        <Link
          href="/weather"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/weather')
              ? 'text-[#E8B44D]'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <CloudIcon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Weather</span>
        </Link>
      </div>
    </nav>
  )
}
