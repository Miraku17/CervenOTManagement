export interface UserProfile {
  id: string;
  name: string;
  email: string;
  position: string;
  avatarUrl: string;
  contactNumber: string;
  address: string;
  department: string;
}

export interface WorkLog {
  id: string;
  date: string; // ISO Date String YYYY-MM-DD
  startTime: number; // Timestamp
  endTime: number | null; // Timestamp
  durationSeconds: number;
  status: 'COMPLETED' | 'IN_PROGRESS';
}

export interface DayStats {
  date: string;
  totalSeconds: number;
  logs: WorkLog[];
}
