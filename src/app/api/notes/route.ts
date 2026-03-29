import { NextRequest, NextResponse } from 'next/server'
import { queryD1 } from '@/lib/d1'

const NOTES_KEY = '__quick_notes__'

const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
const D1_ENABLED = process.env.D1_ENABLED === 'true'

export async function GET() {
  if (!D1_ENABLED || !useD1) {
    return NextResponse.json({ notes: [] })
  }
  try {
    const rows = await queryD1('SELECT data FROM fldrs WHERE id = ?', [NOTES_KEY])
    if (!rows.length) return NextResponse.json({ notes: [] })
    const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
    return NextResponse.json({ notes: data.notes || [] })
  } catch (e) {
    console.error('[notes] GET error:', e)
    return NextResponse.json({ notes: [] })
  }
}

export async function POST(req: NextRequest) {
  if (!D1_ENABLED || !useD1) {
    return NextResponse.json({ ok: true, cloud: false })
  }
  try {
    const { notes } = await req.json()
    const data = JSON.stringify({ notes })
    await queryD1(
      `INSERT OR REPLACE INTO fldrs (id, data, updated_at) VALUES (?, ?, unixepoch())`,
      [NOTES_KEY, data]
    )
    return NextResponse.json({ ok: true, cloud: true })
  } catch (e) {
    console.error('[notes] POST error:', e)
    return NextResponse.json({ ok: false, cloud: false }, { status: 500 })
  }
}
