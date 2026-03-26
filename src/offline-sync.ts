import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { simpleParser } from "mailparser";
import { createImapClient } from "./imap-client.js";
import type { ProtonmailConfig } from "./config.js";
import type { AddressObject } from "mailparser";
import {
  generateStyleCss,
  generateEmailPageHtml,
  generateFolderIndexHtml,
  generateMainIndexHtml,
  type SyncedEmail,
  type SyncedEmailFull,
  type FolderSyncInfo,
} from "./html-templates.js";

// ── Exported Interfaces ─────────────────────────────────────────────────────

export interface SyncState {
  version: number;
  lastFullSync: string;
  folders: {
    [folderPath: string]: {
      lastSyncedCount: number;
      count: number;
      lastSyncTime: string;
    };
  };
}

export interface SyncResult {
  foldersProcessed: number;
  emailsSynced: number;
  attachmentsSaved: number;
  errors: string[];
  duration: string;
  folderDetails: { folder: string; synced: number; total: number }[];
}

// ── Helper Functions (not exported) ─────────────────────────────────────────

function sanitizeFilename(str: string, maxLen = 50): string {
  return (
    str
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLen) || "untitled"
  );
}

function sanitizeFolderName(folderPath: string): string {
  return (
    folderPath
      .replace(/\//g, "_")
      .replace(/\\/g, "_")
      .replace(/\[|\]/g, "")
      .replace(/[<>:"/|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[_-]{2,}/g, "_")
      .replace(/^[_-]+|[_-]+$/g, "") || "folder"
  );
}

function formatEmailFilename(
  seq: number,
  date: string,
  subject: string
): string {
  const paddedSeq = String(seq).padStart(6, "0");
  let dateStr = "";
  try {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().slice(0, 10);
    }
  } catch {
    // leave dateStr empty
  }
  const safeSubject = sanitizeFilename(subject, 40);
  const parts = [paddedSeq];
  if (dateStr) parts.push(dateStr);
  parts.push(safeSubject);
  return parts.join("_") + ".html";
}

function extractAddressText(
  addr: AddressObject | AddressObject[] | undefined
): string {
  if (!addr) return "";
  if (Array.isArray(addr)) return addr.map((a) => a.text).join(", ");
  return addr.text || "";
}

function formatEnvelopeAddresses(
  addrs: { name?: string; address?: string }[] | undefined
): string {
  if (!addrs || addrs.length === 0) return "";
  return addrs
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address || ""))
    .join(", ");
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

async function readSyncState(outputDir: string): Promise<SyncState> {
  const stateFile = path.join(outputDir, "sync-state.json");
  try {
    const raw = await readFile(stateFile, "utf-8");
    return JSON.parse(raw) as SyncState;
  } catch {
    return {
      version: 1,
      lastFullSync: "",
      folders: {},
    };
  }
}

async function writeSyncState(
  outputDir: string,
  state: SyncState
): Promise<void> {
  const stateFile = path.join(outputDir, "sync-state.json");
  await writeFile(stateFile, JSON.stringify(state, null, 2), "utf-8");
}

async function readEmailIndex(folderDir: string): Promise<SyncedEmail[]> {
  const indexFile = path.join(folderDir, ".email-index.json");
  try {
    const raw = await readFile(indexFile, "utf-8");
    return JSON.parse(raw) as SyncedEmail[];
  } catch {
    return [];
  }
}

async function writeEmailIndex(
  folderDir: string,
  emails: SyncedEmail[]
): Promise<void> {
  const indexFile = path.join(folderDir, ".email-index.json");
  await writeFile(indexFile, JSON.stringify(emails, null, 2), "utf-8");
}

// ── Main Sync Function ──────────────────────────────────────────────────────

export async function runOfflineSync(
  config: ProtonmailConfig,
  outputDir: string,
  options?: { folders?: string[]; limit?: number; batchSize?: number }
): Promise<SyncResult> {
  const startTime = Date.now();
  const batchSize = options?.batchSize ?? 50;

  const result: SyncResult = {
    foldersProcessed: 0,
    emailsSynced: 0,
    attachmentsSaved: 0,
    errors: [],
    duration: "",
    folderDetails: [],
  };

  // 1. Create output directories
  await mkdir(outputDir, { recursive: true });
  const assetsDir = path.join(outputDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  // 2. Write style.css
  try {
    const css = generateStyleCss();
    await writeFile(path.join(assetsDir, "style.css"), css, "utf-8");
  } catch (err) {
    result.errors.push(`Failed to write style.css: ${err}`);
  }

  // 3. Load sync state
  const state = await readSyncState(outputDir);
  state.version = 1;

  // 4. Create IMAP client and connect
  const client = createImapClient(config);
  try {
    await client.connect();
  } catch (err) {
    result.errors.push(`IMAP connection failed: ${err}`);
    result.duration = formatDuration(Date.now() - startTime);
    return result;
  }

  try {
    // 5. List all folders with message counts
    const mailboxes = await client.list();
    interface FolderEntry {
      path: string;
      name: string;
      messages: number;
    }
    const allFolders: FolderEntry[] = [];

    for (const mb of mailboxes) {
      try {
        const status = await client.status(mb.path, { messages: true });
        allFolders.push({
          path: mb.path,
          name: mb.name,
          messages: status.messages || 0,
        });
      } catch {
        allFolders.push({
          path: mb.path,
          name: mb.name,
          messages: 0,
        });
      }
    }

    // Filter folders if options.folders provided
    const foldersToSync = options?.folders
      ? allFolders.filter((f) =>
          options.folders!.some(
            (of) =>
              f.path.toLowerCase() === of.toLowerCase() ||
              f.name.toLowerCase() === of.toLowerCase()
          )
        )
      : allFolders;

    // 6. Process each folder
    for (const folder of foldersToSync) {
      try {
        const folderState = state.folders[folder.path] || {
          lastSyncedCount: 0,
          count: 0,
          lastSyncTime: "",
        };

        const totalMessages = folder.messages;
        const lastSynced = folderState.lastSyncedCount;

        // Determine range of new messages to fetch
        const newMessageStart = lastSynced + 1;
        let newMessageEnd = totalMessages;

        if (
          options?.limit &&
          newMessageEnd - newMessageStart + 1 > options.limit
        ) {
          newMessageEnd = newMessageStart + options.limit - 1;
        }

        if (newMessageStart > totalMessages) {
          // No new messages in this folder
          result.folderDetails.push({
            folder: folder.path,
            synced: 0,
            total: totalMessages,
          });
          result.foldersProcessed++;
          continue;
        }

        // Create folder directory (sanitized name)
        const folderDirName = sanitizeFolderName(folder.path);
        const folderDir = path.join(outputDir, folderDirName);
        await mkdir(folderDir, { recursive: true });

        // Load existing email index for this folder
        const emailIndex = await readEmailIndex(folderDir);
        let folderSyncCount = 0;

        // Fetch messages in batches
        for (
          let batchStart = newMessageStart;
          batchStart <= newMessageEnd;
          batchStart += batchSize
        ) {
          const batchEnd = Math.min(
            batchStart + batchSize - 1,
            newMessageEnd
          );
          const lock = await client.getMailboxLock(folder.path);

          try {
            for await (const msg of client.fetch(
              `${batchStart}:${batchEnd}`,
              {
                source: true,
                envelope: true,
                flags: true,
              }
            )) {
              try {
                if (!msg || !msg.source) continue;

                const env = msg.envelope;
                const seq = msg.seq;
                const uid = msg.uid;

                // Parse full message with simpleParser for attachment Buffers
                const parsed = await simpleParser(msg.source);

                const subject =
                  env?.subject || parsed.subject || "(no subject)";
                const fromAddr =
                  formatEnvelopeAddresses(env?.from) ||
                  parsed.from?.text ||
                  "";
                const toAddr =
                  formatEnvelopeAddresses(env?.to) ||
                  extractAddressText(parsed.to) ||
                  "";
                const ccAddr = extractAddressText(parsed.cc);
                const bccAddr = extractAddressText(parsed.bcc);
                const messageId = env?.messageId || parsed.messageId || "";
                const dateStr = env?.date
                  ? env.date.toISOString()
                  : parsed.date
                    ? parsed.date.toISOString()
                    : "";
                const seen = msg.flags?.has("\\Seen") || false;
                const flagged = msg.flags?.has("\\Flagged") || false;
                const flags = Array.from(msg.flags || []);

                // Get bodies
                let htmlBody = parsed.html || "";
                const textBody = parsed.text || "";

                // Prepare attachment directory name
                const paddedSeq = String(seq).padStart(6, "0");
                const attachmentDir = `${paddedSeq}_attachments`;
                let attachmentCount = 0;

                // Collect attachment metadata for the HTML template
                const attachmentMeta: {
                  filename: string;
                  savedAs: string;
                  contentType: string;
                  size: number;
                }[] = [];

                // Handle attachments and rewrite inline cid: references
                if (parsed.attachments && parsed.attachments.length > 0) {
                  const attachDir = path.join(folderDir, attachmentDir);
                  await mkdir(attachDir, { recursive: true });

                  for (let i = 0; i < parsed.attachments.length; i++) {
                    const att = parsed.attachments[i];
                    try {
                      const safeName = sanitizeFilename(
                        att.filename || `attachment-${i}`,
                        80
                      );
                      const attPath = path.join(attachDir, safeName);
                      await writeFile(attPath, att.content);
                      attachmentCount++;
                      result.attachmentsSaved++;

                      attachmentMeta.push({
                        filename: att.filename || `attachment-${i}`,
                        savedAs: safeName,
                        contentType:
                          att.contentType || "application/octet-stream",
                        size: att.size || 0,
                      });

                      // Rewrite cid: references in HTML body to local paths
                      if (att.contentId && htmlBody) {
                        const cidClean = att.contentId.replace(/[<>]/g, "");
                        htmlBody = htmlBody.replace(
                          new RegExp(
                            `cid:${cidClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
                            "gi"
                          ),
                          `${attachmentDir}/${safeName}`
                        );
                      }
                    } catch (attErr) {
                      result.errors.push(
                        `Failed to save attachment in ${folder.path} seq ${seq}: ${attErr}`
                      );
                    }
                  }
                }

                // Build the full email data for template rendering
                const emailData: SyncedEmailFull = {
                  seq,
                  uid,
                  subject,
                  from: fromAddr,
                  to: toAddr,
                  date: dateStr,
                  seen,
                  flagged,
                  attachmentCount,
                  filename: "", // will be set below
                  cc: ccAddr,
                  bcc: bccAddr,
                  messageId,
                  htmlBody,
                  textBody,
                  attachments: attachmentMeta,
                };

                // Generate HTML filename
                const filename = formatEmailFilename(seq, dateStr, subject);
                emailData.filename = filename;

                // Write the email HTML page
                const emailHtmlContent = generateEmailPageHtml(
                  emailData,
                  folder.name
                );
                await writeFile(
                  path.join(folderDir, filename),
                  emailHtmlContent,
                  "utf-8"
                );

                // Add to the folder's email index
                emailIndex.push({
                  seq,
                  uid,
                  subject,
                  from: fromAddr,
                  to: toAddr,
                  date: dateStr,
                  filename,
                  attachmentCount,
                  seen,
                  flagged,
                });

                folderSyncCount++;
                result.emailsSynced++;
              } catch (msgErr) {
                result.errors.push(
                  `Error processing message in ${folder.path}: ${msgErr}`
                );
              }
            }
          } finally {
            lock.release();
          }
        }

        // Sort index by sequence number ascending and write it
        emailIndex.sort((a, b) => a.seq - b.seq);
        await writeEmailIndex(folderDir, emailIndex);

        // Rebuild this folder's index.html
        try {
          const folderIndexHtml = generateFolderIndexHtml(
            folder.name,
            emailIndex
          );
          await writeFile(
            path.join(folderDir, "index.html"),
            folderIndexHtml,
            "utf-8"
          );
        } catch (err) {
          result.errors.push(
            `Failed to write folder index for ${folder.path}: ${err}`
          );
        }

        // Update sync state for this folder
        state.folders[folder.path] = {
          lastSyncedCount: Math.min(newMessageEnd, totalMessages),
          count: totalMessages,
          lastSyncTime: new Date().toISOString(),
        };

        result.folderDetails.push({
          folder: folder.path,
          synced: folderSyncCount,
          total: totalMessages,
        });
        result.foldersProcessed++;
      } catch (folderErr) {
        result.errors.push(
          `Error syncing folder ${folder.path}: ${folderErr}`
        );
        result.foldersProcessed++;
      }
    }

    // 7. Rebuild main index.html
    try {
      const folderSummaries: FolderSyncInfo[] = foldersToSync.map((f) => {
        const dirName = sanitizeFolderName(f.path);
        const folderEmails = state.folders[f.path];
        const syncedCount = folderEmails?.lastSyncedCount ?? 0;

        return {
          name: f.name,
          path: dirName,
          totalSynced: syncedCount,
          unread: 0, // Accurate unread counts would require re-parsing flags
        };
      });

      const mainIndexHtml = generateMainIndexHtml(folderSummaries);
      await writeFile(
        path.join(outputDir, "index.html"),
        mainIndexHtml,
        "utf-8"
      );
    } catch (err) {
      result.errors.push(`Failed to write main index: ${err}`);
    }

    // 8. Write updated sync state
    state.lastFullSync = new Date().toISOString();
    await writeSyncState(outputDir, state);
  } finally {
    // 9. Logout IMAP client
    try {
      await client.logout();
    } catch {
      // Ignore logout errors
    }
  }

  // 10. Return result
  result.duration = formatDuration(Date.now() - startTime);
  return result;
}

// ── Sync Status Query ───────────────────────────────────────────────────────

export async function getSyncStatus(outputDir: string): Promise<{
  lastFullSync: string;
  folderCount: number;
  folders: {
    path: string;
    syncedCount: number;
    totalCount: number;
    lastSyncTime: string;
  }[];
  totalSyncedEmails: number;
}> {
  const state = await readSyncState(outputDir);

  const folders = Object.entries(state.folders).map(([folderPath, info]) => ({
    path: folderPath,
    syncedCount: info.lastSyncedCount,
    totalCount: info.count,
    lastSyncTime: info.lastSyncTime,
  }));

  const totalSyncedEmails = folders.reduce(
    (sum, f) => sum + f.syncedCount,
    0
  );

  return {
    lastFullSync: state.lastFullSync,
    folderCount: folders.length,
    folders,
    totalSyncedEmails,
  };
}
