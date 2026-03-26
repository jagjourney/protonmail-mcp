import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { ProtonmailConfig } from "./config.js";
import { runOfflineSync, getSyncStatus } from "./offline-sync.js";

// Persistent preference for sync directory
async function loadSyncDir(dataDir: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(dataDir, "sync-settings.json"), "utf-8");
    const settings = JSON.parse(raw);
    return settings.syncDir || null;
  } catch {
    return null;
  }
}

async function saveSyncDir(dataDir: string, syncDir: string): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    path.join(dataDir, "sync-settings.json"),
    JSON.stringify({ syncDir, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

export function registerOfflineSyncTools(
  server: McpServer,
  config: ProtonmailConfig
): void {
  // Tool 1: set_offline_sync_dir
  server.tool(
    "set_offline_sync_dir",
    "Set where your offline email archive is stored. Ask the user: 'Where would you like to store your Offline Mailbox?' This must be configured before running offline_sync for the first time.",
    {
      directory: z.string().describe("Full path to the offline mailbox folder (e.g., C:\\Users\\YourName\\Documents\\Mailbox)"),
    },
    async ({ directory }) => {
      try {
        // Normalize path
        const normalizedDir = path.resolve(directory);
        await saveSyncDir(config.dataDir, normalizedDir);
        return {
          content: [{
            type: "text" as const,
            text: `Offline mailbox directory set to: ${normalizedDir}\n\nYou can now run offline_sync to export your emails.\nTo view your archive, open: ${normalizedDir}\\index.html`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // Tool 2: offline_sync
  server.tool(
    "offline_sync",
    "Export emails as browsable HTML files with a full inbox-style offline viewer. Reads from Protonmail Bridge's local cache and writes HTML pages + attachments to your configured offline mailbox directory. Supports incremental sync — only exports new emails on re-run. If no directory is configured yet, ask the user where they want to store their Offline Mailbox and use set_offline_sync_dir first.",
    {
      output_dir: z.string().optional().describe("Override the saved directory (optional — uses the configured directory by default)"),
      folders: z.array(z.string()).optional().describe("Specific folders to sync (defaults to all folders)"),
      limit: z.number().optional().describe("Max emails per folder (useful for testing, e.g., 10)"),
      batch_size: z.number().optional().default(50).describe("Emails per fetch batch (default 50)"),
    },
    async ({ output_dir, folders, limit, batch_size }) => {
      try {
        // Resolve output directory: explicit param > saved preference
        let dir = output_dir || null;
        if (!dir) {
          dir = await loadSyncDir(config.dataDir);
        }
        if (!dir) {
          return {
            content: [{
              type: "text" as const,
              text: "No offline mailbox directory configured yet.\n\nPlease ask the user: \"Where would you like to store your Offline Mailbox?\"\nThen use set_offline_sync_dir to save their choice before running offline_sync.",
            }],
            isError: true,
          };
        }

        const result = await runOfflineSync(config, dir, {
          folders,
          limit,
          batchSize: batch_size,
        });

        let text = `Offline sync complete!\n\n`;
        text += `Folders processed: ${result.foldersProcessed}\n`;
        text += `Emails synced: ${result.emailsSynced}\n`;
        text += `Attachments saved: ${result.attachmentsSaved}\n`;
        text += `Duration: ${result.duration}\n`;
        text += `Output: ${dir}\n\n`;

        if (result.folderDetails.length > 0) {
          text += `Per-folder breakdown:\n`;
          for (const fd of result.folderDetails) {
            text += `  ${fd.folder}: ${fd.synced} new (${fd.total} total)\n`;
          }
        }

        if (result.errors.length > 0) {
          text += `\nErrors (${result.errors.length}):\n`;
          for (const err of result.errors) {
            text += `  - ${err}\n`;
          }
        }

        text += `\nOpen ${dir}\\index.html in a browser to view your emails offline.`;

        return { content: [{ type: "text" as const, text }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // Tool 3: offline_sync_status
  server.tool(
    "offline_sync_status",
    "Check the status of your offline email archive. Shows synced folder counts, last sync times, and the configured directory.",
    {
      output_dir: z.string().optional().describe("Override directory to check (optional — uses configured directory by default)"),
    },
    async ({ output_dir }) => {
      try {
        let dir = output_dir || null;
        if (!dir) {
          dir = await loadSyncDir(config.dataDir);
        }
        if (!dir) {
          return {
            content: [{
              type: "text" as const,
              text: "No offline mailbox directory configured. Use set_offline_sync_dir first.",
            }],
            isError: true,
          };
        }

        const status = await getSyncStatus(dir);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ directory: dir, ...status }, null, 2),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
