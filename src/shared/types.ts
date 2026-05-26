export interface TaskAttachment {
  name: string;
  path: string;
  size: number;
}

export interface Task {
  id: string;
  content: string;
  note: string;
  deadline: string;
  attachments: TaskAttachment[];
  created_at: string;
  completed_at: string | null;
  notified_1h: boolean;
  notified_15m: boolean;
  notified_deadline: boolean;
}

export interface TaskCreate {
  content: string;
  note: string;
  deadline: string;
  attachments?: string[];
}

export interface TaskUpdate {
  note?: string;
  deadline?: string;
  attachments?: string[];
  completed_at?: string | null;
  notified_1h?: boolean;
  notified_15m?: boolean;
  notified_deadline?: boolean;
}
