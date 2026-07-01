'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderIcon, CloudIcon, MapIcon } from './Icons'

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname?.startsWith(path)
  }

  return (
    <nav className="fixed bottom-6 left-0 right-0 pointer-events-none">
      <div className="flex justify-center items-center gap-6 max-w-lg mx-auto px-4">
        <Link
          href="/jobs"
          className={`pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-lg backdrop-blur-sm ${
            isActive('/jobs')
              ? 'bg-[#E8B44D] text-black'
              : 'bg-[#1a1a1a]/80 text-gray-400 hover:text-gray-300 hover:bg-[#2a2a2a]/80'
          }`}
        >
          <FolderIcon className="w-6 h-6" />
        </Link>

        <Link
          href="/weather"
          className={`pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-lg backdrop-blur-sm ${
            isActive('/weather')
              ? 'bg-[#E8B44D] text-black'
              : 'bg-[#1a1a1a]/80 text-gray-400 hover:text-gray-300 hover:bg-[#2a2a2a]/80'
          }`}
        >
          <CloudIcon className="w-6 h-6" />
        </Link>

        <Link
          href="/map"
          className={`pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-lg backdrop-blur-sm ${
            isActive('/map')
              ? 'bg-[#E8B44D] text-black'
              : 'bg-[#1a1a1a]/80 text-gray-400 hover:text-gray-300 hover:bg-[#2a2a2a]/80'
          }`}
        >
          <MapIcon className="w-6 h-6" />
        </Link>
      </div>
    </nav>
  )
}
