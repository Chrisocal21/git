import { NextRequest, NextResponse } from 'next/server'
import { queryD1 } from '@/lib/d1'

const D1_ENABLED = process.env.D1_ENABLED === 'true'

export async function GET(request: NextRequest) {
  if (!D1_ENABLED) {
    return NextResponse.json({ error: 'D1 not enabled' }, { status: 400 })
  }

  try {
    // Test 1: List all tables
    const tables = await queryD1(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `)

    // Test 2: Check if fldrs table exists and get schema
    let fldrSchema = null
    try {
      fldrSchema = await queryD1(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='fldrs'
      `)
    } catch (e) {
      fldrSchema = { error: 'Table does not exist' }
    }

    // Test 3: Count rows in fldrs table
    let rowCount = null
    try {
      const result = await queryD1('SELECT COUNT(*) as count FROM fldrs')
      rowCount = result[0]?.count || 0
    } catch (e) {
      rowCount = { error: String(e) }
    }

    // Test 4: Try a simple insert and delete
    let insertTest = null
    try {
      const testId = 'test-' + Date.now()
      await queryD1(
        'INSERT INTO fldrs (id, data) VALUES (?, ?)',
        [testId, JSON.stringify({ id: testId, test: true })]
      )
      await queryD1('DELETE FROM fldrs WHERE id = ?', [testId])
      insertTest = { success: true, message: 'Insert/delete test passed' }
    } catch (e) {
      insertTest = { success: false, error: String(e) }
    }

    return NextResponse.json({
      d1Enabled: D1_ENABLED,
      allTables: tables,
      fldrTableSchema: fldrSchema,
      fldrRowCount: rowCount,
      insertDeleteTest: insertTest,
    })
  } catch (error) {
    console.error('D1 test error:', error)
    return NextResponse.json(
      { 
        error: 'D1 test failed', 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
