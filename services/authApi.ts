import type { AuthSession, StudentProfile, UserRole } from '../types';
import { apiFetch } from './api';

export type AuthResponse = {
  session: AuthSession;
  student: StudentProfile | null;
};

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRegister(payload: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
