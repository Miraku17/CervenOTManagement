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
  comment?: string;
}

export interface DayStats {
  date: string;
  totalSeconds: number;
  logs: WorkLog[];
}


export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  position: string;
  department: string;
  joinDate: string;
  avatarUrl: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  workLogs?: WorkLog[];
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:mm
  timeOut: string | null; // HH:mm
  status: 'Present' | 'Late' | 'Absent' | 'Half Day';
  totalHours?: number;
}

export type ViewState = 'DASHBOARD' | 'EMPLOYEES' | 'EMPLOYEE_DETAIL' | 'EXPORT' | 'EDIT_TIME';

export interface Position {
  id: number;
  name: string;
}
