import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import { Fldr } from '@/types/fldr'

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #3b82f6',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    borderBottom: '1 solid #e5e5e5',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 120,
    fontWeight: 'bold',
    color: '#444',
  },
  value: {
    flex: 1,
    color: '#1a1a1a',
  },
  bulletList: {
    marginLeft: 15,
    marginTop: 5,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bulletPoint: {
    width: 15,
    color: '#3b82f6',
  },
  bulletText: {
    flex: 1,
    color: '#1a1a1a',
  },
  scheduleItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 10,
  },
  scheduleTime: {
    width: 100,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  scheduleDetails: {
    flex: 1,
    color: '#1a1a1a',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#999',
    borderTop: '1 solid #e5e5e5',
    paddingTop: 10,
  },
  contactCard: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  contactName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  contactDetail: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  weatherBox: {
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  weatherText: {
    fontSize: 10,
    color: '#1e40af',
    marginBottom: 3,
  },
  checklistItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 10,
  },
  checkbox: {
    width: 15,
    marginRight: 5,
    color: '#3b82f6',
  },
  checkboxText: {
    flex: 1,
    fontSize: 10,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: '#999',
  },
})

// Format date helpers
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Not set'
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return 'Not set'
  return new Date(dateStr).toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit'
  })
}

const formatDateRange = (start: string | null, end: string | null): string => {
  if (!start && !end) return 'Dates not set'
  if (!end || start === end) return formatDate(start)
  return `${formatDate(start)} - ${formatDate(end)}`
}

// Quick Overview PDF Document
const QuickOverviewDocument = ({ fldr }: { fldr: Fldr }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{fldr.title || 'Untitled Job'}</Text>
        <Text style={styles.subtitle}>Job Overview</Text>
        <Text style={styles.subtitle}>{formatDateRange(fldr.date_start, fldr.date_end)}</Text>
        {fldr.location && <Text style={styles.subtitle}>{fldr.location}</Text>}
      </View>

      {/* Venue Info */}
      {fldr.venue_info?.name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Venue</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactName}>{fldr.venue_info.name}</Text>
            {fldr.venue_info.address && (
              <Text style={styles.contactDetail}>{fldr.venue_info.address}</Text>
            )}
            {fldr.venue_info.contact_name && (
              <Text style={styles.contactDetail}>Contact: {fldr.venue_info.contact_name}</Text>
            )}
            {fldr.venue_info.contact_phone && (
              <Text style={styles.contactDetail}>Phone: {fldr.venue_info.contact_phone}</Text>
            )}
          </View>
        </View>
      )}

      {/* Client Info */}
      {fldr.job_info?.client_name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactName}>{fldr.job_info.client_name}</Text>
            {fldr.job_info.client_contact_name && (
              <Text style={styles.contactDetail}>Contact: {fldr.job_info.client_contact_name}</Text>
            )}
            {fldr.job_info.client_contact_phone && (
              <Text style={styles.contactDetail}>Phone: {fldr.job_info.client_contact_phone}</Text>
            )}
            {fldr.job_info.client_contact_email && (
              <Text style={styles.contactDetail}>Email: {fldr.job_info.client_contact_email}</Text>
            )}
          </View>
        </View>
      )}

      {/* Job Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Details</Text>
        {fldr.job_info?.job_title && (
          <View style={styles.row}>
            <Text style={styles.label}>Job Type:</Text>
            <Text style={styles.value}>{fldr.job_info.job_title}</Text>
          </View>
        )}
        {fldr.job_info?.item && (
          <View style={styles.row}>
            <Text style={styles.label}>Services:</Text>
            <Text style={styles.value}>{fldr.job_info.item}</Text>
          </View>
        )}
        {fldr.job_info?.quantity && (
          <View style={styles.row}>
            <Text style={styles.label}>Quantity:</Text>
            <Text style={styles.value}>{fldr.job_info.quantity}</Text>
          </View>
        )}
      </View>

      {/* Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        {fldr.job_info?.show_up_time && (
          <View style={styles.scheduleItem}>
            <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.show_up_time)}</Text>
            <Text style={styles.scheduleDetails}>Show Up Time</Text>
          </View>
        )}
        {fldr.job_info?.use_daily_schedule ? (
          <>
            {fldr.job_info.daily_start_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{fldr.job_info.daily_start_time}</Text>
                <Text style={styles.scheduleDetails}>Daily Start (each day)</Text>
              </View>
            )}
            {fldr.job_info.daily_end_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{fldr.job_info.daily_end_time}</Text>
                <Text style={styles.scheduleDetails}>Daily End (each day)</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {fldr.job_info?.job_start_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.job_start_time)}</Text>
                <Text style={styles.scheduleDetails}>Job Start</Text>
              </View>
            )}
            {fldr.job_info?.job_end_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.job_end_time)}</Text>
                <Text style={styles.scheduleDetails}>Job End</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Team */}
      {fldr.job_info?.team_members && fldr.job_info.team_members.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team</Text>
          <View style={styles.bulletList}>
            {fldr.job_info.team_members.map((member, idx) => (
              <View key={idx} style={styles.bullet}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{member}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Hotel */}
      {fldr.hotel_info?.name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hotel</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactName}>{fldr.hotel_info.name}</Text>
            {fldr.hotel_info.address && (
              <Text style={styles.contactDetail}>{fldr.hotel_info.address}</Text>
            )}
            {fldr.hotel_info.check_in && (
              <Text style={styles.contactDetail}>Check-in: {formatDate(fldr.hotel_info.check_in)}</Text>
            )}
            {fldr.hotel_info.check_out && (
              <Text style={styles.contactDetail}>Check-out: {formatDate(fldr.hotel_info.check_out)}</Text>
            )}
            {fldr.hotel_info.confirmation && (
              <Text style={styles.contactDetail}>Confirmation: {fldr.hotel_info.confirmation}</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text>Generated from GIT Job Tracker • {new Date().toLocaleDateString()}</Text>
      </View>
    </Page>
  </Document>
)

// Full Trip Brief PDF Document
const FullTripBriefDocument = ({ fldr }: { fldr: Fldr }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{fldr.title || 'Untitled Job'}</Text>
        <Text style={styles.subtitle}>Complete Trip Brief</Text>
        <Text style={styles.subtitle}>{formatDateRange(fldr.date_start, fldr.date_end)}</Text>
        {fldr.location && <Text style={styles.subtitle}>{fldr.location}</Text>}
      </View>

      {/* Flight Info */}
      {fldr.flight_info && fldr.flight_info.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flight Information</Text>
          {fldr.flight_info.map((segment, idx) => (
            <View key={idx} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: '#3b82f6' }}>
                {segment.segment_type === 'outbound' ? 'Outbound Flight' : 
                 segment.segment_type === 'return' ? 'Return Flight' : 
                 segment.segment_type === 'connection' ? 'Connection' : 'Flight'} 
                {segment.flight_number ? ` - ${segment.airline || ''} ${segment.flight_number}` : ''}
              </Text>
              {segment.departure_airport && (
                <View style={styles.row}>
                  <Text style={styles.label}>Departure:</Text>
                  <Text style={styles.value}>
                    {segment.departure_airport} ({segment.departure_code}) - {formatDateTime(segment.departure_time)}
                  </Text>
                </View>
              )}
              {segment.arrival_airport && (
                <View style={styles.row}>
                  <Text style={styles.label}>Arrival:</Text>
                  <Text style={styles.value}>
                    {segment.arrival_airport} ({segment.arrival_code}) - {formatDateTime(segment.arrival_time)}
                  </Text>
                </View>
              )}
              {segment.confirmation && (
                <View style={styles.row}>
                  <Text style={styles.label}>Confirmation:</Text>
                  <Text style={styles.value}>{segment.confirmation}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Hotel Info */}
      {fldr.hotel_info?.name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hotel Information</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactName}>{fldr.hotel_info.name}</Text>
            {fldr.hotel_info.address && (
              <Text style={styles.contactDetail}>{fldr.hotel_info.address}</Text>
            )}
            {fldr.hotel_info.phone && (
              <Text style={styles.contactDetail}>Phone: {fldr.hotel_info.phone}</Text>
            )}
            {fldr.hotel_info.check_in && (
              <Text style={styles.contactDetail}>Check-in: {formatDate(fldr.hotel_info.check_in)}</Text>
            )}
            {fldr.hotel_info.check_out && (
              <Text style={styles.contactDetail}>Check-out: {formatDate(fldr.hotel_info.check_out)}</Text>
            )}
            {fldr.hotel_info.confirmation && (
              <Text style={styles.contactDetail}>Confirmation: {fldr.hotel_info.confirmation}</Text>
            )}
          </View>
        </View>
      )}

      {/* Rental Car */}
      {fldr.rental_car_info?.company && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental Car</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Company:</Text>
            <Text style={styles.value}>{fldr.rental_car_info.company}</Text>
          </View>
          {fldr.rental_car_info.vehicle_type && (
            <View style={styles.row}>
              <Text style={styles.label}>Vehicle:</Text>
              <Text style={styles.value}>{fldr.rental_car_info.vehicle_type}</Text>
            </View>
          )}
          {fldr.rental_car_info.pickup_time && (
            <View style={styles.row}>
              <Text style={styles.label}>Pickup:</Text>
              <Text style={styles.value}>
                {formatDateTime(fldr.rental_car_info.pickup_time)}
                {fldr.rental_car_info.pickup_location && ` - ${fldr.rental_car_info.pickup_location}`}
              </Text>
            </View>
          )}
          {fldr.rental_car_info.dropoff_time && (
            <View style={styles.row}>
              <Text style={styles.label}>Dropoff:</Text>
              <Text style={styles.value}>
                {formatDateTime(fldr.rental_car_info.dropoff_time)}
                {fldr.rental_car_info.dropoff_location && ` - ${fldr.rental_car_info.dropoff_location}`}
              </Text>
            </View>
          )}
          {fldr.rental_car_info.confirmation && (
            <View style={styles.row}>
              <Text style={styles.label}>Confirmation:</Text>
              <Text style={styles.value}>{fldr.rental_car_info.confirmation}</Text>
            </View>
          )}
        </View>
      )}

      {/* Venue Info */}
      {fldr.venue_info?.name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Venue Information</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactName}>{fldr.venue_info.name}</Text>
            {fldr.venue_info.address && (
              <Text style={styles.contactDetail}>{fldr.venue_info.address}</Text>
            )}
            {fldr.venue_info.contact_name && (
              <Text style={styles.contactDetail}>Contact: {fldr.venue_info.contact_name}</Text>
            )}
            {fldr.venue_info.contact_phone && (
              <Text style={styles.contactDetail}>Phone: {fldr.venue_info.contact_phone}</Text>
            )}
          </View>
        </View>
      )}

      <Text style={styles.pageNumber} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
    </Page>

    {/* Page 2 - Job Details & Schedule */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Job Details & Schedule</Text>
      </View>

      {/* Client Info */}
      {fldr.job_info?.client_name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactName}>{fldr.job_info.client_name}</Text>
            {fldr.job_info.client_contact_name && (
              <Text style={styles.contactDetail}>Contact: {fldr.job_info.client_contact_name}</Text>
            )}
            {fldr.job_info.client_contact_phone && (
              <Text style={styles.contactDetail}>Phone: {fldr.job_info.client_contact_phone}</Text>
            )}
            {fldr.job_info.client_contact_email && (
              <Text style={styles.contactDetail}>Email: {fldr.job_info.client_contact_email}</Text>
            )}
          </View>
        </View>
      )}

      {/* Job Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Details</Text>
        {fldr.job_info?.job_title && (
          <View style={styles.row}>
            <Text style={styles.label}>Job Type:</Text>
            <Text style={styles.value}>{fldr.job_info.job_title}</Text>
          </View>
        )}
        {fldr.job_info?.item && (
          <View style={styles.row}>
            <Text style={styles.label}>Services:</Text>
            <Text style={styles.value}>{fldr.job_info.item}</Text>
          </View>
        )}
        {fldr.job_info?.quantity && (
          <View style={styles.row}>
            <Text style={styles.label}>Quantity:</Text>
            <Text style={styles.value}>{fldr.job_info.quantity}</Text>
          </View>
        )}
      </View>

      {/* Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        {fldr.job_info?.show_up_time && (
          <View style={styles.scheduleItem}>
            <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.show_up_time)}</Text>
            <Text style={styles.scheduleDetails}>Show Up Time</Text>
          </View>
        )}
        {fldr.job_info?.use_daily_schedule ? (
          <>
            <Text style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>Daily Schedule (repeats each day):</Text>
            {fldr.job_info.daily_start_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{fldr.job_info.daily_start_time}</Text>
                <Text style={styles.scheduleDetails}>Job Start</Text>
              </View>
            )}
            {fldr.job_info.daily_break_start && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{fldr.job_info.daily_break_start}</Text>
                <Text style={styles.scheduleDetails}>Break Start</Text>
              </View>
            )}
            {fldr.job_info.daily_break_end && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{fldr.job_info.daily_break_end}</Text>
                <Text style={styles.scheduleDetails}>Break End</Text>
              </View>
            )}
            {fldr.job_info.daily_end_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{fldr.job_info.daily_end_time}</Text>
                <Text style={styles.scheduleDetails}>Job End</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {fldr.job_info?.job_start_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.job_start_time)}</Text>
                <Text style={styles.scheduleDetails}>Job Start</Text>
              </View>
            )}
            {fldr.job_info?.break_start_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.break_start_time)}</Text>
                <Text style={styles.scheduleDetails}>Break Start</Text>
              </View>
            )}
            {fldr.job_info?.break_end_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.break_end_time)}</Text>
                <Text style={styles.scheduleDetails}>Break End</Text>
              </View>
            )}
            {fldr.job_info?.job_end_time && (
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleTime}>{formatTime(fldr.job_info.job_end_time)}</Text>
                <Text style={styles.scheduleDetails}>Job End</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Team */}
      {fldr.job_info?.team_members && fldr.job_info.team_members.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Members</Text>
          <View style={styles.bulletList}>
            {fldr.job_info.team_members.map((member, idx) => (
              <View key={idx} style={styles.bullet}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{member}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Checklist */}
      {fldr.checklist && fldr.checklist.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          {fldr.checklist.map((item, idx) => (
            <View key={idx} style={styles.checklistItem}>
              <Text style={styles.checkbox}>[ ]</Text>
              <Text style={styles.checkboxText}>{item.item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* People/Contacts */}
      {fldr.people && fldr.people.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacts</Text>
          {fldr.people.map((person, idx) => (
            <View key={idx} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>{person.name}</Text>
              {person.role && <Text style={{ fontSize: 9, color: '#666' }}>{person.role}</Text>}
              {person.phone && <Text style={{ fontSize: 9, color: '#666' }}>Phone: {person.phone}</Text>}
              {person.email && <Text style={{ fontSize: 9, color: '#666' }}>Email: {person.email}</Text>}
            </View>
          ))}
        </View>
      )}

      <Text style={styles.pageNumber} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
      <View style={styles.footer}>
        <Text>Generated from GIT Job Tracker • {new Date().toLocaleDateString()}</Text>
      </View>
    </Page>
  </Document>
)

// Generate and download Quick Overview PDF
export const generateQuickOverviewPDF = async (fldr: Fldr) => {
  const blob = await pdf(<QuickOverviewDocument fldr={fldr} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fldr.title || 'Job'} - Quick Overview.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

// Generate and download Full Trip Brief PDF
export const generateFullTripBriefPDF = async (fldr: Fldr) => {
  const blob = await pdf(<FullTripBriefDocument fldr={fldr} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fldr.title || 'Job'} - Full Trip Brief.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

// Share PDF via Web Share API (mobile-friendly)
export const shareQuickOverviewPDF = async (fldr: Fldr) => {
  const blob = await pdf(<QuickOverviewDocument fldr={fldr} />).toBlob()
  const file = new File([blob], `${fldr.title || 'Job'} - Quick Overview.pdf`, { type: 'application/pdf' })
  
  if (navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${fldr.title} - Quick Overview`,
        text: 'Job overview from GIT Job Tracker'
      })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error)
        // Fallback to download
        await generateQuickOverviewPDF(fldr)
      }
    }
  } else {
    // Fallback to download if share not supported
    await generateQuickOverviewPDF(fldr)
  }
}

export const shareFullTripBriefPDF = async (fldr: Fldr) => {
  const blob = await pdf(<FullTripBriefDocument fldr={fldr} />).toBlob()
  const file = new File([blob], `${fldr.title || 'Job'} - Full Trip Brief.pdf`, { type: 'application/pdf' })
  
  if (navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${fldr.title} - Full Trip Brief`,
        text: 'Complete trip brief from GIT Job Tracker'
      })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error)
        // Fallback to download
        await generateFullTripBriefPDF(fldr)
      }
    }
  } else {
    // Fallback to download if share not supported
    await generateFullTripBriefPDF(fldr)
  }
}
