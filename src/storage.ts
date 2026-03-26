import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

export class JsonStore<T extends { id: string }> {
  private filePath: string;

  constructor(dataDir: string, filename: string) {
    this.filePath = join(dataDir, filename);
  }

  async load(): Promise<T[]> {
    try {
      const data = await readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async save(items: T[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(items, null, 2));
  }

  async add(item: Omit<T, 'id'>): Promise<T> {
    const items = await this.load();
    const newItem = { ...item, id: randomUUID() } as T;
    items.push(newItem);
    await this.save(items);
    return newItem;
  }

  async remove(id: string): Promise<void> {
    const items = await this.load();
    const filtered = items.filter(i => i.id !== id);
    if (filtered.length === items.length) throw new Error(`Item with id ${id} not found`);
    await this.save(filtered);
  }

  async getAll(): Promise<T[]> {
    return this.load();
  }

  async getById(id: string): Promise<T | undefined> {
    const items = await this.load();
    return items.find(i => i.id === id);
  }
}
