import { NextResponse } from 'next/server';
import { fetchOldTrips, fetchTripBlocks, fetchTripTodos } from '@/lib/d1';

/**
 * GET /api/import/trips
 * Fetch all trips from old TripFldr database
 */
export async function GET() {
  try {
    const trips = await fetchOldTrips();
    
    // Return trips with basic info
    return NextResponse.json({
      success: true,
      trips: trips.map((trip: any) => ({
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: trip.status,
        color: trip.color,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching trips:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch trips',
      },
      { status: 500 }
    );
  }
}
