import ical, { type VEvent, type Attendee, type Organizer, type ParameterValue } from 'node-ical';

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: string;    // ISO date string
  end: string;      // ISO date string
  location?: string;
  organizer?: string;
  attendees: { name?: string; email: string; status?: string }[];
  status?: string;  // CONFIRMED, TENTATIVE, CANCELLED
  icalUid: string;  // iCal UID
  sourceEmailUid: number;
  sourceEmailSubject: string;
}

/**
 * Extract the plain string value from a node-ical ParameterValue,
 * which can be either a bare string or an object with { val, params }.
 */
function extractParameterValue(pv: ParameterValue | undefined): string | undefined {
  if (pv === undefined || pv === null) return undefined;
  if (typeof pv === 'string') return pv;
  if (typeof pv === 'object' && 'val' in pv) return String(pv.val);
  return String(pv);
}

/**
 * Extract organizer display string from a node-ical Organizer value.
 * The organizer can be a plain string like "mailto:user@example.com"
 * or an object with { val, params: { CN } }.
 */
function extractOrganizer(organizer: Organizer | undefined): string | undefined {
  if (!organizer) return undefined;

  if (typeof organizer === 'string') {
    return organizer.replace(/^mailto:/i, '');
  }

  if (typeof organizer === 'object' && 'val' in organizer) {
    const email = String(organizer.val).replace(/^mailto:/i, '');
    const cn = organizer.params?.CN;
    if (cn) return `${cn} <${email}>`;
    return email;
  }

  return String(organizer);
}

/**
 * Extract attendee list from a node-ical Attendee field.
 * The attendee field can be undefined, a single Attendee, or an array of Attendees.
 * Each Attendee is a ParameterValue: either a string "mailto:..." or
 * an object with { val: "mailto:...", params: { CN, PARTSTAT } }.
 */
function extractAttendees(
  attendee: Attendee[] | Attendee | undefined
): { name?: string; email: string; status?: string }[] {
  if (!attendee) return [];

  const attendees = Array.isArray(attendee) ? attendee : [attendee];
  const result: { name?: string; email: string; status?: string }[] = [];

  for (const att of attendees) {
    if (typeof att === 'string') {
      result.push({ email: att.replace(/^mailto:/i, '') });
    } else if (typeof att === 'object' && 'val' in att) {
      const email = String(att.val).replace(/^mailto:/i, '');
      const name = att.params?.CN ? String(att.params.CN) : undefined;
      const status = att.params?.PARTSTAT ? String(att.params.PARTSTAT) : undefined;
      result.push({ name, email, status });
    }
  }

  return result;
}

/**
 * Convert a Date, DateWithTimeZone, or string to an ISO date string.
 * Returns empty string if the value is falsy.
 */
function toISOString(date: Date | string | undefined | null): string {
  if (!date) return '';
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? date : parsed.toISOString();
  }
  return '';
}

/**
 * Parse raw ICS content and return structured CalendarEvent objects.
 */
export function parseIcsContent(
  icsData: string,
  sourceEmailUid: number,
  sourceEmailSubject: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  let parsed: ReturnType<typeof ical.parseICS>;
  try {
    parsed = ical.parseICS(icsData);
  } catch {
    // If parsing fails, return empty - don't crash
    return events;
  }

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (!component || component.type !== 'VEVENT') continue;

    const vevent = component as VEvent;

    const summary = extractParameterValue(vevent.summary) || '(no title)';
    const description = extractParameterValue(vevent.description);
    const location = extractParameterValue(vevent.location);
    const start = toISOString(vevent.start);
    const end = toISOString(vevent.end);
    const organizer = extractOrganizer(vevent.organizer);
    const attendees = extractAttendees(vevent.attendee);
    const status = vevent.status;
    const icalUid = vevent.uid || key;

    events.push({
      summary,
      description: description || undefined,
      start,
      end,
      location: location || undefined,
      organizer,
      attendees,
      status,
      icalUid,
      sourceEmailUid,
      sourceEmailSubject,
    });
  }

  return events;
}
