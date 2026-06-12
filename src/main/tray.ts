import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;
let languageMode: 'system' | 'zh' | 'en' = 'system';
let lastPending = 0;
const isEnglish = () => languageMode === 'en' || (languageMode === 'system' && app.getLocale().toLowerCase().startsWith('en'));
const text = {
  appName: () => isEnglish() ? 'JiZhu' : '记住',
  todo: () => isEnglish() ? 'Todo' : '待办',
  quick: () => isEnglish() ? 'Quick' : '快速',
  openMain: () => isEnglish() ? 'Open Main Window' : '打开主窗口',
  quit: () => isEnglish() ? 'Quit' : '退出',
};

export function createTray(): void {
  const iconPath = join(app.getAppPath(), 'assets', 'tray-icon.png');
  const templatePath = join(app.getAppPath(), 'assets', 'tray-iconTemplate.png');

  const icon = nativeImage.createFromPath(
    process.platform === 'darwin' ? templatePath : iconPath
  );

  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  updateTrayMenu(0);
  tray.setToolTip(text.appName());

  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
}

export function setTrayLanguage(mode: string): void {
  languageMode = mode === 'zh' || mode === 'en' ? mode : 'system';
  tray?.setToolTip(text.appName());
  updateTrayMenu(lastPending);
}

function showMainWindow(): void {
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins.find(w => w.getTitle().includes(text.appName()) && !w.getTitle().includes(text.quick()));
  if (mainWin) {
    mainWin.show();
    mainWin.focus();
  } else {
    app.emit('activate');
  }
}

function updateTrayMenu(pending: number): void {
  if (!tray) return;
  lastPending = pending;
  const title = pending > 0 ? `${text.todo()} (${pending})` : text.appName();
  if (process.platform === 'darwin') {
    tray.setTitle(pending > 0 ? String(pending) : '');
  } else {
    tray.setToolTip(title);
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: title, enabled: false },
    { type: 'separator' },
    {
      label: text.openMain(),
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: text.quit(),
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function updateTrayBadge(pending: number): void {
  updateTrayMenu(pending);
}
