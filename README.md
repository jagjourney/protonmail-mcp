# Protonmail MCP Server

A free, open-source **Model Context Protocol (MCP) server** that lets AI assistants like Claude manage your Protonmail inbox. Clean up emails, mark as read, flag spam, send messages, sync offline, and more -- all through natural language.

Built and maintained by **[Jag Journey, LLC](https://jagjourney.ai/about)**.

---

## What It Does

This MCP server connects Claude Desktop (or any MCP-compatible client) to your Protonmail account through [Protonmail Bridge](https://proton.me/mail/bridge). It gives your AI assistant the ability to:

- **Read & browse** your inbox, sent mail, drafts, and custom folders
- **Search** emails by sender, subject, date, body text, or read/flagged status
- **Mark as read/unread** to triage your inbox
- **Flag/star** important emails
- **Move to Spam** or **Trash** unwanted messages
- **Move emails** between any folders or labels
- **Send emails** with plain text or HTML, CC/BCC, and reply threading
- **Manage drafts** -- save, update, and organize draft emails
- **Download attachments** from any email
- **Bulk operations** -- apply actions to hundreds of emails at once
- **Extract contacts** from your inbox and sent folders
- **Email templates** -- save, manage, and send from reusable templates
- **Auto-rules** -- create rules to automatically categorize and sort emails
- **Calendar events** -- extract meeting invites and ICS data from emails
- **Offline sync** -- export your entire mailbox as browsable HTML files
- **Get mailbox stats** for a quick overview of your account
- **Manage folders** -- create, rename, and delete folders
- **Launch** the Protonmail Desktop App

## Prerequisites

1. **Protonmail paid plan** (Mail Plus, Proton Unlimited, etc.)
2. **[Protonmail Bridge](https://proton.me/mail/bridge)** installed and running on your PC
3. **Node.js 18+**

## Quick Start

### Option A: Use with npx (no install needed)

The fastest way -- just add this to your Claude Desktop config and go:

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "protonmail": {
      "command": "npx",
      "args": ["-y", "protonmail-mcp"],
      "env": {
        "PROTONMAIL_USER": "your-email@proton.me",
        "PROTONMAIL_PASS": "your-bridge-password"
      }
    }
  }
}
```

Restart Claude Desktop and you're ready to go. That's it.

### Option B: Install globally via npm

```bash
npm install -g protonmail-mcp
```

Then use in your Claude Desktop config:

```json
{
  "mcpServers": {
    "protonmail": {
      "command": "protonmail-mcp",
      "env": {
        "PROTONMAIL_USER": "your-email@proton.me",
        "PROTONMAIL_PASS": "your-bridge-password"
      }
    }
  }
}
```

### Option C: Clone and build from source

```bash
git clone https://github.com/jagjourney/protonmail-mcp.git
cd protonmail-mcp
npm install
npm run build
```

Then use in your Claude Desktop config:

```json
{
  "mcpServers": {
    "protonmail": {
      "command": "node",
      "args": ["/path/to/protonmail-mcp/dist/index.js"],
      "env": {
        "PROTONMAIL_USER": "your-email@proton.me",
        "PROTONMAIL_PASS": "your-bridge-password"
      }
    }
  }
}
```

## Where Do I Get the Bridge Password?

1. Open **Protonmail Bridge** on your PC
2. Click your account in the sidebar
3. Under **Mailbox details**, find the **Password** field
4. Copy it -- this is your `PROTONMAIL_PASS` (it's different from your regular Protonmail login)

See the full [Installation Guide](docs/INSTALLATION.md) for detailed steps with screenshots.

## Documentation

- **[Installation Guide](docs/INSTALLATION.md)** -- Step-by-step setup instructions
- **[Usage Guide](docs/USAGE.md)** -- How to use with Claude Desktop, all available tools
- **[Why Use This?](docs/WHY-USE-THIS.md)** -- Benefits and use cases

## Available Tools (36)

### Reading & Browsing

| Tool | Description |
|---|---|
| `list_folders` | List all folders with message counts |
| `list_emails` | Browse emails in any folder (paginated) |
| `read_email` | Read full email content |
| `search_emails` | Search by sender, subject, body, dates, status |
| `get_email_stats` | Mailbox overview with counts |

### Email Actions

| Tool | Description |
|---|---|
| `mark_as_read` | Mark emails as read |
| `mark_as_unread` | Mark emails as unread |
| `flag_email` | Star/flag emails |
| `unflag_email` | Remove star/flag |
| `move_to_spam` | Report and move to Spam |
| `move_to_trash` | Move to Trash |
| `move_email` | Move between any folders |
| `permanently_delete` | Permanently delete (irreversible) |

### Sending & Drafts

| Tool | Description |
|---|---|
| `send_email` | Send email with text/HTML, CC/BCC |
| `save_draft` | Save a new draft email |
| `update_draft` | Update an existing draft |

### Folder Management

| Tool | Description |
|---|---|
| `create_folder` | Create a new email folder/label |
| `rename_folder` | Rename an existing folder |
| `delete_folder` | Delete an empty folder |

### Attachments

| Tool | Description |
|---|---|
| `list_attachments` | List all attachments on an email |
| `download_attachment` | Download a specific attachment (base64) |

### Batch Operations

| Tool | Description |
|---|---|
| `bulk_action` | Apply actions to all emails matching a filter |

### Contacts

| Tool | Description |
|---|---|
| `extract_contacts` | Build a contact list from recent emails |

### Email Templates

| Tool | Description |
|---|---|
| `save_template` | Save a reusable email template with {{variables}} |
| `list_templates` | List all saved templates |
| `delete_template` | Delete a template |
| `send_from_template` | Render and send from a template |

### Auto-Categorization Rules

| Tool | Description |
|---|---|
| `create_rule` | Create an auto-sort rule (by sender, subject, etc.) |
| `list_rules` | List all rules |
| `delete_rule` | Delete a rule |
| `run_rules` | Execute all enabled rules against a folder |

### Calendar

| Tool | Description |
|---|---|
| `extract_calendar_events` | Find and parse meeting invites from emails |

### Offline Sync

| Tool | Description |
|---|---|
| `set_offline_sync_dir` | Set the directory for your offline email archive |
| `offline_sync` | Export emails as browsable HTML files |
| `offline_sync_status` | Check sync status and last sync time |

### Utilities

| Tool | Description |
|---|---|
| `launch_protonmail_app` | Open the Protonmail Desktop App |

## Offline Email Sync

Export your entire Protonmail inbox as a beautiful, browsable offline archive. The offline viewer features:

- **Dark-themed inbox UI** that mirrors the Protonmail look and feel
- **Folder navigation** with unread badges
- **Full email rendering** with HTML support
- **Attachment downloads** saved alongside emails
- **Incremental sync** -- only exports new emails on re-run
- **Search and filter** within each folder
- **Works completely offline** -- just open `index.html` in any browser

### How to use

1. Tell Claude: *"Set my offline mailbox directory to C:\Users\Me\Documents\Mailbox"*
2. Then: *"Sync my emails offline"*
3. Open the generated `index.html` in your browser to browse your archive

You can also set the `PROTONMAIL_DATA_DIR` environment variable to customize where sync settings are stored.

## Performance Benchmark

Real-world offline sync test — full mailbox export to browsable HTML with all attachments:

| Metric | Result |
|--------|--------|
| **Emails exported** | 173,352 |
| **Attachments saved** | 169,592 |
| **Folders processed** | 22 |
| **Total time** | **40 minutes 35 seconds** |
| **Throughput** | ~71 emails/second |

**Test machine:**

| Component | Spec |
|-----------|------|
| OS | Windows 11 Pro |
| CPU | Intel Core i7-14650HX (16 cores / 24 threads) |
| RAM | 64 GB DDR5 |
| GPU | NVIDIA GeForce RTX 5060 Laptop |
| Storage | 2TB NVMe SSD (WD Black SN850X) |

All data is read from Protonmail Bridge's local cache on localhost — no internet download required. The bottleneck is MIME parsing + file writing, not bandwidth. Subsequent syncs are incremental (only new emails), completing in seconds.

## Security & Privacy

- All email data stays on your local machine
- Connects only to `127.0.0.1` (Protonmail Bridge on localhost)
- Protonmail's end-to-end encryption is handled by Bridge
- Credentials are stored locally in `.env` or Claude Desktop config (never committed to git)
- No telemetry, no external services, no data collection

## Issues & Support

Found a bug or have a feature request? Open an issue at:
**[github.com/jagjourney/protonmail-mcp/issues](https://github.com/jagjourney/protonmail-mcp/issues)**

## License

MIT License -- see [LICENSE](LICENSE) for details.

## Credits

Built by **[Jag Journey, LLC](https://jagjourney.ai/about)**

---

*This is a community project and is not affiliated with or endorsed by Proton AG.*
