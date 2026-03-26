import { ImapFlow } from "imapflow";

export type BulkActionType = "mark_read" | "mark_unread" | "flag" | "unflag" | "move" | "delete";

export interface BulkFilter {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  since?: string;
  before?: string;
  seen?: boolean;
  flagged?: boolean;
}

export interface ContactInfo {
  email: string;
  name: string;
  lastSeen: string;
  frequency: number;
}

/**
 * Apply a bulk action to all emails matching a filter in a folder.
 * Uses sequence numbers (not UIDs) since Protonmail Bridge doesn't support UID FETCH,
 * and sequence numbers are stable within the same mailbox lock session.
 */
export async function bulkAction(
  client: ImapFlow,
  folder: string,
  filter: BulkFilter,
  action: BulkActionType,
  destination?: string
): Promise<{ matched: number; processed: number }> {
  const lock = await client.getMailboxLock(folder);
  try {
    // Build search criteria from filter (same pattern as existing searchEmails)
    const searchCriteria: any = {};
    if (filter.from) searchCriteria.from = filter.from;
    if (filter.to) searchCriteria.to = filter.to;
    if (filter.subject) searchCriteria.subject = filter.subject;
    if (filter.body) searchCriteria.body = filter.body;
    if (filter.since) searchCriteria.since = new Date(filter.since);
    if (filter.before) searchCriteria.before = new Date(filter.before);
    if (filter.seen === true) searchCriteria.seen = true;
    if (filter.seen === false) searchCriteria.unseen = true;
    if (filter.flagged === true) searchCriteria.flagged = true;
    if (filter.flagged === false) searchCriteria.unflagged = true;

    // Search returns sequence numbers
    const results = await client.search(searchCriteria);

    if (!results || results.length === 0) {
      return { matched: 0, processed: 0 };
    }

    // Convert sequence numbers to a comma-separated range string
    const seqRange = results.join(",");

    // Execute the requested action
    switch (action) {
      case "mark_read":
        await client.messageFlagsAdd(seqRange, ["\\Seen"]);
        break;
      case "mark_unread":
        await client.messageFlagsRemove(seqRange, ["\\Seen"]);
        break;
      case "flag":
        await client.messageFlagsAdd(seqRange, ["\\Flagged"]);
        break;
      case "unflag":
        await client.messageFlagsRemove(seqRange, ["\\Flagged"]);
        break;
      case "move":
        if (!destination) {
          throw new Error("Destination folder is required for move action");
        }
        await client.messageMove(seqRange, destination);
        break;
      case "delete":
        await client.messageDelete(seqRange);
        break;
    }

    return { matched: results.length, processed: results.length };
  } finally {
    lock.release();
  }
}

/**
 * Extract contacts from recent emails across one or more folders.
 * Scans envelope headers (from, to, cc) to build a frequency-sorted contact list.
 */
export async function extractContacts(
  client: ImapFlow,
  options: {
    folders?: string[];
    limit?: number;
    filter?: string;
  }
): Promise<ContactInfo[]> {
  const folders = options.folders && options.folders.length > 0 ? options.folders : ["INBOX", "Sent"];
  const limit = options.limit || 200;

  const contactMap = new Map<string, ContactInfo>();

  for (const folder of folders) {
    const lock = await client.getMailboxLock(folder);
    try {
      const status = await client.status(folder, { messages: true });
      const total = status.messages || 0;

      if (total === 0) continue;

      // Calculate sequence range for last N emails
      const start = Math.max(1, total - limit + 1);
      const range = `${start}:${total}`;

      // Fetch envelopes using sequence numbers (Bridge doesn't support UID FETCH)
      for await (const msg of client.fetch(range, { envelope: true })) {
        if (!msg || !msg.envelope) continue;

        const env = msg.envelope;
        const date = env.date ? env.date.toISOString() : "";

        // Extract addresses from from, to, and cc fields
        const addressSources = [env.from, env.to, env.cc];

        for (const addrs of addressSources) {
          if (!addrs || !Array.isArray(addrs)) continue;

          for (const addr of addrs) {
            if (!addr.address) continue;

            const emailLower = addr.address.toLowerCase();
            const existing = contactMap.get(emailLower);

            if (existing) {
              existing.frequency++;
              // Update name if we have a non-empty one and current is empty
              if (addr.name && !existing.name) {
                existing.name = addr.name;
              }
              // Update lastSeen if this message is newer
              if (date && date > existing.lastSeen) {
                existing.lastSeen = date;
              }
            } else {
              contactMap.set(emailLower, {
                email: addr.address,
                name: addr.name || "",
                lastSeen: date,
                frequency: 1,
              });
            }
          }
        }
      }
    } finally {
      lock.release();
    }
  }

  let contacts = Array.from(contactMap.values());

  // Apply filter if provided (case-insensitive substring match on email or name)
  if (options.filter) {
    const filterLower = options.filter.toLowerCase();
    contacts = contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(filterLower) ||
        c.name.toLowerCase().includes(filterLower)
    );
  }

  // Sort by frequency descending
  contacts.sort((a, b) => b.frequency - a.frequency);

  return contacts;
}
