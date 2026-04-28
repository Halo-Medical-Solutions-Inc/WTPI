export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  STAFF = "STAFF",
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  region: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  full_name?: string;
  role?: UserRole;
  region?: string;
}

export interface UserSettingsUpdate {
  full_name?: string;
  region?: string;
}
