import dotenv from "dotenv";
import { join } from "path";
dotenv.config();

export interface ProtonmailConfig {
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
  auth: {
    user: string;
    pass: string;
  };
  desktopAppPath: string;
  dataDir: string;
}

export function loadConfig(): ProtonmailConfig {
  const user = process.env.PROTONMAIL_USER;
  const pass = process.env.PROTONMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      "PROTONMAIL_USER and PROTONMAIL_PASS environment variables are required. " +
        "These are your Protonmail Bridge credentials (not your regular Protonmail password)."
    );
  }

  return {
    imap: {
      host: process.env.PROTONMAIL_IMAP_HOST || "127.0.0.1",
      port: parseInt(process.env.PROTONMAIL_IMAP_PORT || "1143", 10),
      secure: process.env.PROTONMAIL_IMAP_SECURE === "true",
    },
    smtp: {
      host: process.env.PROTONMAIL_SMTP_HOST || "127.0.0.1",
      port: parseInt(process.env.PROTONMAIL_SMTP_PORT || "1026", 10),
      secure: process.env.PROTONMAIL_SMTP_SECURE === "true",
    },
    auth: { user, pass },
    desktopAppPath:
      process.env.PROTONMAIL_APP_PATH ||
      (process.env.LOCALAPPDATA
        ? `${process.env.LOCALAPPDATA}\\proton_mail\\Proton Mail.exe`
        : ""),
    dataDir:
      process.env.PROTONMAIL_DATA_DIR ||
      join(process.env.HOME || process.env.USERPROFILE || '.', '.protonmail-mcp'),
  };
}
