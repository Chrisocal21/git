'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderIcon, PencilIcon, CogIcon, MapIcon } from './Icons'

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname?.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#2a2a2a]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        <Link
          href="/fldr"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/fldr')
              ? 'text-[#3b82f6]'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FolderIcon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Fldr</span>
        </Link>

        <Link
          href="/write"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/write')
              ? 'text-[#3b82f6]'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <PencilIcon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Write</span>
        </Link>

        <Link
          href="/map"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/map')
              ? 'text-[#3b82f6]'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <MapIcon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Map</span>
        </Link>

        <Link
          href="/prod"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/prod')
              ? 'text-[#3b82f6]'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <CogIcon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Prod</span>
        </Link>
      </div>
    </nav>
  )
}
