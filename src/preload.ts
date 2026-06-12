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
    update: (id: string, data: { content?: string; note?: string; deadline?: string; attachments?: string[] }) =>
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
    getDeviceId: () => ipcRenderer.invoke('app:get-device-id'),
    setLanguage: (mode: string) => ipcRenderer.invoke('app:set-language', mode),
    onLanguageChanged: (callback: (mode: string) => void) => {
      ipcRenderer.on('language:changed', (_event, mode) => callback(mode));
    },
  },
  purchase: {
    open: () => ipcRenderer.invoke('purchase:open'),
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
  quota: {
    get: () => ipcRenderer.invoke('quota:get'),
  },
  payments: {
    products: () => ipcRenderer.invoke('payments:products'),
    createOrder: (productId: string) => ipcRenderer.invoke('payments:create-order', productId),
    getOrder: (orderId: string) => ipcRenderer.invoke('payments:get-order', orderId),
  },
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
    write: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  },
  aiParse: (text: string) => ipcRenderer.invoke('ai-parse', text),
  parseDeadline: (text: string) => ipcRenderer.invoke('parse-deadline', text),
  window: {
    showMain: () => ipcRenderer.invoke('show-main'),
    openQuickAdd: () => ipcRenderer.invoke('open-quick-add'),
    closeQuickAdd: () => ipcRenderer.invoke('quick-add:close'),
    submitQuickAdd: (data: { content: string; note: string; deadline: string; attachments?: string[]; tasks?: any[] }) =>
      ipcRenderer.invoke('quick-add:submit', data),
  },
});
