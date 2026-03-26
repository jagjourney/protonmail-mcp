// html-templates.ts — Pure HTML/CSS template generation for offline email viewer.
// No I/O. Every export is a function that returns a string.

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface FolderSyncInfo {
  name: string;
  path: string;       // sanitized directory name
  totalSynced: number;
  unread: number;
}

export interface SyncedEmail {
  seq: number;
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  attachmentCount: number;
  filename: string;    // HTML filename for this email
}

export interface SyncedEmailFull extends SyncedEmail {
  cc: string;
  bcc: string;
  messageId: string;
  htmlBody: string;
  textBody: string;
  attachments: { filename: string; savedAs: string; contentType: string; size: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape HTML-special characters to prevent XSS. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format byte size into a human-readable string. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// generateStyleCss
// ---------------------------------------------------------------------------

export function generateStyleCss(): string {
  return `/* Protonmail Offline Viewer — generated stylesheet */
:root {
  --bg: #1c1b22;
  --sidebar-bg: #292733;
  --accent: #6d4aff;
  --accent-hover: #7c5cff;
  --text: #e8e6ed;
  --muted: #8f8b9e;
  --border: #3b3849;
  --row-hover: #33303f;
  --unread-text: #ffffff;
  --flagged-star: #f5c518;
  --link: #9b8aff;
  --danger: #f04747;
  --success: #43b581;
  --input-bg: #33303f;
  --card-bg: #24222d;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
}

a {
  color: var(--link);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
  color: var(--accent-hover);
}

/* ---- Layout (main index) ---- */

.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ---- Sidebar ---- */

.sidebar {
  width: 240px;
  min-width: 240px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 20px 16px 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.3px;
}

.sidebar-header .logo-accent {
  color: var(--accent);
}

.sidebar ul {
  list-style: none;
  padding: 8px 0;
}

.sidebar li a {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
  font-size: 13px;
}

.sidebar li a:hover,
.sidebar li a.active {
  background: rgba(109, 74, 255, 0.1);
  color: var(--text);
  text-decoration: none;
}

.sidebar .folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar .badge {
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  margin-left: 8px;
  min-width: 22px;
  text-align: center;
}

.sidebar .badge.muted {
  background: var(--border);
  color: var(--muted);
}

.sidebar-footer {
  margin-top: auto;
  padding: 12px 16px;
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  text-align: center;
}

/* ---- Content frame ---- */

.content-frame {
  flex: 1;
  border: none;
  background: var(--bg);
}

/* ---- Email list (folder index) ---- */

.email-list-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px;
}

.email-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.email-list-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}

.email-list-header .count {
  color: var(--muted);
  font-weight: 400;
  font-size: 14px;
  margin-left: 8px;
}

.search-bar {
  display: flex;
  align-items: center;
}

.search-bar input {
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 14px;
  color: var(--text);
  font-size: 13px;
  width: 280px;
  outline: none;
  transition: border-color 0.15s;
}

.search-bar input::placeholder {
  color: var(--muted);
}

.search-bar input:focus {
  border-color: var(--accent);
}

/* ---- Email table ---- */

.email-list {
  width: 100%;
  border-collapse: collapse;
}

.email-list thead th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.email-list thead th.col-star { width: 32px; text-align: center; }
.email-list thead th.col-attach { width: 48px; text-align: center; }
.email-list thead th.col-date { width: 140px; }
.email-list thead th.col-from { width: 200px; }

.email-row {
  transition: background 0.1s;
  cursor: default;
}

.email-row td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 13px;
  vertical-align: middle;
}

.email-row:hover {
  background: var(--row-hover);
}

.email-row.unread td {
  color: var(--unread-text);
  font-weight: 600;
}

.email-row .star {
  text-align: center;
  font-size: 15px;
  color: var(--border);
}

.email-row.flagged .star {
  color: var(--flagged-star);
}

.email-row .attach {
  text-align: center;
  font-size: 13px;
}

.email-row .subject-link {
  color: inherit;
}
.email-row .subject-link:hover {
  color: var(--accent);
  text-decoration: underline;
}

.email-row .date-cell {
  white-space: nowrap;
  font-size: 12px;
}

.load-more-wrap {
  text-align: center;
  padding: 20px 0;
}

.load-more-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 28px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.load-more-btn:hover {
  background: var(--accent-hover);
}

/* ---- Email viewer (single email page) ---- */

.email-viewer {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 20px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 20px;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.back-btn:hover {
  background: var(--row-hover);
  color: var(--text);
  text-decoration: none;
}

.email-viewer h1 {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 16px;
  line-height: 1.35;
}

.email-header {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.email-header .header-row {
  display: flex;
  margin-bottom: 6px;
  font-size: 13px;
}

.email-header .header-row:last-child {
  margin-bottom: 0;
}

.email-header .header-label {
  color: var(--muted);
  min-width: 80px;
  font-weight: 600;
}

.email-header .header-value {
  color: var(--text);
  word-break: break-word;
}

.email-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 20px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.email-meta .meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ---- Email body ---- */

.email-body {
  background: #ffffff;
  color: #1a1a1a;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
  overflow-x: auto;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.6;
}

.email-body pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
  font-size: 13px;
  color: #1a1a1a;
}

.email-body img {
  max-width: 100%;
  height: auto;
}

/* ---- Attachments ---- */

.attachment-list {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.attachment-list h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.attachment-list ul {
  list-style: none;
}

.attachment-list li {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.attachment-list li:last-child {
  border-bottom: none;
}

.attachment-list li a {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--link);
}

.attachment-list .att-size {
  color: var(--muted);
  font-size: 12px;
}

/* ---- Responsive ---- */

@media (max-width: 768px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
  }

  .email-list-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-bar input {
    width: 100%;
  }

  .email-list thead th.col-from {
    display: none;
  }
  .email-list tbody td:nth-child(3) {
    display: none;
  }

  .email-viewer {
    padding: 16px 12px;
  }

  .email-header .header-row {
    flex-direction: column;
  }

  .email-header .header-label {
    min-width: unset;
    margin-bottom: 2px;
  }
}

@media (max-width: 520px) {
  .layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    min-width: unset;
    max-height: 160px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .sidebar ul {
    display: flex;
    flex-wrap: wrap;
    padding: 4px;
  }

  .sidebar li a {
    padding: 6px 12px;
  }

  .email-list thead th.col-date {
    display: none;
  }
  .email-list tbody td:last-child {
    display: none;
  }
}
`;
}

// ---------------------------------------------------------------------------
// generateMainIndexHtml
// ---------------------------------------------------------------------------

export function generateMainIndexHtml(folders: FolderSyncInfo[]): string {
  const defaultSrc = folders.length > 0 ? `${escapeHtml(folders[0].path)}/index.html` : '';

  const folderItems = folders.map((f, i) => {
    const href = `${escapeHtml(f.path)}/index.html`;
    const activeClass = i === 0 ? ' class="active"' : '';
    const badge = f.unread > 0
      ? `<span class="badge">${f.unread}</span>`
      : `<span class="badge muted">${f.totalSynced}</span>`;
    return `        <li><a href="${href}" target="content"${activeClass}><span class="folder-name">${escapeHtml(f.name)}</span>${badge}</a></li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Protonmail Offline Viewer</title>
  <link rel="stylesheet" href="assets/style.css">
  <style>
    /* Inline overrides for index frame layout */
    html, body { overflow: hidden; }
  </style>
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-header"><span class="logo-accent">Proton</span>mail</div>
      <ul>
${folderItems}
      </ul>
      <div class="sidebar-footer">Synced by Protonmail MCP Server</div>
    </nav>
    <iframe name="content" class="content-frame" src="${defaultSrc}"></iframe>
  </div>
  <script>
    // Highlight active folder link
    document.querySelectorAll('.sidebar a').forEach(function(link) {
      link.addEventListener('click', function() {
        document.querySelectorAll('.sidebar a').forEach(function(l) { l.classList.remove('active'); });
        this.classList.add('active');
      });
    });
  </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// generateFolderIndexHtml
// ---------------------------------------------------------------------------

export function generateFolderIndexHtml(folderName: string, emails: SyncedEmail[]): string {
  const PAGE_SIZE = 500;
  const needsPagination = emails.length > PAGE_SIZE;

  const rows = emails.map((e, i) => {
    const classes: string[] = ['email-row'];
    if (!e.seen) classes.push('unread');
    if (e.flagged) classes.push('flagged');

    const hiddenAttr = needsPagination && i >= PAGE_SIZE ? ' style="display:none" data-page="hidden"' : '';

    const star = e.flagged ? '\u2605' : '\u2606';
    const attach = e.attachmentCount > 0
      ? `\uD83D\uDCCE\u00A0${e.attachmentCount}`
      : '';

    return `      <tr class="${classes.join(' ')}"${hiddenAttr}>
        <td class="star">${star}</td>
        <td>${escapeHtml(e.from)}</td>
        <td><a class="subject-link" href="${escapeHtml(e.filename)}">${escapeHtml(e.subject || '(no subject)')}</a></td>
        <td class="attach">${attach}</td>
        <td class="date-cell">${escapeHtml(e.date)}</td>
      </tr>`;
  }).join('\n');

  const loadMoreHtml = needsPagination ? `
    <div class="load-more-wrap" id="load-more-wrap">
      <button class="load-more-btn" id="load-more-btn">Load more emails</button>
    </div>` : '';

  const paginationScript = needsPagination ? `
    // Pagination
    (function() {
      var PAGE_SIZE = ${PAGE_SIZE};
      var hiddenRows = document.querySelectorAll('tr[data-page="hidden"]');
      var idx = 0;
      var btn = document.getElementById('load-more-btn');
      var wrap = document.getElementById('load-more-wrap');
      btn.addEventListener('click', function() {
        var end = Math.min(idx + PAGE_SIZE, hiddenRows.length);
        for (var i = idx; i < end; i++) {
          hiddenRows[i].style.display = '';
          hiddenRows[i].removeAttribute('data-page');
        }
        idx = end;
        if (idx >= hiddenRows.length) {
          wrap.style.display = 'none';
        }
      });
    })();` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(folderName)}</title>
  <link rel="stylesheet" href="../assets/style.css">
</head>
<body>
  <div class="email-list-container">
    <div class="email-list-header">
      <h1>${escapeHtml(folderName)}<span class="count">(${emails.length})</span></h1>
      <div class="search-bar">
        <input type="text" id="search" placeholder="Filter emails\u2026" autocomplete="off">
      </div>
    </div>

    <table class="email-list">
      <thead>
        <tr>
          <th class="col-star"></th>
          <th class="col-from">From</th>
          <th>Subject</th>
          <th class="col-attach"></th>
          <th class="col-date">Date</th>
        </tr>
      </thead>
      <tbody id="email-tbody">
${rows}
      </tbody>
    </table>
${loadMoreHtml}
  </div>

  <script>
    // Search / filter
    document.getElementById('search').addEventListener('input', function() {
      var query = this.value.toLowerCase();
      var rows = document.querySelectorAll('#email-tbody .email-row');
      for (var i = 0; i < rows.length; i++) {
        var text = rows[i].textContent.toLowerCase();
        rows[i].style.display = text.indexOf(query) !== -1 ? '' : 'none';
      }
      // hide load-more when filtering
      var wrap = document.getElementById('load-more-wrap');
      if (wrap) wrap.style.display = query ? 'none' : '';
    });
${paginationScript}
  </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// generateEmailPageHtml
// ---------------------------------------------------------------------------

export function generateEmailPageHtml(email: SyncedEmailFull, folderName: string): string {
  // Build header rows
  const headerRows: string[] = [];
  headerRows.push(headerRow('From', email.from));
  headerRows.push(headerRow('To', email.to));
  if (email.cc) {
    headerRows.push(headerRow('Cc', email.cc));
  }
  if (email.bcc) {
    headerRows.push(headerRow('Bcc', email.bcc));
  }
  headerRows.push(headerRow('Date', email.date));

  // Metadata bar
  const metaItems: string[] = [];
  if (email.messageId) {
    metaItems.push(`<span class="meta-item">Message-ID: ${escapeHtml(email.messageId)}</span>`);
  }
  if (!email.seen) {
    metaItems.push('<span class="meta-item">Unread</span>');
  }
  if (email.flagged) {
    metaItems.push('<span class="meta-item">\u2605 Flagged</span>');
  }

  const metaBar = metaItems.length > 0
    ? `    <div class="email-meta">\n      ${metaItems.join('\n      ')}\n    </div>`
    : '';

  // Body
  let bodyHtml: string;
  if (email.htmlBody) {
    // Render HTML body. We escape nothing here because it IS html — but we
    // wrap it in a scoped container.  The CSS class .email-body already
    // provides baseline isolation.
    bodyHtml = `    <div class="email-body">\n${email.htmlBody}\n    </div>`;
  } else if (email.textBody) {
    bodyHtml = `    <div class="email-body"><pre>${escapeHtml(email.textBody)}</pre></div>`;
  } else {
    bodyHtml = '    <div class="email-body"><p style="color:var(--muted)">(no body)</p></div>';
  }

  // Attachments
  let attachmentHtml = '';
  if (email.attachments && email.attachments.length > 0) {
    const items = email.attachments.map(att => {
      const paddedSeq = String(email.seq).padStart(6, '0');
      const href = `${paddedSeq}_attachments/${escapeHtml(att.savedAs)}`;
      return `        <li><a href="${href}">\uD83D\uDCCE ${escapeHtml(att.filename)} <span class="att-size">(${formatSize(att.size)})</span></a></li>`;
    }).join('\n');

    attachmentHtml = `
    <div class="attachment-list">
      <h3>Attachments (${email.attachments.length})</h3>
      <ul>
${items}
      </ul>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(email.subject || '(no subject)')}</title>
  <link rel="stylesheet" href="../assets/style.css">
</head>
<body>
  <div class="email-viewer">
    <a href="index.html" class="back-btn">\u2190 Back to ${escapeHtml(folderName)}</a>

    <h1>${escapeHtml(email.subject || '(no subject)')}</h1>

    <div class="email-header">
${headerRows.join('\n')}
    </div>

${metaBar}

${bodyHtml}
${attachmentHtml}
  </div>
</body>
</html>
`;
}

/** Small helper to build a single header row. */
function headerRow(label: string, value: string): string {
  return `      <div class="header-row"><span class="header-label">${label}</span><span class="header-value">${escapeHtml(value)}</span></div>`;
}
