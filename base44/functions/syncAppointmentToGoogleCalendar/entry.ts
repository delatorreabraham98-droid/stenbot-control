import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appointment } = await req.json();
    if (!appointment) {
      return Response.json({ error: 'Missing appointment' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const event = {
      summary: appointment.title,
      description: `${appointment.notes || ''}\n\nCliente: ${appointment.customer_name || '—'}\nTeléfono: ${appointment.customer_phone || '—'}`,
      start: {
        dateTime: appointment.start_time,
        timeZone: 'America/Tijuana'
      },
      end: {
        dateTime: appointment.end_time,
        timeZone: 'America/Tijuana'
      },
      location: appointment.location || undefined,
      organizer: {
        email: 'noreply@stenbot.com'
      }
    };

    const url = appointment.google_calendar_event_id
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointment.google_calendar_event_id}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const method = appointment.google_calendar_event_id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!res.ok) {
      const error = await res.text();
      return Response.json({ error: `Google Calendar API error: ${error}` }, { status: res.status });
    }

    const calendarEvent = await res.json();
    
    // Save Google Calendar event ID back to appointment
    if (!appointment.google_calendar_event_id && calendarEvent.id) {
      await base44.asServiceRole.entities.Appointment.update(appointment.id, {
        google_calendar_event_id: calendarEvent.id
      });
    }

    return Response.json({ success: true, eventId: calendarEvent.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});