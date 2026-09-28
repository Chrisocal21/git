'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// About was merged into the How to Use page — redirect any old links there.
export default function AboutRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/how-to')
  }, [router])

  return null
}
