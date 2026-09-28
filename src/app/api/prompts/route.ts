import { NextRequest, NextResponse } from 'next/server'
import { queryD1, isD1Enabled } from '@/lib/d1'

const PROMPTS_KEY = '__base_prompts__'

const D1_ACTIVE = isD1Enabled()

export interface BasePromptSet {
  id: string
  label: string
  prompt1: string
  prompt2: string
  createdAt: string
}

export async function GET() {
  if (!D1_ACTIVE) {
    return NextResponse.json({ prompts: [] })
  }
  try {
    const rows = await queryD1('SELECT data FROM fldrs WHERE id = ?', [PROMPTS_KEY])
    if (!rows.length) return NextResponse.json({ prompts: [] })
    const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
    return NextResponse.json({ prompts: data.prompts || [] })
  } catch (e) {
    console.error('[prompts] GET error:', e)
    return NextResponse.json({ prompts: [] })
  }
}

export async function POST(req: NextRequest) {
  if (!D1_ACTIVE) {
    return NextResponse.json({ ok: true, cloud: false })
  }
  try {
    const { prompts } = await req.json()
    const data = JSON.stringify({ prompts })
    await queryD1(
      `INSERT OR REPLACE INTO fldrs (id, data, updated_at) VALUES (?, ?, unixepoch())`,
      [PROMPTS_KEY, data]
    )
    return NextResponse.json({ ok: true, cloud: true })
  } catch (e) {
    console.error('[prompts] POST error:', e)
    return NextResponse.json({ ok: false, cloud: false }, { status: 500 })
  }
}
