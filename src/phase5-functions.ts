import { ImapFlow } from 'imapflow';
import { parseIcsContent, type CalendarEvent } from './calendar.js';

/**
 * Extract calendar events from emails in a given folder.
 *
 * Scans email source content for ICS/iCalendar data (BEGIN:VCALENDAR blocks)
 * and parses them into structured CalendarEvent objects.
 *
 * Uses sequence-number-based fetching to avoid the Protonmail Bridge UID FETCH bug.
 */
export async function extractCalendarEvents(
  client: ImapFlow,
  folder: string,
  options: { since?: string; limit?: number }
): Promise<CalendarEvent[]> {
  const limit = options.limit ?? 50;
  const events: CalendarEvent[] = [];

  const lock = await client.getMailboxLock(folder);
  try {
    // Build search criteria
    const searchCriteria: any = {};
    if (options.since) {
      searchCriteria.since = new Date(options.since);
    }

    // Search returns sequence numbers
    const seqs = await client.search(searchCriteria);

    if (!seqs || seqs.length === 0) return events;

    // Take the last N sequence numbers (most recent emails)
    const recentSeqs = seqs.slice(-limit);
    const seqRange = recentSeqs.join(',');

    // Fetch source and envelope for each message by sequence number
    for await (const msg of client.fetch(seqRange, {
      source: true,
      envelope: true,
    })) {
      if (!msg || !msg.source) continue;

      const source = msg.source.toString();

      // Look for ICS calendar data in the email source.
      // This regex extracts full VCALENDAR blocks, which works for both
      // inline text/calendar parts and base64-decoded content that happens
      // to appear in plain text form.
      const icsRegex = /BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/g;
      const matches = source.match(icsRegex);

      if (matches) {
        const subject = msg.envelope?.subject || '(no subject)';
        const uid = msg.uid;

        for (const icsData of matches) {
          events.push(...parseIcsContent(icsData, uid, subject));
        }
      }
    }
  } finally {
    lock.release();
  }

  return events;
}
