import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ImapFlow } from 'imapflow';
import { extractCalendarEvents } from './phase5-functions.js';

/**
 * Register Phase 5 (Calendar Event Extraction) tools on the MCP server.
 *
 * @param server - The MCP server instance to register tools on
 * @param getClient - A function that returns a connected ImapFlow client
 */
export function registerPhase5Tools(
  server: McpServer,
  getClient: () => Promise<ImapFlow>
): void {
  server.tool(
    'extract_calendar_events',
    'Find and parse calendar events (meeting invites, etc.) from emails. Looks for ICS/iCalendar attachments and inline calendar data.',
    {
      folder: z.string().default('INBOX').describe('Folder to search in'),
      since: z.string().optional().describe('Only check emails on or after this date (YYYY-MM-DD)'),
      limit: z.number().default(50).describe('Max emails to scan'),
    },
    async ({ folder, since, limit }) => {
      try {
        const client = await getClient();
        try {
          const events = await extractCalendarEvents(client, folder, { since, limit });
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ count: events.length, events }, null, 2),
              },
            ],
          };
        } finally {
          await client.logout().catch(() => {});
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
