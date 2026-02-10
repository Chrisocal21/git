/**
 * Cloudflare D1 Client
 * Connects to old TripFldr database for history migration
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

interface D1QueryResult {
  success: boolean;
  errors: any[];
  messages: any[];
  result: Array<{
    results: any[];
    success: boolean;
    meta: {
      duration: number;
      rows_read: number;
      rows_written: number;
    };
  }>;
}

/**
 * Execute a SQL query against the D1 database
 */
export async function queryD1(sql: string, params: any[] = []): Promise<any[]> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare D1 credentials not configured');
  }

  // For now, we'll use direct SQL queries via the Cloudflare API
  // This requires an API token which the user will need to provide
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`D1 query failed: ${error}`);
    }

    const data: D1QueryResult = await response.json();
    
    if (!data.success) {
      throw new Error('D1 query returned unsuccessful');
    }

    // D1 API returns results nested in result[0].results
    return data.result?.[0]?.results || [];
  } catch (error) {
    console.error('D1 query error:', error);
    throw error;
  }
}

/**
 * Fetch all trips from old TripFldr database
 */
export async function fetchOldTrips() {
  const results = await queryD1('SELECT id, data FROM trips ORDER BY json_extract(data, "$.createdAt") DESC');
  return results.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return { id: row.id, ...data };
  });
}

/**
 * Fetch blocks (notes) for a specific trip
 */
export async function fetchTripBlocks(tripId: string) {
  const results = await queryD1('SELECT id, trip_id, data FROM blocks WHERE trip_id = ?', [tripId]);
  return results.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return { id: row.id, trip_id: row.trip_id, ...data };
  });
}

/**
 * Fetch todos for a specific trip
 */
export async function fetchTripTodos(tripId: string) {
  const results = await queryD1('SELECT id, trip_id, data FROM todos WHERE trip_id = ?', [tripId]);
  return results.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return { id: row.id, trip_id: row.trip_id, ...data };
  });
}

/**
 * Fetch packing items for a specific trip
 */
export async function fetchTripPackingItems(tripId: string) {
  const results = await queryD1('SELECT id, trip_id, data FROM packing_items WHERE trip_id = ?', [tripId]);
  return results.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return { id: row.id, trip_id: row.trip_id, ...data };
  });
}

/**
 * Fetch expenses for a specific trip
 */
export async function fetchTripExpenses(tripId: string) {
  const results = await queryD1('SELECT id, trip_id, data FROM expenses WHERE trip_id = ?', [tripId]);
  return results.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return { id: row.id, trip_id: row.trip_id, ...data };
  });
}

/**
 * ===========================
 * NEW FLDRS STORAGE FUNCTIONS
 * ===========================
 */

import { Fldr } from '@/types/fldr'

/**
 * Fetch all fldrs from the database
 */
export async function getAllFldrs(): Promise<Fldr[]> {
  const results = await queryD1('SELECT id, data FROM fldrs ORDER BY updated_at DESC');
  return results.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return data as Fldr;
  });
}

/**
 * Fetch a single fldr by ID
 */
export async function getFldrById(id: string): Promise<Fldr | null> {
  const results = await queryD1('SELECT id, data FROM fldrs WHERE id = ?', [id]);
  if (results.length === 0) return null;
  const data = typeof results[0].data === 'string' ? JSON.parse(results[0].data) : results[0].data;
  return data as Fldr;
}

/**
 * Create a new fldr
 */
export async function createFldr(fldr: Fldr): Promise<Fldr> {
  const data = JSON.stringify(fldr);
  await queryD1('INSERT INTO fldrs (id, data) VALUES (?, ?)', [fldr.id, data]);
  return fldr;
}

/**
 * Update an existing fldr
 */
export async function updateFldr(id: string, updates: Partial<Fldr>): Promise<Fldr | null> {
  // First, get the existing fldr
  const existing = await getFldrById(id);
  if (!existing) return null;
  
  // Merge updates
  const updated = { ...existing, ...updates };
  const data = JSON.stringify(updated);
  
  // Update in database with current timestamp
  await queryD1(
    'UPDATE fldrs SET data = ?, updated_at = unixepoch() WHERE id = ?',
    [data, id]
  );
  
  return updated;
}

/**
 * Delete a fldr
 */
export async function deleteFldr(id: string): Promise<boolean> {
  const results = await queryD1('DELETE FROM fldrs WHERE id = ?', [id]);
  // Check if any rows were affected
  return true; // D1 doesn't return affected rows in REST API
}
