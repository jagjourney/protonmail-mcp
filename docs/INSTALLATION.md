# Installation Guide

Step-by-step instructions to get the Protonmail MCP Server running with Claude Desktop.

## Step 1: Install Protonmail Bridge

Protonmail Bridge is a desktop application from Proton that creates a local IMAP/SMTP server on your computer. This is what allows the MCP server to access your encrypted emails.

1. Go to **[https://proton.me/mail/bridge](https://proton.me/mail/bridge)**
2. Download and install for your operating system (Windows, macOS, or Linux)
3. Open Protonmail Bridge and **sign in** with your Protonmail account
4. Wait for the initial sync to complete (this may take a while depending on mailbox size)

> **Note:** Protonmail Bridge requires a **paid Protonmail plan** (Mail Plus, Proton Unlimited, etc.). Free accounts cannot use Bridge.

## Step 2: Get Your Bridge Credentials

Once signed in to Protonmail Bridge:

1. Click on your account in the Bridge sidebar
2. Look for the **Mailbox details** section
3. You'll see two cards: **IMAP** and **SMTP**
4. Note these values:
   - **Username** (your email address)
   - **Password** (this is a Bridge-specific password, NOT your regular Protonmail password)
   - **IMAP Port** (typically `1143`)
   - **SMTP Port** (typically `1025` or `1026`)

> **Important:** The Bridge password is different from your Protonmail login password. Always use the Bridge password for this MCP server.

## Step 3: Install the MCP Server

Pick whichever method you prefer -- they all work the same.

### Option A: npx (no install needed -- recommended)

Skip straight to Step 4. With `npx`, there's nothing to install. Claude Desktop downloads and runs it automatically each time.

### Option B: Install globally via npm

```bash
npm install -g protonmail-mcp
```

That's it. The `protonmail-mcp` command is now available system-wide.

### Option C: Clone from source

```bash
git clone https://github.com/jagjourney/protonmail-mcp.git
cd protonmail-mcp
npm install
npm run build
```

## Step 4: Add to Claude Desktop

Open your Claude Desktop configuration file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the protonmail server to the `mcpServers` section. Use the config that matches your install method:

### If you used npx (Option A):

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

### If you installed globally (Option B):

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

### If you cloned from source (Option C):

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

Replace `/path/to/protonmail-mcp` with the actual path where you cloned the project.

### Optional: Custom Bridge Ports

If your Protonmail Bridge uses non-default ports, add them to the `env` section:

```json
"env": {
  "PROTONMAIL_USER": "your-email@proton.me",
  "PROTONMAIL_PASS": "your-bridge-password",
  "PROTONMAIL_IMAP_PORT": "1143",
  "PROTONMAIL_SMTP_PORT": "1026"
}
```

### Optional: Custom Data Directory

The MCP server stores settings (templates, rules, sync preferences) in a local data directory. By default this is `~/.protonmail-mcp`. To customize it, add the `PROTONMAIL_DATA_DIR` environment variable:

```json
"env": {
  "PROTONMAIL_USER": "your-email@proton.me",
  "PROTONMAIL_PASS": "your-bridge-password",
  "PROTONMAIL_DATA_DIR": "C:\\Users\\YourUser\\Documents\\protonmail-data"
}
```

This directory stores:
- Email templates
- Auto-categorization rules
- Offline sync settings

## All Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PROTONMAIL_USER` | Yes | — | Your Protonmail email address (Bridge username) |
| `PROTONMAIL_PASS` | Yes | — | Your Protonmail Bridge password (NOT your regular password) |
| `PROTONMAIL_IMAP_HOST` | No | `127.0.0.1` | IMAP server host |
| `PROTONMAIL_IMAP_PORT` | No | `1143` | IMAP server port |
| `PROTONMAIL_IMAP_SECURE` | No | `false` | Use TLS for IMAP (Bridge uses STARTTLS, not direct TLS) |
| `PROTONMAIL_SMTP_HOST` | No | `127.0.0.1` | SMTP server host |
| `PROTONMAIL_SMTP_PORT` | No | `1026` | SMTP server port |
| `PROTONMAIL_SMTP_SECURE` | No | `false` | Use TLS for SMTP |
| `PROTONMAIL_APP_PATH` | No | Auto-detected | Path to Protonmail Desktop App executable |
| `PROTONMAIL_DATA_DIR` | No | `~/.protonmail-mcp` | Directory for templates, rules, sync settings |

## Using with Other MCP Clients

This server works with any MCP-compatible client, not just Claude Desktop. The server communicates over **stdio** (standard input/output) using the Model Context Protocol.

**Claude Code (CLI):**
```bash
claude mcp add protonmail -- node /path/to/protonmail-mcp/dist/index.js
```

**Generic MCP client:**
```bash
# The server reads from stdin and writes to stdout (JSON-RPC)
PROTONMAIL_USER=you@proton.me PROTONMAIL_PASS=bridge-password node dist/index.js
```

## Step 5: Restart and Verify

1. **Make sure Protonmail Bridge is running** (it must be running whenever you want to use the MCP server)
2. **Restart Claude Desktop** to pick up the new MCP configuration
3. In Claude Desktop, try asking: *"List my email folders"* or *"Show me my unread emails"*

If everything is connected, Claude will show your Protonmail folders and emails.

## Troubleshooting

### "Connection refused" error
- Protonmail Bridge must be **running** in the background
- Check that the IMAP/SMTP ports match what Bridge shows in its settings

### "Authentication failed" error
- Make sure you're using the **Bridge password**, not your regular Protonmail password
- Copy the password directly from Bridge to avoid typos

### "Cannot find module" error
- If using source install, make sure you ran `npm run build`
- If using npx, try clearing the cache: `npx clear-npx-cache` then retry

### Claude doesn't show Protonmail tools
- Restart Claude Desktop after editing the config
- Check that the JSON in `claude_desktop_config.json` is valid (no trailing commas, etc.)

### npx is slow on first run
- The first time npx downloads the package, it may take 10-20 seconds. Subsequent runs use the cache and are faster.
- If you want instant startup, use `npm install -g protonmail-mcp` instead.

### Still stuck?

Open an issue at **[github.com/jagjourney/protonmail-mcp/issues](https://github.com/jagjourney/protonmail-mcp/issues)** and we'll help you out.

---

Built by **[Jag Journey, LLC](https://jagjourney.ai/about)**
