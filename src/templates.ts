import { JsonStore } from './storage.js';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  text?: string;
  html?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  createdAt: string;
  updatedAt: string;
}

function replaceVariables(str: string | undefined, variables: Record<string, string>): string | undefined {
  if (!str) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export class TemplateManager {
  private store: JsonStore<EmailTemplate>;

  constructor(dataDir: string) {
    this.store = new JsonStore<EmailTemplate>(dataDir, 'templates.json');
  }

  async saveTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    const now = new Date().toISOString();
    return this.store.add({
      ...template,
      createdAt: now,
      updatedAt: now,
    } as Omit<EmailTemplate, 'id'>);
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    return this.store.getAll();
  }

  async getTemplate(id: string): Promise<EmailTemplate> {
    const template = await this.store.getById(id);
    if (!template) throw new Error(`Template with id ${id} not found`);
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.store.remove(id);
  }

  async renderTemplate(
    id: string,
    variables: Record<string, string>
  ): Promise<{ to?: string; cc?: string; bcc?: string; subject: string; text?: string; html?: string }> {
    const template = await this.getTemplate(id);
    return {
      to: replaceVariables(template.to, variables),
      cc: replaceVariables(template.cc, variables),
      bcc: replaceVariables(template.bcc, variables),
      subject: replaceVariables(template.subject, variables) || template.subject,
      text: replaceVariables(template.text, variables),
      html: replaceVariables(template.html, variables),
    };
  }
}
