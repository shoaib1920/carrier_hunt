import { UserRole, type AuthSession, type StudentProfile } from '../types';

const LOCAL_ACCOUNTS_KEY = 'career-bridge-local-accounts';
const LOCAL_STUDENTS_KEY = 'career-bridge-local-students';

type LocalAccount = AuthSession & { password: string };


function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getOfflineExtraStudents(): StudentProfile[] {
  return readJson<StudentProfile[]>(LOCAL_STUDENTS_KEY, []);
}

export function saveOfflineStudent(student: StudentProfile) {
  const list = getOfflineExtraStudents();
  list.push(student);
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(list));
}

export function saveOfflineAccount(account: LocalAccount) {
  const list = readJson<LocalAccount[]>(LOCAL_ACCOUNTS_KEY, []);
  list.push(account);
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(list));
}

export function getAllOfflineAccounts(seedAccounts: LocalAccount[]): LocalAccount[] {
  return [...seedAccounts, ...readJson<LocalAccount[]>(LOCAL_ACCOUNTS_KEY, [])];
}

export function tryOfflineLogin(email: string, password: string, seedAccounts: LocalAccount[] = OFFLINE_DEMO_ACCOUNTS): AuthSession | null {
  const normalized = email.trim().toLowerCase();
  const hit = getAllOfflineAccounts(seedAccounts).find(
    (a) => a.email.toLowerCase() === normalized && a.password === password
  );
  if (!hit) return null;
  return { userId: hit.userId, email: hit.email, role: hit.role, studentId: hit.studentId };
}

/** Matches server seed users — used when API is down */
export const OFFLINE_DEMO_ACCOUNTS: (AuthSession & { password: string })[] = [
  { userId: 'u_ahmed', email: 'ahmed@gmail.com', password: 'shoaib', role: UserRole.STUDENT, studentId: 'st_123' },
  { userId: 'u_sara', email: 'sara@gmail.com', password: 'shoaib', role: UserRole.STUDENT, studentId: 'st_124' },
  { userId: 'u_student_demo', email: 'student@demo.com', password: 'demo123', role: UserRole.STUDENT, studentId: 'st_123' },
  {
    userId: 'u_recruiter',
    email: 'recruiter@gmail.com',
    password: 'shoaib',
    role: UserRole.RECRUITER,
    studentId: null,
  },
];

export function registerOffline(
  email: string,
  password: string,
  name: string,
  role: UserRole,
  seedAccounts: LocalAccount[] = OFFLINE_DEMO_ACCOUNTS
): { session: AuthSession; student: StudentProfile | null } {
  const normalized = email.trim().toLowerCase();
  if (getAllOfflineAccounts(seedAccounts).some((a) => a.email.toLowerCase() === normalized)) {
    throw new Error('Email already registered');
  }
  const userId = `u_local_${Date.now()}`;
  if (role === UserRole.RECRUITER) {
    const session: AuthSession = { userId, email: normalized, role, studentId: null };
    saveOfflineAccount({ ...session, password });
    return { session, student: null };
  }
  const studentId = `st_local_${Date.now()}`;
  const student: StudentProfile = {
    uid: studentId,
    name,
    university: 'Baba Guru Nanak University',
    department: '',
    aiReadinessScore: 50,
    skills: [],
    projects: [],
    applications: [],
    profileComplete: false,
    email: normalized,
    role: UserRole.STUDENT,
    createdAt: new Date().toISOString(),
  };
  saveOfflineStudent(student);
  const session: AuthSession = { userId, email: normalized, role, studentId };
  saveOfflineAccount({ ...session, password });
  return { session, student };
}
