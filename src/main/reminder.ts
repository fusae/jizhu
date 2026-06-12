import { app, Notification } from 'electron';
import { getSetting, listDueForReminder, updateTask } from './db';
import type { Task } from '../shared/types';

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startReminderLoop(): void {
  checkReminders();
  if (intervalId) clearInterval(intervalId);
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
  const now = new Date();
  const english = isEnglish();

  for (const task of tasks) {
    if (!task.deadline) continue;
    const deadline = new Date(task.deadline);
    if (Number.isNaN(deadline.getTime())) continue;
    const diffMs = deadline.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60_000);
    const taskName = task.note || task.content.slice(0, 40);

    if (diffMs <= 0 && !task.notified_deadline) {
      const title = english ? 'Task due' : '已到截止时间';
      const body = english ? `"${taskName}" is due now.` : `"${taskName}" 的截止时间已到。`;
      if (sendNotification(task, title, body, english)) {
        updateTask(task.id, { notified_deadline: true });
      }
    } else if (diffMin <= 15 && diffMin > 0 && !task.notified_15m) {
      if (!wasCreatedBeforeReminderWindow(task, 15)) {
        updateTask(task.id, { notified_15m: true });
        continue;
      }
      const title = english ? 'Due in 15 minutes' : '15 分钟后截止';
      const body = english ? `"${taskName}" is due in 15 minutes.` : `"${taskName}" 还有 15 分钟截止。`;
      if (sendNotification(task, title, body, english)) {
        updateTask(task.id, { notified_15m: true });
      }
    } else if (diffMin <= 60 && diffMin > 15 && !task.notified_1h) {
      if (!wasCreatedBeforeReminderWindow(task, 60)) {
        updateTask(task.id, { notified_1h: true });
        continue;
      }
      const title = english ? 'Due in 1 hour' : '1 小时后截止';
      const body = english ? `"${taskName}" is due in about 1 hour.` : `"${taskName}" 还有约 1 小时截止。`;
      if (sendNotification(task, title, body, english)) {
        updateTask(task.id, { notified_1h: true });
      }
    }
  }
}

function isEnglish(): boolean {
  const mode = getSetting('languageMode') || 'system';
  return mode === 'en' || (mode === 'system' && app.getLocale().toLowerCase().startsWith('en'));
}

function wasCreatedBeforeReminderWindow(task: Task, minutesBeforeDeadline: number): boolean {
  const createdAt = new Date(task.created_at).getTime();
  const deadline = new Date(task.deadline).getTime();
  if (!Number.isFinite(createdAt) || !Number.isFinite(deadline)) return true;
  return createdAt <= deadline - minutesBeforeDeadline * 60_000;
}

function sendNotification(task: Task, title: string, body: string, english: boolean): boolean {
  if (!Notification.isSupported()) return false;

  const notification = new Notification({
    title,
    body,
    silent: false,
    urgency: 'critical',
    timeoutType: 'never',
    closeButtonText: english ? 'Dismiss' : '知道了',
  });

  notification.on('click', () => {
    app.emit('activate');
  });

  notification.show();
  return true;
}
