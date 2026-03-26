import { ImapFlow } from "imapflow";
import type { ProtonmailConfig } from "./config.js";

export class ImapPool {
  private client: ImapFlow | null = null;
  private config: ProtonmailConfig;
  private connecting: Promise<ImapFlow> | null = null;

  constructor(config: ProtonmailConfig) {
    this.config = config;
  }

  async acquire(): Promise<ImapFlow> {
    // Return existing client if still usable
    if (this.client && this.client.usable) {
      return this.client;
    }

    // If a connection attempt is already in progress, wait for it
    if (this.connecting) {
      return this.connecting;
    }

    // Create a new connection
    this.connecting = this.createAndConnect();
    try {
      const client = await this.connecting;
      return client;
    } finally {
      this.connecting = null;
    }
  }

  private async createAndConnect(): Promise<ImapFlow> {
    const client = new ImapFlow({
      host: this.config.imap.host,
      port: this.config.imap.port,
      secure: this.config.imap.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
      tls: {
        rejectUnauthorized: false, // Protonmail Bridge uses self-signed certs
      },
      logger: false,
    });

    client.on("close", () => {
      this.client = null;
    });

    client.on("error", () => {
      this.client = null;
    });

    await client.connect();
    this.client = client;
    return client;
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // Ignore errors during shutdown
      }
      this.client = null;
    }
  }
}
