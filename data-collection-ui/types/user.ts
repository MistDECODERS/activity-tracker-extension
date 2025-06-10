export type UserProfiles = {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: 'admin' | 'user';
  task_statuses?: Record<string, string>;
  created_at: string;
};

export type Task = {
  id: string;
  created_at: string;
  user_id: string;
  fileId: string;
  path: string;
  fullPath: string;
};
