import { Notification } from 'electron';
import { listDueForReminder, updateTask, listPending } from './db';
import type { Task } from '../shared/types';

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startReminderLoop(): void {
  intervalId = setInterval(checkReminders, 30_000);
}

export function stopReminderLoop(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function checkReminders(): void {
  const tasks = listDueForReminder();

  for (const task of tasks) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60_000);

    if (diffMs <= 0 && !task.notified_deadline) {
      if (sendNotification(task, '已到截止时间', `"${task.note || task.content.slice(0, 40)}" 的截止时间已到。`)) {
        updateTask(task.id, { notified_deadline: true });
      }
    } else if (diffMin <= 15 && diffMin > 0 && !task.notified_15m) {
      if (sendNotification(task, '15 分钟后截止', `"${task.note || task.content.slice(0, 40)}" 还有 15 分钟截止。`)) {
        updateTask(task.id, { notified_15m: true });
      }
    } else if (diffMin <= 60 && diffMin > 15 && !task.notified_1h) {
      if (sendNotification(task, '1 小时后截止', `"${task.note || task.content.slice(0, 40)}" 还有约 1 小时截止。`)) {
        updateTask(task.id, { notified_1h: true });
      }
    }
  }
}

function sendNotification(task: Task, title: string, body: string): boolean {
  if (!Notification.isSupported()) return false;

  const notification = new Notification({
    title,
    body,
    silent: false,
    urgency: 'critical',
    timeoutType: 'never',
    closeButtonText: '知道了',
  });

  notification.on('click', () => {
    const { app } = require('electron');
    app.emit('activate');
  });

  notification.show();
  return true;
}
