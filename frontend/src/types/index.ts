// All shared types for the MultiView Agent frontend

export type SessionStatus =
  | 'STARTING'
  | 'RUNNING'
  | 'IDLE'
  | 'AUTOMATING'
  | 'STOPPING'
  | 'STOPPED'
  | 'ERROR'
  | 'CRASHED';

export interface BrowserSession {
  session_id: string;
  status: SessionStatus;
  current_url: string;
  title: string;
  creation_time: string;
  last_activity: string;
}

export type GridLayout = 1 | 5 | 10 | 20 | 30 | 40 | 50;

export type Page = 'dashboard' | 'browsers' | 'workflows' | 'scheduler' | 'profiles' | 'logs' | 'settings';
