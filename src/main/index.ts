import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Notification, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import { join } from 'path';
import * as chrono from 'chrono-node';
import { autoUpdater } from 'electron-updater';
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
const JIZHU_API_URL = process.env.JIZHU_API_URL || 'https://clawrent.xyz/jizhu-api';

type UpdateStatus = {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  latestVersion?: string;
  percent?: number;
  message?: string;
};

let updateStatus: UpdateStatus = {
  status: 'idle',
  currentVersion: app.getVersion(),
};

if (process.platform === 'win32') {
  app.setAppUserModelId('com.cola.jizhu');
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 380,
    minHeight: 500,
    title: '记住',
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
    width: 500,
    height: 560,
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

function hasRelativeDuration(text: string): boolean {
  return /(?:\d+|[一二两三四五六七八九十两半]+)\s*(?:秒|分钟|小时|天|周|星期|礼拜|个月)\s*后/.test(text);
}

function formatDeadlineInput(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (sameDay(date, now)) return `今天 ${time}`;
  if (sameDay(date, tomorrow)) return `明天 ${time}`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${time}`;
}

function getDeviceId(): string {
  let id = getSetting('serverDeviceId');
  if (!id) {
    id = `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    setSetting('serverDeviceId', id);
  }
  return id;
}

function createRequestId(): string {
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

async function apiJson(path: string, options: RequestInit = {}): Promise<any> {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
    ...(options.headers || {}),
  };
  const resp = await fetch(`${JIZHU_API_URL}${path}`, { ...options, headers });
  const data = await resp.json().catch(() => ({})) as { error?: string };
  if (!resp.ok) throw new Error(data.error || '请求失败');
  return data;
}

function emitUpdateStatus(): void {
  mainWindow?.webContents.send('updates:status', updateStatus);
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    updateStatus = { status: 'checking', currentVersion: app.getVersion() };
    emitUpdateStatus();
  });

  autoUpdater.on('update-available', (info) => {
    updateStatus = {
      status: 'available',
      currentVersion: app.getVersion(),
      latestVersion: info.version,
      message: `发现新版本 ${info.version}`,
    };
    emitUpdateStatus();
  });

  autoUpdater.on('update-not-available', (info) => {
    updateStatus = {
      status: 'not-available',
      currentVersion: app.getVersion(),
      latestVersion: info.version,
      message: '当前已是最新版本',
    };
    emitUpdateStatus();
  });

  autoUpdater.on('download-progress', (progress) => {
    updateStatus = {
      ...updateStatus,
      status: 'downloading',
      percent: Math.round(progress.percent),
      message: `正在下载 ${Math.round(progress.percent)}%`,
    };
    emitUpdateStatus();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateStatus = {
      status: 'downloaded',
      currentVersion: app.getVersion(),
      latestVersion: info.version,
      percent: 100,
      message: '更新已下载，重启后安装',
    };
    emitUpdateStatus();
  });

  autoUpdater.on('error', (err) => {
    updateStatus = {
      status: 'error',
      currentVersion: app.getVersion(),
      message: err.message || '检查更新失败',
    };
    emitUpdateStatus();
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
  ipcMain.handle('tasks:update', (_event, id: string, data: { content?: string; note?: string; deadline?: string; attachments?: string[] }) => {
    updateTask(id, data);
  });
  ipcMain.handle('tasks:count-pending', () => countPending());

  ipcMain.handle('parse-deadline', (_event, text: string) => {
    const results = chrono.zh.hans.parse(text, new Date(), { forwardDate: true });
    if (results.length === 0) return null;
    return results[0].start.date().toISOString();
  });

  ipcMain.handle('ai-parse', async (_event, text: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const data = await apiJson('/v1/parse', {
        method: 'POST',
        headers: { 'X-Request-Id': createRequestId() },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const tasks = (Array.isArray(data.tasks) ? data.tasks : []).map((task: any) => {
        const deadlineDate = task.deadline ? new Date(task.deadline) : null;
        const localDeadline = hasRelativeDuration(task.rawText || text)
          ? chrono.zh.hans.parse(task.rawText || text, new Date(), { forwardDate: true })[0]?.start.date()
          : null;
        return {
          note: task.title || '',
          content: task.rawText || task.title || text,
          deadline: localDeadline ? formatDeadlineInput(localDeadline) : deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? formatDeadlineInput(deadlineDate) : '',
        };
      });
      return {
        note: tasks[0]?.note || '',
        deadline: tasks[0]?.deadline || '',
        tasks,
        quota: data.quota,
      };
    } catch (err) {
      console.error('AI parse failed:', err);
      return { error: err instanceof Error ? err.message : 'AI 解析失败' };
    }
  });

  ipcMain.handle('quota:get', () => apiJson('/v1/quota'));
  ipcMain.handle('payments:products', () => apiJson('/v1/payment/products'));
  ipcMain.handle('payments:create-order', async (_event, productId: string) => {
    const data = await apiJson('/v1/payment/orders', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    if (data.paymentUrl) await shell.openExternal(data.paymentUrl);
    return data;
  });
  ipcMain.handle('payments:get-order', (_event, orderId: string) => apiJson(`/v1/payment/orders/${orderId}`));

  ipcMain.handle('settings:get', (_event, key: string) => getSetting(key));
  ipcMain.handle('settings:set', (_event, key: string, value: string) => setSetting(key, value));
  ipcMain.handle('settings:getAll', () => getAllSettings());

  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('attachments:select-files', async () => {
    const options: OpenDialogOptions = { properties: ['openFile', 'multiSelections'] };
    const parent = quickAddWindow || mainWindow;
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle('attachments:open', async (_event, filePath: string) => {
    if (!filePath) return '文件不存在';
    const error = await shell.openPath(filePath);
    return error || null;
  });
  ipcMain.handle('updates:get-status', () => updateStatus);
  ipcMain.handle('updates:check', async () => {
    if (!app.isPackaged) {
      updateStatus = {
        status: 'error',
        currentVersion: app.getVersion(),
        message: '开发模式不支持自动更新检查',
      };
      emitUpdateStatus();
      return updateStatus;
    }
    await autoUpdater.checkForUpdates();
    return updateStatus;
  });
  ipcMain.handle('updates:download', async () => {
    await autoUpdater.downloadUpdate();
    return updateStatus;
  });
  ipcMain.handle('updates:install', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('quick-add:close', () => {
    quickAddWindow?.close();
  });

  ipcMain.handle('quick-add:submit', (_event, data: TaskCreate & { tasks?: TaskCreate[] }) => {
    const tasks = Array.isArray(data.tasks) && data.tasks.length > 0 ? data.tasks.map((item) => createTask(item)) : [createTask(data)];
    updateTrayBadge(countPending());
    quickAddWindow?.close();
    if (mainWindow) {
      mainWindow.webContents.send('task:added', tasks[0]);
      mainWindow.show();
    }
    return tasks;
  });

  ipcMain.handle('show-main', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  ipcMain.handle('open-quick-add', () => {
    createQuickAddWindow();
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
  configureAutoUpdater();
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
