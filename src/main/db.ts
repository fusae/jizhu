import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { basename, extname, join } from 'path';
import type { Task, TaskAttachment, TaskCreate, TaskUpdate } from '../shared/types';

let db: Database.Database;
let attachmentsDir: string;

export function initDatabase(): void {
  const dataDir = join(app.getPath('userData'));
  attachmentsDir = join(dataDir, 'attachments');
  mkdirSync(attachmentsDir, { recursive: true });
  const dbPath = join(dataDir, 'tasks.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL,
      attachments TEXT NOT NULL DEFAULT '[]',
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
  migrateDatabase();
}

function migrateDatabase(): void {
  const columns = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'attachments')) {
    db.prepare("ALTER TABLE tasks ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'").run();
  }
}

function parseAttachments(value: unknown): TaskAttachment[] {
  if (Array.isArray(value)) return value as TaskAttachment[];
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value) as TaskAttachment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTask(row: any): Task {
  return {
    ...row,
    attachments: parseAttachments(row.attachments),
  } as Task;
}

function copyAttachments(taskId: string, paths: string[] = []): TaskAttachment[] {
  if (paths.length === 0) return [];

  const taskDir = join(attachmentsDir, taskId);
  mkdirSync(taskDir, { recursive: true });

  return paths.flatMap((sourcePath) => {
    if (!sourcePath || !existsSync(sourcePath)) return [];
    const stat = statSync(sourcePath);
    if (!stat.isFile()) return [];

    const originalName = basename(sourcePath);
    const ext = extname(originalName);
    const base = ext ? originalName.slice(0, -ext.length) : originalName;
    let fileName = originalName;
    let targetPath = join(taskDir, fileName);
    let index = 1;
    while (existsSync(targetPath)) {
      fileName = `${base}-${index}${ext}`;
      targetPath = join(taskDir, fileName);
      index += 1;
    }

    copyFileSync(sourcePath, targetPath);
    return [{ name: fileName, path: targetPath, size: stat.size }];
  });
}

export function createTask(data: TaskCreate): Task {
  const id = randomUUID();
  const attachments = copyAttachments(id, data.attachments);
  const stmt = db.prepare(`
    INSERT INTO tasks (id, content, note, deadline, attachments)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.content, data.note, data.deadline, JSON.stringify(attachments));
  return getTask(id)!;
}

export function getTask(id: string): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row ? normalizeTask(row) : undefined;
}

export function listPending(): Task[] {
  const rows = db.prepare(
    "SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY deadline ASC"
  ).all();
  return rows.map(normalizeTask);
}

export function listCompleted(limit = 20): Task[] {
  const rows = db.prepare(
    "SELECT * FROM tasks WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT ?"
  ).all(limit);
  return rows.map(normalizeTask);
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
  if (data.attachments !== undefined) { sets.push('attachments = ?'); values.push(JSON.stringify(copyAttachments(id, data.attachments))); }
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
  const task = getTask(id);
  for (const attachment of task?.attachments || []) {
    try { unlinkSync(attachment.path); } catch {}
  }
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
