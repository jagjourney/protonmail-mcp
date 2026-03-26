# Changelog

All notable changes to the Protonmail MCP Server are documented here.

## [1.6.3] - 2026-03-26

### Added
- **Offline Email Sync** — Export your entire mailbox as browsable HTML files with a full inbox-style viewer
  - `set_offline_sync_dir` — Configure where your offline archive is stored
  - `offline_sync` — Export emails with incremental sync (only downloads new emails on re-run)
  - `offline_sync_status` — Check sync progress and folder counts
  - ProtonMail-inspired dark theme with searchable email lists
  - Inline image rewriting (CID references converted to local files)
  - All attachments saved to disk (PDFs, images, documents, etc.)

### Fixed
- Attachment download links now use correct padded sequence numbers
- Email body CSS improved — white background for HTML emails, readable text
- Folder management tools return helpful error messages (Bridge limitation)

## [1.5.0] - 2026-03-26

### Added
- **Connection Pooling** — Single persistent IMAP connection with auto-reconnect
- **Folder Management** — `create_folder`, `rename_folder`, `delete_folder`
- **Draft Management** — `save_draft`, `update_draft` via IMAP APPEND
- **Attachment Download** — `list_attachments`, `download_attachment` (base64)
- **Batch Operations** — `bulk_action` for mark read/flag/move/delete by filter
- **Contact Extraction** — `extract_contacts` scans recent emails for addresses
- **Email Templates** — `save_template`, `list_templates`, `delete_template`, `send_from_template` with `{{variable}}` placeholders
- **Auto-Categorization Rules** — `create_rule`, `list_rules`, `delete_rule`, `run_rules` with condition matching
- **Calendar Extraction** — `extract_calendar_events` parses ICS/iCalendar data from emails
- Proper MIME parsing via `mailparser` (replaces fragile regex extraction)
- Full test suite (38 integration tests)

## [1.0.0] - 2026-03-25

### Added
- Initial release with 15 core email management tools
- `list_folders` — List all folders with message counts
- `list_emails` — Browse emails in any folder (paginated)
- `read_email` — Read full email content
- `search_emails` — Search by sender, subject, body, dates, status
- `mark_as_read` / `mark_as_unread` — Read status management
- `flag_email` / `unflag_email` — Star/flag management
- `move_to_spam` / `move_to_trash` / `move_email` — Move between folders
- `permanently_delete` — Irreversible deletion
- `send_email` — Send with text/HTML, CC/BCC, reply threading
- `get_email_stats` — Mailbox overview with counts
- `launch_protonmail_app` — Open Protonmail Desktop App
- Connects to Protonmail Bridge via localhost IMAP/SMTP
- Workaround for Protonmail Bridge UID FETCH limitation

### Fixed
- `readEmail` and `searchEmails` — Resolve UIDs to sequence numbers for Bridge compatibility
