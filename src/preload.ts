import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  tasks: {
    listPending: () => ipcRenderer.invoke('tasks:list-pending'),
    listCompleted: () => ipcRenderer.invoke('tasks:list-completed'),
    create: (data: { content: string; note: string; deadline: string; attachments?: string[] }) =>
      ipcRenderer.invoke('tasks:create', data),
    complete: (id: string) => ipcRenderer.invoke('tasks:complete', id),
    reopen: (id: string) => ipcRenderer.invoke('tasks:reopen', id),
    delete: (id: string) => ipcRenderer.invoke('tasks:delete', id),
    update: (id: string, data: { note?: string; deadline?: string; attachments?: string[] }) =>
      ipcRenderer.invoke('tasks:update', id, data),
    countPending: () => ipcRenderer.invoke('tasks:count-pending'),
    onTaskAdded: (callback: (task: any) => void) => {
      ipcRenderer.on('task:added', (_event, task) => callback(task));
    },
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
  },
  attachments: {
    selectFiles: () => ipcRenderer.invoke('attachments:select-files'),
    open: (path: string) => ipcRenderer.invoke('attachments:open', path),
  },
  updates: {
    getStatus: () => ipcRenderer.invoke('updates:get-status'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    onStatus: (callback: (status: any) => void) => {
      ipcRenderer.on('updates:status', (_event, status) => callback(status));
    },
  },
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
  },
  aiParse: (text: string) => ipcRenderer.invoke('ai-parse', text),
  parseDeadline: (text: string) => ipcRenderer.invoke('parse-deadline', text),
  window: {
    showMain: () => ipcRenderer.invoke('show-main'),
    openQuickAdd: () => ipcRenderer.invoke('open-quick-add'),
    closeQuickAdd: () => ipcRenderer.invoke('quick-add:close'),
    submitQuickAdd: (data: { content: string; note: string; deadline: string; attachments?: string[] }) =>
      ipcRenderer.invoke('quick-add:submit', data),
  },
});
