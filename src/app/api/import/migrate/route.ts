import { NextResponse } from 'next/server';
import { fetchOldTrips, fetchTripBlocks, fetchTripTodos, fetchTripPackingItems, fetchTripExpenses } from '@/lib/d1';
import { Fldr, ChecklistItem } from '@/types/fldr';

/**
 * POST /api/import/migrate
 * Migrate old trips to new Fldr format
 */
export async function POST(request: Request) {
  try {
    const { tripIds } = await request.json();
    
    if (!Array.isArray(tripIds) || tripIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No trip IDs provided' },
        { status: 400 }
      );
    }

    const allTrips = await fetchOldTrips();
    const selectedTrips = allTrips.filter((trip: any) => tripIds.includes(trip.id));
    
    const migratedFldrs: Fldr[] = [];

    for (const trip of selectedTrips) {
      // Fetch related data
      const blocks = await fetchTripBlocks(trip.id);
      const todos = await fetchTripTodos(trip.id);
      const packingItems = await fetchTripPackingItems(trip.id);
      const expenses = await fetchTripExpenses(trip.id);

      // Build notes header with trip metadata
      let fullNotes = '';
      
      // Add trip info header
      if (trip.timezone) {
        fullNotes += `**Timezone:** ${trip.timezone}\n\n`;
      }
      
      if (trip.latitude && trip.longitude) {
        fullNotes += `**Coordinates:** ${trip.latitude}, ${trip.longitude}\n\n`;
      }

      // Convert blocks to notes text
      const notesText = blocks
        .map((block: any) => {
          // Try different possible field names for block content
          return block.content || block.text || block.note || block.body || '';
        })
        .filter(Boolean)
        .join('\n\n');
      
      if (notesText) {
        fullNotes += notesText;
      }

      // Convert todos AND packing items to checklist
      const todoItems: ChecklistItem[] = todos.map((todo: any) => ({
        item: todo.text || todo.title || todo.task || '',
        completed: todo.completed || todo.checked || todo.done || false,
      }));

      const packingChecklistItems: ChecklistItem[] = packingItems.map((item: any) => ({
        item: `📦 ${item.name || item.item || item.text || ''}`,
        completed: item.packed || item.completed || item.checked || false,
      }));

      const checklist = [...todoItems, ...packingChecklistItems].filter(item => item.item);

      // Add expenses to notes if they exist
      if (expenses.length > 0) {
        const expenseText = '\n\n---\n**Expenses:**\n' + expenses
          .map((exp: any) => {
            const amount = exp.amount || exp.cost || 0;
            const desc = exp.description || exp.note || exp.item || 'Expense';
            return `- ${desc}: $${amount}`;
          })
          .join('\n');
        fullNotes += expenseText;
      }
      
      // Add any additional trip data to notes
      if (trip.hotelName || trip.hotelAddress || trip.onsite || trip.contact || trip.phone || trip.email) {
        fullNotes += '\n\n---\n**Trip Details:**\n';
        if (trip.hotelName) fullNotes += `\n**Hotel:** ${trip.hotelName}`;
        if (trip.hotelAddress) fullNotes += `\n**Address:** ${trip.hotelAddress}`;
        if (trip.onsite) fullNotes += `\n**Onsite:** ${trip.onsite}`;
        if (trip.contact) fullNotes += `\n**Contact:** ${trip.contact}`;
        if (trip.phone) fullNotes += `\n**Phone:** ${trip.phone}`;
        if (trip.email) fullNotes += `\n**Email:** ${trip.email}`;
      }

      // Determine status based on dates
      const now = new Date();
      const startDate = trip.startDate ? new Date(trip.startDate) : null;
      const endDate = trip.endDate ? new Date(trip.endDate) : (startDate || new Date());
      const isPast = endDate < now;
      const isUpcoming = startDate && startDate > now;
      
      let status: 'incomplete' | 'ready' | 'active' | 'complete' = 'complete';
      if (!isPast) {
        // Job is in the future
        if (isUpcoming || trip.status === 'upcoming') {
          status = 'ready'; // Not started yet
        } else if (trip.status === 'active') {
          status = 'active'; // Already in progress
        } else {
          status = 'ready'; // Default for future jobs
        }
      }

      // Create new Fldr from old trip
      const newFldr: Fldr = {
        id: `migrated-${trip.id}`,
        title: trip.name || 'Untitled',
        location: trip.destination || '',
        date_start: trip.startDate || null,
        date_end: trip.endDate || null,
        status,
        notes: notesText || '',
        quick_reference: null,
        checklist: checklist.length > 0 ? checklist : null,
        people: null,
        photos: null,
        products: null,
        job_info: null,
        wrap_up: null,
        polished_messages: [],
        created_at: trip.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      migratedFldrs.push(newFldr);
    }

    return NextResponse.json({
      success: true,
      fldrs: migratedFldrs,
      count: migratedFldrs.length,
    });
  } catch (error: any) {
    console.error('Error migrating trips:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to migrate trips',
      },
      { status: 500 }
    );
  }
}
