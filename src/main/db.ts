import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { join } from 'path';
import type { Task, TaskCreate, TaskUpdate } from '../shared/types';

let db: Database.Database;

export function initDatabase(): void {
  const dataDir = join(app.getPath('userData'));
  const dbPath = join(dataDir, 'tasks.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT,
      notified_1h INTEGER NOT NULL DEFAULT 0,
      notified_15m INTEGER NOT NULL DEFAULT 0,
      notified_deadline INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);
}

export function createTask(data: TaskCreate): Task {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO tasks (id, content, note, deadline)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, data.content, data.note, data.deadline);
  return getTask(id)!;
}

export function getTask(id: string): Task | undefined {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
}

export function listPending(): Task[] {
  return db.prepare(
    "SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY deadline ASC"
  ).all() as Task[];
}

export function listCompleted(limit = 20): Task[] {
  return db.prepare(
    "SELECT * FROM tasks WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT ?"
  ).all(limit) as Task[];
}

export function listDueForReminder(): Task[] {
  const now = new Date();
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in15m = new Date(now.getTime() + 15 * 60 * 1000);

  return db.prepare(`
    SELECT * FROM tasks
    WHERE completed_at IS NULL
      AND (
        (datetime(deadline) <= datetime(?) AND notified_deadline = 0)
        OR (datetime(deadline) <= datetime(?) AND notified_15m = 0)
        OR (datetime(deadline) <= datetime(?) AND notified_1h = 0)
      )
  `).all(
    now.toISOString(),
    in15m.toISOString(),
    in1h.toISOString()
  ) as Task[];
}

export function updateTask(id: string, data: TaskUpdate): Task | undefined {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.note !== undefined) { sets.push('note = ?'); values.push(data.note); }
  if (data.deadline !== undefined) { sets.push('deadline = ?'); values.push(data.deadline); }
  if (data.completed_at !== undefined) { sets.push('completed_at = ?'); values.push(data.completed_at); }
  if (data.notified_1h !== undefined) { sets.push('notified_1h = ?'); values.push(data.notified_1h ? 1 : 0); }
  if (data.notified_15m !== undefined) { sets.push('notified_15m = ?'); values.push(data.notified_15m ? 1 : 0); }
  if (data.notified_deadline !== undefined) { sets.push('notified_deadline = ?'); values.push(data.notified_deadline ? 1 : 0); }

  if (sets.length === 0) return getTask(id);

  values.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getTask(id);
}

export function completeTask(id: string): Task | undefined {
  return updateTask(id, { completed_at: new Date().toISOString() });
}

export function reopenTask(id: string): Task | undefined {
  return updateTask(id, { completed_at: null });
}

export function deleteTask(id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

export function countPending(): number {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE completed_at IS NULL"
  ).get() as { count: number };
  return row.count;
}

export function closeDatabase(): void {
  if (db) db.close();
}

export function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value || '';
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}
