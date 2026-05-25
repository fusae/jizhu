export interface Task {
  id: string;
  content: string;
  note: string;
  deadline: string;
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
}

export interface TaskUpdate {
  note?: string;
  deadline?: string;
  completed_at?: string | null;
  notified_1h?: boolean;
  notified_15m?: boolean;
  notified_deadline?: boolean;
}
