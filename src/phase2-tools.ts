/**
 * Phase 2 tool registrations: Draft Management + Attachment Download
 *
 * These tool definitions are designed to be merged into index.ts.
 * They follow the existing pattern of server.tool() registrations.
 *
 * Prerequisites in index.ts:
 *   import { saveDraft, updateDraft, listAttachments, downloadAttachment } from "./draft-attachment-functions.js";
 *   // A connection pool or client factory: pool.acquire() -> ImapFlow
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ImapFlow } from "imapflow";
import {
  saveDraft,
  updateDraft,
  listAttachments,
  downloadAttachment,
} from "./draft-attachment-functions.js";
import type { ProtonmailConfig } from "./config.js";

/**
 * Register Phase 2 tools on the MCP server.
 *
 * @param server - The MCP server instance
 * @param acquireClient - An async function that returns a connected ImapFlow client
 * @param getFromAddress - Returns the default "from" address for drafts
 */
export function registerPhase2Tools(
  server: McpServer,
  acquireClient: () => Promise<ImapFlow>,
  getFromAddress: () => string
): void {
  // ── Save Draft ──────────────────────────────────────────────────────────
  server.tool(
    "save_draft",
    "Save a new draft email to the Drafts folder. The draft can be edited later or sent from the Protonmail app.",
    {
      to: z.string().describe("Recipient email address(es), comma-separated"),
      subject: z.string().describe("Email subject line"),
      text: z.string().optional().describe("Plain text body"),
      html: z.string().optional().describe("HTML body (optional, for rich formatting)"),
      cc: z.string().optional().describe("CC recipients, comma-separated"),
      bcc: z.string().optional().describe("BCC recipients, comma-separated"),
    },
    async ({ to, subject, text, html, cc, bcc }) => {
      try {
        const client = await acquireClient();
        try {
          const result = await saveDraft(client, {
            to,
            subject,
            text,
            html,
            cc,
            bcc,
            from: getFromAddress(),
          });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } finally {
          await client.logout().catch(() => {});
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Update Draft ────────────────────────────────────────────────────────
  server.tool(
    "update_draft",
    "Update an existing draft email by replacing it with new content. The old draft is deleted and a new one is saved.",
    {
      uid: z.number().describe("UID of the existing draft to update"),
      to: z.string().describe("Recipient email address(es), comma-separated"),
      subject: z.string().describe("Email subject line"),
      text: z.string().optional().describe("Plain text body"),
      html: z.string().optional().describe("HTML body (optional, for rich formatting)"),
      cc: z.string().optional().describe("CC recipients, comma-separated"),
      bcc: z.string().optional().describe("BCC recipients, comma-separated"),
    },
    async ({ uid, to, subject, text, html, cc, bcc }) => {
      try {
        const client = await acquireClient();
        try {
          const result = await updateDraft(client, uid, {
            to,
            subject,
            text,
            html,
            cc,
            bcc,
            from: getFromAddress(),
          });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } finally {
          await client.logout().catch(() => {});
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── List Attachments ────────────────────────────────────────────────────
  server.tool(
    "list_attachments",
    "List all attachments of a specific email. Returns filename, content type, size, and part index for each attachment.",
    {
      folder: z
        .string()
        .default("INBOX")
        .describe("Folder the email is in (e.g. INBOX, Sent, Drafts)"),
      uid: z.number().describe("UID of the email to list attachments for"),
    },
    async ({ folder, uid }) => {
      try {
        const client = await acquireClient();
        try {
          const result = await listAttachments(client, folder, uid);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } finally {
          await client.logout().catch(() => {});
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Download Attachment ─────────────────────────────────────────────────
  server.tool(
    "download_attachment",
    "Download a specific attachment from an email. Returns the attachment as a base64-encoded string.",
    {
      folder: z
        .string()
        .default("INBOX")
        .describe("Folder the email is in (e.g. INBOX, Sent, Drafts)"),
      uid: z.number().describe("UID of the email containing the attachment"),
      part_index: z
        .number()
        .describe("Attachment index from list_attachments (0-based)"),
    },
    async ({ folder, uid, part_index }) => {
      try {
        const client = await acquireClient();
        try {
          const result = await downloadAttachment(client, folder, uid, part_index);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } finally {
          await client.logout().catch(() => {});
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
