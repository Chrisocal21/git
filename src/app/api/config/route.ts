import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const config = {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID?.slice(0, 8) + '...',
    CLOUDFLARE_DATABASE_ID: process.env.CLOUDFLARE_DATABASE_ID?.slice(0, 8) + '...',
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN ? '***SET***' : 'NOT SET',
    D1_ENABLED: process.env.D1_ENABLED,
    D1_ENABLED_PARSED: process.env.D1_ENABLED === 'true',
  }
  
  return NextResponse.json(config)
}
