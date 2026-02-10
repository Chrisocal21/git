'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to Fldr mode on app open
    router.push('/fldr')
  }, [router])

  return null
}
