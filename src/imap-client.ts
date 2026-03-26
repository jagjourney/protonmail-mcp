import { ImapFlow } from "imapflow";
import type { ProtonmailConfig } from "./config.js";

export function createImapClient(config: ProtonmailConfig): ImapFlow {
  return new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.auth.user, pass: config.auth.pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
}

export interface EmailSummary {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  flags: string[];
  seen: boolean;
  flagged: boolean;
}

export interface EmailFull extends EmailSummary {
  textBody: string;
  htmlBody: string;
  cc: string;
  bcc: string;
  messageId: string;
  inReplyTo: string;
  attachments: { filename: string; size: number; contentType: string }[];
}

export interface FolderInfo {
  path: string;
  name: string;
  specialUse: string;
  messages: number;
  unseen: number;
}

function formatAddresses(addr: any): string {
  if (!addr) return "";
  if (Array.isArray(addr)) {
    return addr.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address || "")).join(", ");
  }
  if (addr.text) return addr.text;
  if (addr.address) return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
  return String(addr);
}

export async function listFolders(
  client: ImapFlow
): Promise<FolderInfo[]> {
  const mailboxes = await client.list();
  const folders: FolderInfo[] = [];

  for (const mb of mailboxes) {
    try {
      const status = await client.status(mb.path, {
        messages: true,
        unseen: true,
      });
      folders.push({
        path: mb.path,
        name: mb.name,
        specialUse: mb.specialUse || "",
        messages: status.messages || 0,
        unseen: status.unseen || 0,
      });
    } catch {
      folders.push({
        path: mb.path,
        name: mb.name,
        specialUse: mb.specialUse || "",
        messages: 0,
        unseen: 0,
      });
    }
  }

  return folders;
}

export async function listEmails(
  client: ImapFlow,
  folder: string,
  limit: number = 20,
  page: number = 1
): Promise<{ emails: EmailSummary[]; total: number }> {
  const lock = await client.getMailboxLock(folder);
  try {
    const status = await client.status(folder, { messages: true });
    const total = status.messages || 0;

    if (total === 0) return { emails: [], total: 0 };

    const end = Math.max(1, total - (page - 1) * limit);
    const start = Math.max(1, end - limit + 1);

    const emails: EmailSummary[] = [];
    for await (const msg of client.fetch(`${start}:${end}`, {
      envelope: true,
      flags: true,
    })) {
      if (!msg) continue;
      const env = msg.envelope;
      if (!env) continue;
      emails.push({
        uid: msg.uid,
        subject: env.subject || "(no subject)",
        from: formatAddresses(env.from),
        to: formatAddresses(env.to),
        date: env.date ? env.date.toISOString() : "",
        flags: Array.from(msg.flags || []),
        seen: msg.flags?.has("\\Seen") || false,
        flagged: msg.flags?.has("\\Flagged") || false,
      });
    }

    // Most recent first
    emails.reverse();
    return { emails, total };
  } finally {
    lock.release();
  }
}

export async function readEmail(
  client: ImapFlow,
  folder: string,
  uid: number
): Promise<EmailFull> {
  const lock = await client.getMailboxLock(folder);
  try {
    // Protonmail Bridge doesn't support UID FETCH, so resolve UID to
    // sequence number first via UID SEARCH, then fetch by sequence.
    const seqs = await client.search({ uid: String(uid) });
    if (!seqs || seqs.length === 0)
      throw new Error(`Email with UID ${uid} not found`);

    const msgResult = await client.fetchOne(String(seqs[0]), {
      envelope: true,
      flags: true,
      source: true,
    });

    if (!msgResult) throw new Error(`Email with UID ${uid} not found`);
    const msg = msgResult;
    const env = msg.envelope;
    if (!env) throw new Error(`Email envelope not available for UID ${uid}`);

    // Parse the source to extract text/html bodies
    let textBody = "";
    let htmlBody = "";
    const attachments: { filename: string; size: number; contentType: string }[] = [];

    if (msg.source) {
      const source = msg.source.toString();
      // Simple extraction - look for text content
      const textMatch = source.match(
        /Content-Type: text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:[^\r\n]*\r?\n)*\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i
      );
      if (textMatch) textBody = textMatch[1].trim();

      const htmlMatch = source.match(
        /Content-Type: text\/html[^\r\n]*\r?\n(?:Content-Transfer-Encoding:[^\r\n]*\r?\n)*\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i
      );
      if (htmlMatch) htmlBody = htmlMatch[1].trim();

      // If no multipart, try the whole body
      if (!textBody && !htmlBody) {
        const bodyStart = source.indexOf("\r\n\r\n");
        if (bodyStart > -1) {
          textBody = source.slice(bodyStart + 4).trim();
        }
      }

      // Extract attachment info from headers
      const attachRegex =
        /Content-Disposition:\s*attachment[^\r\n]*filename="?([^"\r\n;]+)"?[^\r\n]*(?:\r?\n[^\r\n]*)*?Content-Type:\s*([^\r\n;]+)/gi;
      let attachMatch;
      while ((attachMatch = attachRegex.exec(source)) !== null) {
        attachments.push({
          filename: attachMatch[1],
          size: 0,
          contentType: attachMatch[2].trim(),
        });
      }
    }

    return {
      uid: msg.uid,
      subject: env.subject || "(no subject)",
      from: formatAddresses(env.from),
      to: formatAddresses(env.to),
      cc: formatAddresses(env.cc),
      bcc: formatAddresses(env.bcc),
      date: env.date ? env.date.toISOString() : "",
      messageId: env.messageId || "",
      inReplyTo: env.inReplyTo || "",
      flags: Array.from(msg.flags || []),
      seen: msg.flags?.has("\\Seen") || false,
      flagged: msg.flags?.has("\\Flagged") || false,
      textBody,
      htmlBody,
      attachments,
    };
  } finally {
    lock.release();
  }
}

export async function updateFlags(
  client: ImapFlow,
  folder: string,
  uids: number[],
  flags: string[],
  action: "add" | "remove"
): Promise<void> {
  const lock = await client.getMailboxLock(folder);
  try {
    const uidStr = uids.join(",");
    if (action === "add") {
      await client.messageFlagsAdd(uidStr, flags, { uid: true });
    } else {
      await client.messageFlagsRemove(uidStr, flags, { uid: true });
    }
  } finally {
    lock.release();
  }
}

export async function moveEmails(
  client: ImapFlow,
  sourceFolder: string,
  uids: number[],
  destinationFolder: string
): Promise<void> {
  const lock = await client.getMailboxLock(sourceFolder);
  try {
    const uidStr = uids.join(",");
    await client.messageMove(uidStr, destinationFolder, { uid: true });
  } finally {
    lock.release();
  }
}

export async function deleteEmails(
  client: ImapFlow,
  folder: string,
  uids: number[]
): Promise<void> {
  const lock = await client.getMailboxLock(folder);
  try {
    const uidStr = uids.join(",");
    await client.messageDelete(uidStr, { uid: true });
  } finally {
    lock.release();
  }
}

export async function searchEmails(
  client: ImapFlow,
  folder: string,
  query: {
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
    since?: string;
    before?: string;
    seen?: boolean;
    flagged?: boolean;
  },
  limit: number = 20
): Promise<EmailSummary[]> {
  const lock = await client.getMailboxLock(folder);
  try {
    const searchCriteria: any = {};
    if (query.from) searchCriteria.from = query.from;
    if (query.to) searchCriteria.to = query.to;
    if (query.subject) searchCriteria.subject = query.subject;
    if (query.body) searchCriteria.body = query.body;
    if (query.since) searchCriteria.since = new Date(query.since);
    if (query.before) searchCriteria.before = new Date(query.before);
    if (query.seen === true) searchCriteria.seen = true;
    if (query.seen === false) searchCriteria.unseen = true;
    if (query.flagged === true) searchCriteria.flagged = true;
    if (query.flagged === false) searchCriteria.unflagged = true;

    // Protonmail Bridge doesn't support UID FETCH, so search by sequence
    // numbers and fetch by sequence.
    const results = await client.search(searchCriteria);

    if (!results || results.length === 0) return [];

    // Take the most recent sequence numbers up to the limit
    const recentSeqs = results.slice(-limit);
    const emails: EmailSummary[] = [];

    for await (const msg of client.fetch(recentSeqs.join(","), {
      envelope: true,
      flags: true,
    })) {
      if (!msg) continue;
      const env = msg.envelope;
      if (!env) continue;
      emails.push({
        uid: msg.uid,
        subject: env.subject || "(no subject)",
        from: formatAddresses(env.from),
        to: formatAddresses(env.to),
        date: env.date ? env.date.toISOString() : "",
        flags: Array.from(msg.flags || []),
        seen: msg.flags?.has("\\Seen") || false,
        flagged: msg.flags?.has("\\Flagged") || false,
      });
    }

    emails.reverse();
    return emails;
  } finally {
    lock.release();
  }
}

// ── Folder Management ──────────────────────────────────────────────────────

export async function createFolder(
  client: ImapFlow,
  path: string
): Promise<void> {
  try {
    await client.mailboxCreate(path);
  } catch {
    throw new Error(
      `Cannot create folder "${path}". Protonmail Bridge does not support creating folders via IMAP. ` +
      `Please create folders in the Protonmail web app or desktop client.`
    );
  }
}

export async function renameFolder(
  client: ImapFlow,
  path: string,
  newPath: string
): Promise<void> {
  try {
    await client.mailboxRename(path, newPath);
  } catch {
    throw new Error(
      `Cannot rename folder "${path}". Protonmail Bridge does not support renaming folders via IMAP. ` +
      `Please rename folders in the Protonmail web app or desktop client.`
    );
  }
}

export async function deleteFolder(
  client: ImapFlow,
  path: string
): Promise<void> {
  try {
    await client.mailboxDelete(path);
  } catch {
    throw new Error(
      `Cannot delete folder "${path}". Protonmail Bridge does not support deleting folders via IMAP. ` +
      `Please delete folders in the Protonmail web app or desktop client.`
    );
  }
}
