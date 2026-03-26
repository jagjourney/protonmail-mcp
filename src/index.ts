#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";
import { loadConfig, type ProtonmailConfig } from "./config.js";
import { ImapPool } from "./imap-pool.js";
import {
  listFolders,
  listEmails,
  readEmail,
  updateFlags,
  moveEmails,
  deleteEmails,
  searchEmails,
  createFolder,
  renameFolder,
  deleteFolder,
  createImapClient,
} from "./imap-client.js";
import { sendEmail } from "./smtp-client.js";
import { registerPhase2Tools } from "./phase2-tools.js";
import { registerPhase3Tools } from "./phase3-tools.js";
import { TemplateManager } from "./templates.js";
import { RuleManager, type RuleExecutionResult } from "./rules.js";
import { registerPhase5Tools } from "./phase5-tools.js";
import { registerOfflineSyncTools } from "./offline-sync-tools.js";

let config: ProtonmailConfig;

try {
  config = loadConfig();
} catch (err: any) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const pool = new ImapPool(config);
const templateManager = new TemplateManager(config.dataDir);
const ruleManager = new RuleManager(config.dataDir);

// Graceful shutdown
process.on("SIGINT", () => {
  pool.shutdown().then(() => process.exit(0));
});

// Protonmail Bridge folder names can vary. This resolves common aliases.
async function resolveFolder(name: string): Promise<string> {
  const lower = name.toLowerCase();
  if (lower === "spam" || lower === "junk") {
    const client = await pool.acquire();
    const folders = await listFolders(client);
    const spam = folders.find(
      (f) =>
        f.specialUse === "\\Junk" ||
        f.path.toLowerCase() === "spam" ||
        f.path.toLowerCase().includes("spam")
    );
    return spam?.path || "Spam";
  }
  return name;
}

const server = new McpServer({
  name: "protonmail-mcp",
  version: "1.6.3",
  description:
    "MCP server for managing Protonmail emails via Protonmail Bridge (IMAP/SMTP)",
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: Core Email Tools (15 original + 3 folder management)
// ═══════════════════════════════════════════════════════════════════════════

// ── List Folders ────────────────────────────────────────────────────────────
server.tool(
  "list_folders",
  "List all email folders/mailboxes with message counts",
  {},
  async () => {
    try {
      const client = await pool.acquire();
      const folders = await listFolders(client);
      return {
        content: [{ type: "text", text: JSON.stringify(folders, null, 2) }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── List Emails ─────────────────────────────────────────────────────────────
server.tool(
  "list_emails",
  "List emails in a folder. Returns subject, from, date, read/flagged status.",
  {
    folder: z.string().default("INBOX").describe("Folder path (e.g. INBOX, Sent, Trash, Spam)"),
    limit: z.number().default(20).describe("Max emails to return (default 20)"),
    page: z.number().default(1).describe("Page number for pagination"),
  },
  async ({ folder, limit, page }) => {
    try {
      const client = await pool.acquire();
      const result = await listEmails(client, folder, limit, page);
      return {
        content: [{ type: "text", text: JSON.stringify({ total: result.total, page, limit, emails: result.emails }, null, 2) }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Read Email ──────────────────────────────────────────────────────────────
server.tool(
  "read_email",
  "Read the full content of a specific email by its UID. Returns subject, body, headers, and attachment info.",
  {
    folder: z.string().default("INBOX").describe("Folder the email is in"),
    uid: z.number().describe("The UID of the email to read"),
  },
  async ({ folder, uid }) => {
    try {
      const client = await pool.acquire();
      const email = await readEmail(client, folder, uid);
      return {
        content: [{ type: "text", text: JSON.stringify(email, null, 2) }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Mark as Read ────────────────────────────────────────────────────────────
server.tool(
  "mark_as_read",
  "Mark one or more emails as read (seen)",
  {
    folder: z.string().default("INBOX").describe("Folder the emails are in"),
    uids: z.array(z.number()).describe("Array of email UIDs to mark as read"),
  },
  async ({ folder, uids }) => {
    try {
      const client = await pool.acquire();
      await updateFlags(client, folder, uids, ["\\Seen"], "add");
      return { content: [{ type: "text", text: `Marked ${uids.length} email(s) as read.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Mark as Unread ──────────────────────────────────────────────────────────
server.tool(
  "mark_as_unread",
  "Mark one or more emails as unread (unseen)",
  {
    folder: z.string().default("INBOX").describe("Folder the emails are in"),
    uids: z.array(z.number()).describe("Array of email UIDs to mark as unread"),
  },
  async ({ folder, uids }) => {
    try {
      const client = await pool.acquire();
      await updateFlags(client, folder, uids, ["\\Seen"], "remove");
      return { content: [{ type: "text", text: `Marked ${uids.length} email(s) as unread.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Flag Email (Star) ───────────────────────────────────────────────────────
server.tool(
  "flag_email",
  "Flag/star one or more emails",
  {
    folder: z.string().default("INBOX").describe("Folder the emails are in"),
    uids: z.array(z.number()).describe("Array of email UIDs to flag"),
  },
  async ({ folder, uids }) => {
    try {
      const client = await pool.acquire();
      await updateFlags(client, folder, uids, ["\\Flagged"], "add");
      return { content: [{ type: "text", text: `Flagged ${uids.length} email(s).` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Unflag Email ────────────────────────────────────────────────────────────
server.tool(
  "unflag_email",
  "Remove flag/star from one or more emails",
  {
    folder: z.string().default("INBOX").describe("Folder the emails are in"),
    uids: z.array(z.number()).describe("Array of email UIDs to unflag"),
  },
  async ({ folder, uids }) => {
    try {
      const client = await pool.acquire();
      await updateFlags(client, folder, uids, ["\\Flagged"], "remove");
      return { content: [{ type: "text", text: `Unflagged ${uids.length} email(s).` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Move to Spam ────────────────────────────────────────────────────────────
server.tool(
  "move_to_spam",
  "Move one or more emails to the Spam folder",
  {
    folder: z.string().default("INBOX").describe("Source folder"),
    uids: z.array(z.number()).describe("Array of email UIDs to move to spam"),
  },
  async ({ folder, uids }) => {
    try {
      const client = await pool.acquire();
      const spamFolder = await resolveFolder("Spam");
      await moveEmails(client, folder, uids, spamFolder);
      return { content: [{ type: "text", text: `Moved ${uids.length} email(s) to Spam.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Move to Trash ───────────────────────────────────────────────────────────
server.tool(
  "move_to_trash",
  "Move one or more emails to the Trash folder",
  {
    folder: z.string().default("INBOX").describe("Source folder"),
    uids: z.array(z.number()).describe("Array of email UIDs to trash"),
  },
  async ({ folder, uids }) => {
    try {
      const client = await pool.acquire();
      await moveEmails(client, folder, uids, "Trash");
      return { content: [{ type: "text", text: `Moved ${uids.length} email(s) to Trash.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Move Email ──────────────────────────────────────────────────────────────
server.tool(
  "move_email",
  "Move one or more emails to a specific folder",
  {
    source_folder: z.string().describe("Source folder path"),
    uids: z.array(z.number()).describe("Array of email UIDs to move"),
    destination_folder: z.string().describe("Destination folder path"),
  },
  async ({ source_folder, uids, destination_folder }) => {
    try {
      const client = await pool.acquire();
      await moveEmails(client, source_folder, uids, destination_folder);
      return {
        content: [{ type: "text", text: `Moved ${uids.length} email(s) from "${source_folder}" to "${destination_folder}".` }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Permanently Delete ──────────────────────────────────────────────────────
server.tool(
  "permanently_delete",
  "Permanently delete one or more emails (cannot be undone). Use move_to_trash for reversible deletion.",
  {
    folder: z.string().describe("Folder the emails are in"),
    uids: z.array(z.number()).describe("Array of email UIDs to permanently delete"),
  },
  async ({ folder, uids }) => {
    try {
      const client = await pool.acquire();
      await deleteEmails(client, folder, uids);
      return { content: [{ type: "text", text: `Permanently deleted ${uids.length} email(s).` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Search Emails ───────────────────────────────────────────────────────────
server.tool(
  "search_emails",
  "Search emails in a folder by sender, recipient, subject, body text, date range, or read/flagged status",
  {
    folder: z.string().default("INBOX").describe("Folder to search in"),
    from: z.string().optional().describe("Filter by sender address or name"),
    to: z.string().optional().describe("Filter by recipient address or name"),
    subject: z.string().optional().describe("Filter by subject text"),
    body: z.string().optional().describe("Filter by body text content"),
    since: z.string().optional().describe("Emails on or after this date (YYYY-MM-DD)"),
    before: z.string().optional().describe("Emails before this date (YYYY-MM-DD)"),
    seen: z.boolean().optional().describe("Filter by read status (true=read, false=unread)"),
    flagged: z.boolean().optional().describe("Filter by flagged status"),
    limit: z.number().default(20).describe("Max results to return"),
  },
  async ({ folder, from, to, subject, body, since, before, seen, flagged, limit }) => {
    try {
      const client = await pool.acquire();
      const results = await searchEmails(client, folder, { from, to, subject, body, since, before, seen, flagged }, limit);
      return {
        content: [{ type: "text", text: JSON.stringify({ count: results.length, emails: results }, null, 2) }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Send Email ──────────────────────────────────────────────────────────────
server.tool(
  "send_email",
  "Compose and send an email via Protonmail. Supports plain text and HTML, CC/BCC, and reply threading.",
  {
    to: z.string().describe("Recipient email address(es), comma-separated"),
    subject: z.string().describe("Email subject line"),
    text: z.string().optional().describe("Plain text body"),
    html: z.string().optional().describe("HTML body (optional, for rich formatting)"),
    cc: z.string().optional().describe("CC recipients, comma-separated"),
    bcc: z.string().optional().describe("BCC recipients, comma-separated"),
    reply_to: z.string().optional().describe("Reply-To address"),
    in_reply_to: z.string().optional().describe("Message-ID of the email being replied to (for threading)"),
  },
  async ({ to, subject, text, html, cc, bcc, reply_to, in_reply_to }) => {
    try {
      const result = await sendEmail(config, { to, subject, text, html, cc, bcc, replyTo: reply_to, inReplyTo: in_reply_to });
      return {
        content: [{ type: "text", text: `Email sent successfully.\nMessage-ID: ${result.messageId}\nServer response: ${result.response}` }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Create Folder ───────────────────────────────────────────────────────────
server.tool(
  "create_folder",
  "Create a new email folder/label",
  { path: z.string().describe("Folder path to create (e.g. 'MyFolder' or 'Folders/Subfolder')") },
  async ({ path }) => {
    try {
      const client = await pool.acquire();
      await createFolder(client, path);
      return { content: [{ type: "text", text: `Folder "${path}" created successfully.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Rename Folder ───────────────────────────────────────────────────────────
server.tool(
  "rename_folder",
  "Rename an existing email folder/label",
  {
    path: z.string().describe("Current folder path"),
    new_path: z.string().describe("New folder path/name"),
  },
  async ({ path, new_path }) => {
    try {
      const client = await pool.acquire();
      await renameFolder(client, path, new_path);
      return { content: [{ type: "text", text: `Folder "${path}" renamed to "${new_path}" successfully.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Delete Folder ───────────────────────────────────────────────────────────
server.tool(
  "delete_folder",
  "Delete an email folder/label (must be empty)",
  { path: z.string().describe("Folder path to delete") },
  async ({ path }) => {
    try {
      const client = await pool.acquire();
      await deleteFolder(client, path);
      return { content: [{ type: "text", text: `Folder "${path}" deleted successfully.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Launch Protonmail Desktop App ───────────────────────────────────────────
server.tool(
  "launch_protonmail_app",
  "Launch the Protonmail Desktop application on Windows",
  {},
  async () => {
    try {
      const appPath = config.desktopAppPath;
      exec(`start "" "${appPath}"`, (err) => {
        if (err) console.error("Failed to launch app:", err.message);
      });
      return { content: [{ type: "text", text: `Launching Protonmail Desktop App from: ${appPath}` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Get Email Stats ─────────────────────────────────────────────────────────
server.tool(
  "get_email_stats",
  "Get a quick summary of your mailbox: total messages, unread count across all folders",
  {},
  async () => {
    try {
      const client = await pool.acquire();
      const folders = await listFolders(client);
      const stats = {
        folders: folders.map((f) => ({ name: f.name, path: f.path, total: f.messages, unread: f.unseen })),
        totalMessages: folders.reduce((sum, f) => sum + f.messages, 0),
        totalUnread: folders.reduce((sum, f) => sum + f.unseen, 0),
      };
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: Draft Management + Attachment Download (4 tools)
// ═══════════════════════════════════════════════════════════════════════════
registerPhase2Tools(
  server,
  () => pool.acquire(),
  () => config.auth.user
);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: Batch Operations + Contact Extraction (2 tools)
// ═══════════════════════════════════════════════════════════════════════════
registerPhase3Tools(server, config);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: Email Templates + Auto-Categorization Rules (8 tools)
// ═══════════════════════════════════════════════════════════════════════════

// ── Save Template ──────────────────────────────────────────────────────────
server.tool(
  "save_template",
  "Save a reusable email template with optional variable placeholders (use {{variable}} syntax)",
  {
    name: z.string().describe("Template name for easy reference"),
    subject: z.string().describe("Email subject (supports {{variable}} placeholders)"),
    text: z.string().optional().describe("Plain text body (supports {{variable}} placeholders)"),
    html: z.string().optional().describe("HTML body (supports {{variable}} placeholders)"),
    to: z.string().optional().describe("Default recipient(s) (supports {{variable}} placeholders)"),
    cc: z.string().optional().describe("Default CC recipients"),
    bcc: z.string().optional().describe("Default BCC recipients"),
  },
  async ({ name, subject, text, html, to, cc, bcc }) => {
    try {
      const template = await templateManager.saveTemplate({ name, subject, text, html, to, cc, bcc });
      return { content: [{ type: "text", text: JSON.stringify(template, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── List Templates ─────────────────────────────────────────────────────────
server.tool("list_templates", "List all saved email templates", {}, async () => {
  try {
    const templates = await templateManager.listTemplates();
    return { content: [{ type: "text", text: JSON.stringify(templates, null, 2) }] };
  } catch (err: any) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

// ── Delete Template ────────────────────────────────────────────────────────
server.tool(
  "delete_template",
  "Delete a saved email template by ID",
  { id: z.string().describe("The template ID to delete") },
  async ({ id }) => {
    try {
      await templateManager.deleteTemplate(id);
      return { content: [{ type: "text", text: `Template ${id} deleted successfully.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Send From Template ─────────────────────────────────────────────────────
server.tool(
  "send_from_template",
  "Render an email template with variables and send it. Overrides to/cc/bcc if provided.",
  {
    template_id: z.string().describe("The template ID to use"),
    variables: z.record(z.string()).optional().describe("Key-value map to replace {{variable}} placeholders"),
    to: z.string().optional().describe("Override recipient(s), comma-separated"),
    cc: z.string().optional().describe("Override CC recipients"),
    bcc: z.string().optional().describe("Override BCC recipients"),
  },
  async ({ template_id, variables, to, cc, bcc }) => {
    try {
      const rendered = await templateManager.renderTemplate(template_id, variables || {});
      const finalTo = to || rendered.to;
      if (!finalTo) {
        return { content: [{ type: "text", text: "Error: No recipient specified. Provide 'to' parameter or set it in the template." }], isError: true };
      }
      const result = await sendEmail(config, { to: finalTo, subject: rendered.subject, text: rendered.text, html: rendered.html, cc: cc || rendered.cc, bcc: bcc || rendered.bcc });
      return { content: [{ type: "text", text: `Email sent from template successfully.\nMessage-ID: ${result.messageId}` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Create Rule ────────────────────────────────────────────────────────────
server.tool(
  "create_rule",
  "Create an auto-categorization rule. Conditions use case-insensitive substring matching.",
  {
    name: z.string().describe("Rule name for easy reference"),
    conditions: z.object({
      from: z.string().optional().describe("Match sender (substring)"),
      subject: z.string().optional().describe("Match subject (substring)"),
      to: z.string().optional().describe("Match recipient (substring)"),
    }).describe("Conditions to match emails against"),
    match_mode: z.enum(["all", "any"]).default("all").describe("'all' = AND, 'any' = OR"),
    actions: z.object({
      moveTo: z.string().optional().describe("Move to this folder"),
      markRead: z.boolean().optional().describe("Mark as read"),
      markFlagged: z.boolean().optional().describe("Flag/star"),
    }).describe("Actions to perform on matches"),
    enabled: z.boolean().default(true).describe("Whether the rule is active"),
  },
  async ({ name, conditions, match_mode, actions, enabled }) => {
    try {
      const rule = await ruleManager.createRule({ name, conditions, matchMode: match_mode, actions, enabled });
      return { content: [{ type: "text", text: JSON.stringify(rule, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── List Rules ─────────────────────────────────────────────────────────────
server.tool("list_rules", "List all auto-categorization rules", {}, async () => {
  try {
    const rules = await ruleManager.listRules();
    return { content: [{ type: "text", text: JSON.stringify(rules, null, 2) }] };
  } catch (err: any) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

// ── Delete Rule ────────────────────────────────────────────────────────────
server.tool(
  "delete_rule",
  "Delete an auto-categorization rule by ID",
  { id: z.string().describe("The rule ID to delete") },
  async ({ id }) => {
    try {
      await ruleManager.deleteRule(id);
      return { content: [{ type: "text", text: `Rule ${id} deleted successfully.` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Run Rules ──────────────────────────────────────────────────────────────
server.tool(
  "run_rules",
  "Execute all enabled auto-categorization rules against recent emails in a folder",
  {
    folder: z.string().default("INBOX").describe("Folder to scan"),
    limit: z.number().default(50).describe("Max emails to scan"),
  },
  async ({ folder, limit }) => {
    try {
      const client = await pool.acquire();
      const rules = await ruleManager.listRules();
      const enabledRules = rules.filter((r) => r.enabled);
      if (enabledRules.length === 0) {
        return { content: [{ type: "text", text: "No enabled rules found." }] };
      }
      const { emails } = await listEmails(client, folder, limit);
      const result: RuleExecutionResult = { scanned: emails.length, matched: 0, actions: [], errors: [] };
      for (const email of emails) {
        for (const rule of enabledRules) {
          if (ruleManager.matchesRule(rule, email)) {
            result.matched++;
            try {
              if (rule.actions.markRead) {
                await updateFlags(client, folder, [email.uid], ["\\Seen"], "add");
                result.actions.push({ ruleId: rule.id, ruleName: rule.name, emailUid: email.uid, emailSubject: email.subject, action: "marked as read" });
              }
              if (rule.actions.markFlagged) {
                await updateFlags(client, folder, [email.uid], ["\\Flagged"], "add");
                result.actions.push({ ruleId: rule.id, ruleName: rule.name, emailUid: email.uid, emailSubject: email.subject, action: "flagged" });
              }
              if (rule.actions.moveTo) {
                await moveEmails(client, folder, [email.uid], rule.actions.moveTo);
                result.actions.push({ ruleId: rule.id, ruleName: rule.name, emailUid: email.uid, emailSubject: email.subject, action: `moved to ${rule.actions.moveTo}` });
              }
            } catch (err: any) {
              result.errors.push(`Rule "${rule.name}" on UID ${email.uid}: ${err.message}`);
            }
          }
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: Calendar Event Extraction (1 tool)
// ═══════════════════════════════════════════════════════════════════════════
registerPhase5Tools(server, async () => {
  const client = createImapClient(config);
  await client.connect();
  return client;
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6: Offline Email Sync (2 tools)
// ═══════════════════════════════════════════════════════════════════════════
registerOfflineSyncTools(server, config);

// ═══════════════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Protonmail MCP server v1.6.3 running on stdio — 36 tools loaded");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
