import { simpleParser, type ParsedMail } from "mailparser";

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  partId: string;
  contentId?: string;
}

/**
 * Parse raw email source and extract text body, html body, and attachment metadata.
 */
export async function parseEmailSource(source: Buffer | string): Promise<{
  text: string;
  html: string;
  attachments: AttachmentInfo[];
}> {
  const parsed: ParsedMail = await simpleParser(source);

  const attachments: AttachmentInfo[] = (parsed.attachments || []).map(
    (att, index) => ({
      filename: att.filename || `attachment-${index}`,
      contentType: att.contentType || "application/octet-stream",
      size: att.size || 0,
      partId: String(index + 1),
      ...(att.contentId ? { contentId: att.contentId } : {}),
    })
  );

  return {
    text: parsed.text || "",
    html: parsed.html || "",
    attachments,
  };
}
