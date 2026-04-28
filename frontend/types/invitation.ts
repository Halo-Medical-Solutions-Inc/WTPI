import { UserRole } from "./user";

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  expires_at: string;
  accepted_at: string | null;
  canceled_at: string | null;
  created_at: string;
  created_by: string;
  devLink?: string;
}

export interface InvitationCreate {
  email: string;
  role: UserRole;
}

export interface InvitationAccept {
  token: string;
  password: string;
  full_name: string;
  region?: string;
}

export interface InvitationVerifyResponse {
  valid: boolean;
  email: string;
  role: string;
}
