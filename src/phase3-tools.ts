import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ImapFlow } from "imapflow";
import { bulkAction, extractContacts } from "./batch-contact-functions.js";
import type { ProtonmailConfig } from "./config.js";

/**
 * Register Phase 3 tools (Batch Operations + Contact Extraction) on the MCP server.
 *
 * These tools create their own ImapFlow client from config, matching the
 * existing pattern in index.ts where each tool manages its own connection.
 */
export function registerPhase3Tools(
  server: McpServer,
  config: ProtonmailConfig
): void {
  function createClient(config: ProtonmailConfig): ImapFlow {
    return new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      tls: {
        rejectUnauthorized: false, // Protonmail Bridge uses self-signed certs
      },
      logger: false,
    });
  }

  // ── Bulk Action ────────────────────────────────────────────────────────────
  server.tool(
    "bulk_action",
    "Apply an action to all emails matching a filter in a folder. Use for bulk cleanup operations like marking all newsletters as read or moving all emails from a sender.",
    {
      folder: z.string().default("INBOX").describe("Folder to operate on"),
      action: z
        .enum(["mark_read", "mark_unread", "flag", "unflag", "move", "delete"])
        .describe("Action to apply"),
      filter: z
        .object({
          from: z.string().optional().describe("Filter by sender"),
          to: z.string().optional().describe("Filter by recipient"),
          subject: z.string().optional().describe("Filter by subject text"),
          body: z.string().optional().describe("Filter by body text"),
          since: z
            .string()
            .optional()
            .describe("Emails on or after date (YYYY-MM-DD)"),
          before: z
            .string()
            .optional()
            .describe("Emails before date (YYYY-MM-DD)"),
          seen: z.boolean().optional().describe("Filter by read status"),
          flagged: z.boolean().optional().describe("Filter by flagged status"),
        })
        .describe("Search filter to match emails"),
      destination: z
        .string()
        .optional()
        .describe("Destination folder (required for 'move' action)"),
    },
    async ({ folder, action, filter, destination }) => {
      if (action === "move" && !destination) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: destination folder is required for move action",
            },
          ],
          isError: true,
        };
      }

      const client = createClient(config);
      try {
        await client.connect();
        const result = await bulkAction(
          client,
          folder,
          filter,
          action,
          destination
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Bulk action complete: matched ${result.matched} emails, processed ${result.processed}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      } finally {
        await client.logout().catch(() => {});
      }
    }
  );

  // ── Extract Contacts ───────────────────────────────────────────────────────
  server.tool(
    "extract_contacts",
    "Extract email addresses from recent emails to build a contact list. Scans INBOX and Sent folders by default.",
    {
      folders: z
        .array(z.string())
        .optional()
        .describe("Folders to scan (default: INBOX and Sent)"),
      limit: z
        .number()
        .default(200)
        .describe("Max emails to scan per folder"),
      filter: z
        .string()
        .optional()
        .describe("Filter contacts by name or email substring"),
    },
    async ({ folders, limit, filter }) => {
      const client = createClient(config);
      try {
        await client.connect();
        const contacts = await extractContacts(client, {
          folders,
          limit,
          filter,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { count: contacts.length, contacts },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      } finally {
        await client.logout().catch(() => {});
      }
    }
  );
}
