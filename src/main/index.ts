import { app, BrowserWindow, globalShortcut, ipcMain, Notification } from 'electron';
import { join } from 'path';
import * as chrono from 'chrono-node';
import {
  initDatabase, closeDatabase,
  createTask, listPending, listCompleted,
  completeTask, reopenTask, deleteTask, updateTask,
  countPending,
  getSetting, setSetting, getAllSettings,
} from './db';
import { createTray, updateTrayBadge } from './tray';
import { startReminderLoop } from './reminder';
import type { TaskCreate } from '../shared/types';

let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 380,
    minHeight: 500,
    title: '贴记',
    webPreferences: {
      preload: join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (mainWindow && !isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createQuickAddWindow(): void {
  if (quickAddWindow) {
    quickAddWindow.focus();
    return;
  }

  quickAddWindow = new BrowserWindow({
    width: 440,
    height: 340,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    title: '快速添加',
    webPreferences: {
      preload: join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  quickAddWindow.loadFile(join(__dirname, '..', 'renderer', 'quick-add.html'));

  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });
}

function registerShortcuts(): void {
  const modKey = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';

  globalShortcut.register(`${modKey}+Shift+T`, () => {
    createQuickAddWindow();
  });
}

function registerIpc(): void {
  ipcMain.handle('tasks:list-pending', () => listPending());
  ipcMain.handle('tasks:list-completed', () => listCompleted());
  ipcMain.handle('tasks:create', (_event, data: TaskCreate) => {
    const task = createTask(data);
    updateTrayBadge(countPending());
    return task;
  });
  ipcMain.handle('tasks:complete', (_event, id: string) => {
    const task = completeTask(id);
    updateTrayBadge(countPending());
    return task;
  });
  ipcMain.handle('tasks:reopen', (_event, id: string) => reopenTask(id));
  ipcMain.handle('tasks:delete', (_event, id: string) => {
    deleteTask(id);
    updateTrayBadge(countPending());
  });
  ipcMain.handle('tasks:update', (_event, id: string, data: { note?: string; deadline?: string }) => {
    updateTask(id, data);
  });
  ipcMain.handle('tasks:count-pending', () => countPending());

  ipcMain.handle('parse-deadline', (_event, text: string) => {
    const results = chrono.parse(text, new Date(), { forwardDate: true });
    if (results.length === 0) return null;
    return results[0].start.date().toISOString();
  });

  ipcMain.handle('ai-parse', async (_event, text: string) => {
    const apiKey = process.env.DEEPSEEK_API_KEY || getSetting('deepseekApiKey');
    if (!apiKey) return null;
    try {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: '从聊天文本中提取：1.要做什么事（10字以内）2.截止时间。输出JSON：{"note":"...","deadline":"..."}。没有截止时间填"无"。deadline用自然语言如"本周五18:00"。'
          }, {
            role: 'user', content: text
          }],
          temperature: 0,
          max_tokens: 100
        }),
      });
      const data = await resp.json() as any;
      const raw = data?.choices?.[0]?.message?.content?.trim();
      if (!raw) return null;
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return { note: json.note || '', deadline: json.deadline === '无' ? '' : (json.deadline || '') };
    } catch {
      return null;
    }
  });

  ipcMain.handle('settings:get', (_event, key: string) => getSetting(key));
  ipcMain.handle('settings:set', (_event, key: string, value: string) => setSetting(key, value));
  ipcMain.handle('settings:getAll', () => getAllSettings());

  ipcMain.handle('quick-add:close', () => {
    quickAddWindow?.close();
  });

  ipcMain.handle('quick-add:submit', (_event, data: TaskCreate) => {
    const task = createTask(data);
    updateTrayBadge(countPending());
    quickAddWindow?.close();
    if (mainWindow) {
      mainWindow.webContents.send('task:added', task);
      mainWindow.show();
    }
    return task;
  });

  ipcMain.handle('show-main', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  ipcMain.handle('clipboard:read', () => {
    const { clipboard } = require('electron');
    return clipboard.readText();
  });
}

app.whenReady().then(() => {
  initDatabase();
  createMainWindow();
  createTray();
  registerShortcuts();
  registerIpc();
  startReminderLoop();
  updateTrayBadge(countPending());

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
