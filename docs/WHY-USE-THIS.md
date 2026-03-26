# Why Use the Protonmail MCP Server?

## The Problem

Email management is time-consuming. Between newsletters, notifications, spam, and actual important messages, your inbox fills up fast. Protonmail keeps your email private and encrypted, but managing a large inbox still requires manual effort.

## The Solution

The Protonmail MCP Server lets you use Claude as your email assistant. Instead of clicking through hundreds of emails one by one, you can just tell Claude what you want done:

- *"Mark all newsletters from this week as read"*
- *"Move anything from noreply addresses to archive"*
- *"Show me only the unread emails from real people"*
- *"Flag anything that mentions an invoice or payment"*

Claude understands context and can help you make smart decisions about your inbox.

## Key Benefits

### Natural Language Email Management
No more repetitive clicking. Describe what you want in plain English and Claude handles the rest. Say "clean up my inbox" and Claude will help you triage, categorize, and organize.

### Privacy First
- Your emails are **never sent to external servers** beyond Protonmail's own infrastructure
- The MCP server runs **entirely on your local machine**
- All connections go through `127.0.0.1` (localhost) to Protonmail Bridge
- Protonmail's **end-to-end encryption** is preserved -- Bridge handles decryption locally
- **No telemetry, no tracking, no data collection**

### Free and Open Source
This tool is completely free. No subscriptions, no premium tiers, no hidden costs. The source code is open for anyone to audit, fork, or contribute to.

### Works With What You Have
- Uses **Protonmail Bridge**, the official tool from Proton for email client access
- Works with **Claude Desktop** on Windows, macOS, and Linux
- Compatible with any **MCP-enabled AI client**
- No special browser extensions or plugins needed

### Batch Operations
Handle dozens or hundreds of emails at once. Claude can iterate through your inbox and apply actions in bulk -- something that would take ages to do manually.

### Smart Search
Search across your entire mailbox by sender, subject, body text, date ranges, and status. Let Claude find the needle in the haystack.

## Who Is This For?

- **Busy professionals** who want to triage their inbox faster
- **Protonmail users** who want AI-assisted email management without sacrificing privacy
- **Anyone** overwhelmed by email volume who wants a smarter way to manage it
- **Developers and power users** who want to extend Claude's capabilities

## What You Need

1. A **paid Protonmail account** (required for Bridge)
2. **Protonmail Bridge** installed on your PC
3. **Claude Desktop** (free) or another MCP-compatible client
4. **Node.js 18+** to run the server

That's it. Setup takes about 10 minutes.

## Questions or Issues?

Open an issue at **[github.com/jagjourney/protonmail-mcp/issues](https://github.com/jagjourney/protonmail-mcp/issues)**.

---

Built by **[Jag Journey, LLC](https://jagjourney.ai/about)**
