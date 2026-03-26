# Usage Guide

How to use the Protonmail MCP Server with Claude Desktop to manage your email. 36 tools covering inbox management, offline sync, templates, rules, and more.

## Getting Started

Once installed and configured (see [Installation Guide](INSTALLATION.md)), just talk to Claude in natural language. Claude will automatically use the right tools to help you.

---

## Example Conversations

### Check your inbox

> "Show me my unread emails"

> "What's in my inbox?"

> "How many unread emails do I have?"

> "List the last 50 emails in my inbox"

> "Show me page 3 of my inbox"

### Read specific emails

> "Read the latest email from john@example.com"

> "Show me the email about the project deadline"

> "Open email UID 1234 in my inbox"

> "Read that email and show me the full headers"

### Search your mailbox

> "Find emails from sarah@company.com in the last month"

> "Search for emails about 'invoice' in my inbox"

> "Show me all unread flagged emails"

> "Find emails with 'contract' in the body text from the last 7 days"

> "Search Sent folder for emails to bob@example.com"

> "Find all read emails from before January 2026"

### Triage and clean up

> "Mark all emails from newsletters as read"

> "Mark the last 5 emails as unread"

> "Flag the email from the client as important"

> "Remove the flag from emails 101, 102, and 103"

> "Move those three spam emails to the Spam folder"

> "Move email UID 456 from Inbox to the Archive"

> "Delete all the promotional emails from last week"

> "Permanently delete the emails in my trash" (use with caution)

### Send emails

> "Send an email to bob@example.com about the meeting tomorrow"

> "Send an email to alice@example.com with CC to the team, subject 'Project Update'"

> "Reply to Sarah's email and confirm the meeting time"

> "Send an HTML email to the client with a formatted table"

### Manage drafts

> "Save a draft email to alex@example.com about the Q4 report"

> "Save a draft with subject 'Meeting Notes' and body 'Here are the key takeaways...'"

> "Update my draft (UID 5) to include the new budget numbers"

> "Show me my drafts folder"

### Manage folders

> "What folders do I have?"

> "Create a new folder called Clients"

> "Rename the Projects folder to Active Projects"

> "Delete the empty Old Stuff folder"

Note: Protonmail Bridge has limitations with folder management via IMAP. If create/rename/delete doesn't work, manage folders through the Protonmail web app or desktop client instead.

### Attachments

> "What attachments does the latest email from HR have?"

> "List attachments on email UID 789 in my inbox"

> "Download the PDF from that invoice email"

> "Download attachment #0 from email UID 789 in Inbox"

### Batch operations

> "Mark all newsletters as read"

> "Mark all unread emails from before March 1st as read"

> "Move all emails from noreply@example.com to the Archive folder"

> "Flag all unread emails from this week"

> "Delete all emails from no-reply addresses older than 30 days"

> "Unflag everything in my Starred folder"

### Contacts

> "Show me my frequent contacts"

> "Extract email addresses from my last 100 sent emails"

> "Find contacts with 'smith' in their name or email"

> "Who do I email the most? Scan my Inbox and Sent folders"

> "Show contacts from just my Sent folder, limit to 500 emails"

### Email templates

> "Save a template called 'Weekly Update' with subject 'Weekly Status - {{week}}' and body 'Hi {{name}}, here is the update for {{week}}.'"

> "List my saved templates"

> "Send the Weekly Update template to team@company.com with week set to 'March 24' and name set to 'Team'"

> "Delete the old onboarding template"

> "Save a template called 'Invoice Follow-up' with to '{{client_email}}' and subject 'Invoice #{{invoice_num}} Follow-up'"

> "Send my Invoice Follow-up template with client_email='bob@acme.com' and invoice_num='1234'"

### Auto-categorization rules

> "Create a rule called 'Flag Boss' to flag emails from boss@company.com"

> "Create a rule to move all emails from newsletters@example.com to the Newsletters folder"

> "Create a rule to mark emails as read if they're from noreply@ or no-reply@, using 'any' match mode"

> "List my active rules"

> "Run my rules against the last 100 inbox emails"

> "Delete the old newsletter rule"

### Calendar events

> "Find any meeting invites in my inbox from this week"

> "Extract calendar events from the last 30 days"

> "Scan the last 50 emails for calendar invites"

> "Are there any upcoming events in my recent emails?"

### Offline sync

> "Where is my offline mailbox stored?"

> "Set my offline mailbox directory to D:\Documents\Mailbox"

> "Sync my emails offline"

> "Sync just the INBOX and Sent folders offline"

> "Sync with a limit of 50 emails per folder" (good for testing)

> "What's the status of my offline archive?"

> "How many emails have been synced so far?"

### Mailbox overview

> "Give me a summary of my mailbox"

> "What folders do I have and how many emails are in each?"

> "How many total emails and unread do I have?"

### Open the app

> "Open the Protonmail app"

> "Launch Protonmail Desktop"

---

## All Available Tools (36)

### Reading & Browsing

| Tool | What It Does | Parameters |
|---|---|---|
| **list_folders** | Shows all your folders/labels with message and unread counts | None |
| **list_emails** | Lists emails in a folder, newest first | `folder` (default: INBOX), `limit` (default: 20), `page` (default: 1) |
| **read_email** | Reads the full content of a specific email by UID | `folder` (default: INBOX), `uid` (required) |
| **search_emails** | Searches emails by multiple criteria | `folder`, `from`, `to`, `subject`, `body`, `since` (YYYY-MM-DD), `before` (YYYY-MM-DD), `seen` (true/false), `flagged` (true/false), `limit` |
| **get_email_stats** | Quick overview of all folders with total/unread counts | None |

### Email Actions

| Tool | What It Does | Parameters |
|---|---|---|
| **mark_as_read** | Marks one or more emails as read | `folder` (default: INBOX), `uids` (array of UIDs) |
| **mark_as_unread** | Marks one or more emails as unread | `folder` (default: INBOX), `uids` (array of UIDs) |
| **flag_email** | Stars/flags one or more emails | `folder` (default: INBOX), `uids` (array of UIDs) |
| **unflag_email** | Removes star/flag from one or more emails | `folder` (default: INBOX), `uids` (array of UIDs) |
| **move_to_spam** | Moves emails to the Spam folder | `folder` (default: INBOX), `uids` (array of UIDs) |
| **move_to_trash** | Moves emails to the Trash folder | `folder` (default: INBOX), `uids` (array of UIDs) |
| **move_email** | Moves emails between any two folders | `source_folder`, `uids` (array), `destination_folder` |
| **permanently_delete** | Permanently deletes emails (irreversible) | `folder`, `uids` (array of UIDs) |

### Sending & Drafts

| Tool | What It Does | Parameters |
|---|---|---|
| **send_email** | Composes and sends an email | `to` (required), `subject` (required), `text`, `html`, `cc`, `bcc`, `reply_to`, `in_reply_to` (Message-ID for threading) |
| **save_draft** | Saves a new draft to the Drafts folder | `to` (required), `subject` (required), `text`, `html`, `cc`, `bcc` |
| **update_draft** | Deletes an old draft and saves a replacement | `uid` (required, existing draft UID), `to`, `subject`, `text`, `html`, `cc`, `bcc` |

### Folder Management

| Tool | What It Does | Parameters |
|---|---|---|
| **create_folder** | Creates a new email folder/label | `path` (e.g. "MyFolder" or "Folders/Subfolder") |
| **rename_folder** | Renames an existing folder | `path` (current), `new_path` (new name) |
| **delete_folder** | Deletes an empty folder | `path` |

Note: Protonmail Bridge may not support folder management via IMAP. If these fail, manage folders in the Protonmail web app or desktop client.

### Attachments

| Tool | What It Does | Parameters |
|---|---|---|
| **list_attachments** | Lists all attachments on a specific email | `folder` (default: INBOX), `uid` (required) — returns filename, content type, size, part index |
| **download_attachment** | Downloads a specific attachment as base64 | `folder` (default: INBOX), `uid` (required), `part_index` (0-based, from list_attachments) |

### Batch Operations

| Tool | What It Does | Parameters |
|---|---|---|
| **bulk_action** | Applies an action to all emails matching a filter | `folder` (default: INBOX), `action` (mark_read, mark_unread, flag, unflag, move, delete), `filter` (object with `from`, `to`, `subject`, `body`, `since`, `before`, `seen`, `flagged`), `destination` (required for move action) |

**Bulk action examples:**
- Mark read: `action: "mark_read"`, `filter: { from: "newsletter@" }`
- Move: `action: "move"`, `filter: { subject: "receipt" }`, `destination: "Archive"`
- Flag: `action: "flag"`, `filter: { since: "2026-03-01", seen: false }`
- Delete: `action: "delete"`, `filter: { from: "spam@", before: "2026-01-01" }`

### Contacts

| Tool | What It Does | Parameters |
|---|---|---|
| **extract_contacts** | Scans recent emails to build a contact list | `folders` (array, default: ["INBOX", "Sent"]), `limit` (emails per folder, default: 200), `filter` (name/email substring) |

Returns each contact with: email address, display name, frequency count, last seen date. Sorted by frequency (most contacted first).

### Email Templates

| Tool | What It Does | Parameters |
|---|---|---|
| **save_template** | Saves a reusable email template | `name` (required), `subject` (required, supports `{{var}}`), `text` (supports `{{var}}`), `html`, `to` (supports `{{var}}`), `cc`, `bcc` |
| **list_templates** | Lists all saved email templates | None |
| **delete_template** | Deletes a template by ID | `id` (required) |
| **send_from_template** | Renders a template and sends it | `template_id` (required), `variables` (key-value map), `to` (override), `cc` (override), `bcc` (override) |

**Template variable syntax:** Use `{{variable_name}}` in subject, text, html, or to fields. When sending, provide `variables: { "variable_name": "value" }`. Missing variables are left as `{{variable_name}}` in the output.

### Auto-Categorization Rules

| Tool | What It Does | Parameters |
|---|---|---|
| **create_rule** | Creates an auto-sort rule | `name` (required), `conditions` (object: `from`, `subject`, `to` — all substring match), `match_mode` ("all" = AND, "any" = OR, default: "all"), `actions` (object: `moveTo`, `markRead`, `markFlagged`), `enabled` (default: true) |
| **list_rules** | Lists all auto-categorization rules | None |
| **delete_rule** | Deletes a rule by ID | `id` (required) |
| **run_rules** | Executes all enabled rules against recent emails | `folder` (default: INBOX), `limit` (default: 50) |

**Rule condition matching:** Conditions use case-insensitive substring matching. For example, `from: "newsletter"` matches any sender containing "newsletter". In "all" mode, every condition must match. In "any" mode, at least one must match.

**Rule actions:**
- `moveTo: "Archive"` — Move matching emails to the specified folder
- `markRead: true` — Mark matching emails as read
- `markFlagged: true` — Flag/star matching emails

Multiple actions can be combined in a single rule.

### Calendar

| Tool | What It Does | Parameters |
|---|---|---|
| **extract_calendar_events** | Scans emails for ICS/iCalendar meeting invites | `folder` (default: INBOX), `since` (YYYY-MM-DD, optional), `limit` (default: 50) |

Returns structured event data: summary, start/end times, location, organizer, attendees with RSVP status, and the source email it was found in.

### Offline Sync

| Tool | What It Does | Parameters |
|---|---|---|
| **set_offline_sync_dir** | Configures where your offline archive is stored | `directory` (required, full path) |
| **offline_sync** | Exports emails as browsable HTML files | `output_dir` (optional, uses saved dir), `folders` (optional, defaults to all), `limit` (optional, max per folder), `batch_size` (default: 50) |
| **offline_sync_status** | Shows sync progress and folder counts | `output_dir` (optional, uses saved dir) |

**How offline sync works:**
1. First, set your mailbox directory with `set_offline_sync_dir`
2. Run `offline_sync` to export all emails as HTML files with attachments
3. Open `index.html` in your browser for a full inbox-style viewer (dark theme, searchable, with attachment downloads)
4. Run `offline_sync` again anytime — it only downloads new emails since last sync (incremental)

**Output structure:**
```
Your-Mailbox-Folder/
  index.html           -- Main viewer with folder sidebar
  assets/style.css     -- Dark theme styling
  INBOX/
    index.html         -- Email list (searchable)
    000001_2026-03-26_Email-Subject.html
    000001_attachments/
      invoice.pdf
      photo.jpg
    000002_2026-03-25_Another-Email.html
  Sent/
    index.html
    ...
  sync-state.json      -- Tracks what's been synced
```

### Utilities

| Tool | What It Does | Parameters |
|---|---|---|
| **launch_protonmail_app** | Opens the Protonmail Desktop application | None |

---

## Tips

- **Protonmail Bridge must be running** whenever you use these tools. If Bridge is closed, you'll get connection errors.
- **Folder names** vary by account. Use `list_folders` to see your exact folder names before moving emails.
- **UIDs** are unique identifiers for emails within a folder. Claude handles these automatically when you describe which emails you want to act on.
- **Batch operations** work on multiple emails at once. You can say things like "mark the last 10 emails as read" and Claude will handle it.
- **Permanent delete is irreversible.** Claude will typically confirm before using this tool. Prefer `move_to_trash` for safe deletion.
- **Templates** support `{{variable}}` placeholders in subject, body, and recipient fields. Define them once, then send with different values each time.
- **Rules** use case-insensitive substring matching and support AND ("all") / OR ("any") logic. Actions include move to folder, mark as read, and flag.
- **Offline sync** is incremental -- it only downloads new emails on subsequent runs, making re-syncs fast. All data reads from Protonmail Bridge's local cache (no internet download).
- **Attachments** are downloaded as base64-encoded strings via the MCP tool, or saved as real files on disk via offline sync.
- **Calendar extraction** looks for ICS/iCalendar data inside emails (meeting invites, event RSVPs, etc.).

## Common Folder Names

| Folder | Description |
|---|---|
| `INBOX` | Your main inbox |
| `Sent` | Sent emails |
| `Drafts` | Draft emails |
| `Trash` | Deleted emails |
| `Spam` | Spam/junk mail |
| `Archive` | Archived emails |
| `Starred` | Flagged/starred emails |
| `All Mail` | All emails across folders |

Your account may also have custom folders and labels that appear as additional entries.

## Need Help?

Open an issue at **[github.com/jagjourney/protonmail-mcp/issues](https://github.com/jagjourney/protonmail-mcp/issues)**.

---

Built by **[Jag Journey, LLC](https://jagjourney.ai/about)**
