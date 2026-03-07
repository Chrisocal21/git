'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to Jobs page on app open
    router.push('/jobs')
  }, [router])

  return null
}
