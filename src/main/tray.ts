import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;

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
  tray.setToolTip('记住');

  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
}

function showMainWindow(): void {
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins.find(w => w.getTitle().includes('记住') && !w.getTitle().includes('快速'));
  if (mainWin) {
    mainWin.show();
    mainWin.focus();
  } else {
    app.emit('activate');
  }
}

function updateTrayMenu(pending: number): void {
  if (!tray) return;
  const title = pending > 0 ? `待办 (${pending})` : '记住';
  if (process.platform === 'darwin') {
    tray.setTitle(pending > 0 ? String(pending) : '');
  } else {
    tray.setToolTip(title);
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: title, enabled: false },
    { type: 'separator' },
    {
      label: '打开主窗口',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
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
