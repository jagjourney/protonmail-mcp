import { JsonStore } from './storage.js';

export interface RuleConditions {
  from?: string;
  subject?: string;
  to?: string;
}

export interface RuleActions {
  moveTo?: string;
  markRead?: boolean;
  markFlagged?: boolean;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleConditions;
  matchMode: "all" | "any";
  actions: RuleActions;
  createdAt: string;
}

export interface RuleExecutionResult {
  scanned: number;
  matched: number;
  actions: { ruleId: string; ruleName: string; emailUid: number; emailSubject: string; action: string }[];
  errors: string[];
}

export class RuleManager {
  private store: JsonStore<Rule>;

  constructor(dataDir: string) {
    this.store = new JsonStore<Rule>(dataDir, 'rules.json');
  }

  async createRule(rule: Omit<Rule, 'id' | 'createdAt'>): Promise<Rule> {
    const now = new Date().toISOString();
    return this.store.add({
      ...rule,
      createdAt: now,
    } as Omit<Rule, 'id'>);
  }

  async listRules(): Promise<Rule[]> {
    return this.store.getAll();
  }

  async deleteRule(id: string): Promise<void> {
    return this.store.remove(id);
  }

  matchesRule(rule: Rule, email: { from: string; to: string; subject: string }): boolean {
    const conditions: { field: string; pattern: string }[] = [];

    if (rule.conditions.from) {
      conditions.push({ field: email.from, pattern: rule.conditions.from });
    }
    if (rule.conditions.to) {
      conditions.push({ field: email.to, pattern: rule.conditions.to });
    }
    if (rule.conditions.subject) {
      conditions.push({ field: email.subject, pattern: rule.conditions.subject });
    }

    // If no conditions are defined, the rule does not match anything
    if (conditions.length === 0) return false;

    if (rule.matchMode === "all") {
      return conditions.every(c => c.field.toLowerCase().includes(c.pattern.toLowerCase()));
    } else {
      return conditions.some(c => c.field.toLowerCase().includes(c.pattern.toLowerCase()));
    }
  }
}
