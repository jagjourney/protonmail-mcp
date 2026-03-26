import nodemailer from "nodemailer";
import type { ProtonmailConfig } from "./config.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  inReplyTo?: string;
}

export async function sendEmail(
  config: ProtonmailConfig,
  options: SendEmailOptions
): Promise<{ messageId: string; response: string }> {
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
    tls: {
      rejectUnauthorized: false, // Protonmail Bridge uses self-signed certs
    },
  });

  const result = await transport.sendMail({
    from: config.auth.user,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
    inReplyTo: options.inReplyTo,
  });

  return {
    messageId: result.messageId,
    response: result.response,
  };
}
