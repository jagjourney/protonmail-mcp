import { ImapFlow } from "imapflow";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { parseEmailSource, type AttachmentInfo } from "./mime-utils.js";
import type { EmailFull } from "./imap-client.js";

// ── Draft Management ────────────────────────────────────────────────────────

/**
 * Find the Drafts folder path by looking for \Drafts specialUse.
 */
async function findDraftsFolder(client: ImapFlow): Promise<string> {
  const mailboxes = await client.list();
  const drafts = mailboxes.find(
    (mb: any) =>
      mb.specialUse === "\\Drafts" ||
      mb.path.toLowerCase() === "drafts"
  );
  return drafts?.path || "Drafts";
}

/**
 * Save a new draft email to the Drafts folder.
 * Builds an RFC822 message using MailComposer and appends it via IMAP.
 */
export async function saveDraft(
  client: ImapFlow,
  options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string;
    bcc?: string;
    from?: string;
  }
): Promise<{ uid?: number; path: string }> {
  const composer = new MailComposer({
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    cc: options.cc,
    bcc: options.bcc,
  });

  const message: Buffer = await composer.compile().build();
  const draftsPath = await findDraftsFolder(client);
  const result = await client.append(draftsPath, message, ["\\Draft", "\\Seen"]);

  return {
    uid: (result as any)?.uid,
    path: draftsPath,
  };
}

/**
 * Update an existing draft by deleting the old one and saving a new one.
 * Bridge doesn't support UID FETCH, so we resolve UID to seq first.
 */
export async function updateDraft(
  client: ImapFlow,
  uid: number,
  options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string;
    bcc?: string;
    from?: string;
  }
): Promise<{ uid?: number; path: string }> {
  const draftsPath = await findDraftsFolder(client);

  // Delete the old draft
  const lock = await client.getMailboxLock(draftsPath);
  try {
    // Resolve UID to sequence number (Bridge UID FETCH workaround)
    const seqs = await client.search({ uid: String(uid) });
    if (!seqs || seqs.length === 0) {
      throw new Error(`Draft with UID ${uid} not found`);
    }
    await client.messageDelete(String(seqs[0]), {});
  } finally {
    lock.release();
  }

  // Save the new draft
  return saveDraft(client, options);
}

// ── Attachment Operations ───────────────────────────────────────────────────

/**
 * List attachments for an email in a given folder.
 * Fetches the full source and parses it with mailparser.
 */
export async function listAttachments(
  client: ImapFlow,
  folder: string,
  uid: number
): Promise<AttachmentInfo[]> {
  const lock = await client.getMailboxLock(folder);
  try {
    // Resolve UID to sequence number (Bridge UID FETCH workaround)
    const seqs = await client.search({ uid: String(uid) });
    if (!seqs || seqs.length === 0) {
      throw new Error(`Email with UID ${uid} not found in folder "${folder}"`);
    }

    const msg = await client.fetchOne(String(seqs[0]), { source: true });
    if (!msg || !msg.source) {
      throw new Error(`Could not fetch source for UID ${uid}`);
    }

    const parsed = await parseEmailSource(msg.source);
    return parsed.attachments;
  } finally {
    lock.release();
  }
}

/**
 * Download a specific attachment from an email.
 * Returns the attachment content as a base64-encoded string.
 */
export async function downloadAttachment(
  client: ImapFlow,
  folder: string,
  uid: number,
  partIndex: number
): Promise<{ filename: string; contentType: string; content: string }> {
  const lock = await client.getMailboxLock(folder);
  try {
    // Resolve UID to sequence number (Bridge UID FETCH workaround)
    const seqs = await client.search({ uid: String(uid) });
    if (!seqs || seqs.length === 0) {
      throw new Error(`Email with UID ${uid} not found in folder "${folder}"`);
    }

    const msg = await client.fetchOne(String(seqs[0]), { source: true });
    if (!msg || !msg.source) {
      throw new Error(`Could not fetch source for UID ${uid}`);
    }

    // Parse with mailparser to get full attachment data
    const { simpleParser } = await import("mailparser");
    const parsed = await simpleParser(msg.source);
    const attachments = parsed.attachments || [];

    if (partIndex < 0 || partIndex >= attachments.length) {
      throw new Error(
        `Attachment index ${partIndex} out of range. Email has ${attachments.length} attachment(s).`
      );
    }

    const att = attachments[partIndex];
    return {
      filename: att.filename || `attachment-${partIndex}`,
      contentType: att.contentType || "application/octet-stream",
      content: att.content.toString("base64"),
    };
  } finally {
    lock.release();
  }
}

// ── Refactored readEmail (V2 using mailparser) ─────────────────────────────

function formatAddresses(addr: any): string {
  if (!addr) return "";
  if (Array.isArray(addr)) {
    return addr
      .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address || ""))
      .join(", ");
  }
  if (addr.text) return addr.text;
  if (addr.address)
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
  return String(addr);
}

/**
 * Read the full content of a specific email by UID using mailparser for
 * reliable MIME parsing (replaces the fragile regex approach in v1).
 * Same function signature and return type as the original readEmail.
 */
export async function readEmailV2(
  client: ImapFlow,
  folder: string,
  uid: number
): Promise<EmailFull> {
  const lock = await client.getMailboxLock(folder);
  try {
    // Resolve UID to sequence number (Bridge UID FETCH workaround)
    const seqs = await client.search({ uid: String(uid) });
    if (!seqs || seqs.length === 0) {
      throw new Error(`Email with UID ${uid} not found`);
    }

    const msg = await client.fetchOne(String(seqs[0]), {
      envelope: true,
      flags: true,
      source: true,
    });

    if (!msg) throw new Error(`Email with UID ${uid} not found`);
    const env = msg.envelope;
    if (!env) throw new Error(`Email envelope not available for UID ${uid}`);

    // Parse the source with mailparser for reliable body/attachment extraction
    let textBody = "";
    let htmlBody = "";
    let attachments: { filename: string; size: number; contentType: string }[] =
      [];

    if (msg.source) {
      const parsed = await parseEmailSource(msg.source);
      textBody = parsed.text;
      htmlBody = parsed.html;
      attachments = parsed.attachments.map((att) => ({
        filename: att.filename,
        size: att.size,
        contentType: att.contentType,
      }));
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
