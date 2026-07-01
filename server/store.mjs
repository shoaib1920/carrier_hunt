import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { firestore } from './firebase.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = process.env.DATA_PATH || join(__dirname, 'data', 'db.json');
const useFirebase = Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.FIRESTORE_EMULATOR_HOST
);
const COLLECTIONS = ['users', 'students', 'internships', 'applications', 'projects', 'cvs', 'assessments'];

const DEFAULT_DB = {
  users: [],
  students: [],
  internships: [],
  applications: [],
  projects: [],
  cvs: [],
  assessments: [],
};

export function getDataPath() {
  return LOCAL_DB_PATH;
}

const SEED_STUDENTS = [
  {
    id: 'st_123',
    name: 'Ahmad Khan',
    university: 'Baba Guru Nanak University',
    department: 'Computer Science',
    readinessScore: 72,
    skills: [
      { name: 'React', isVerified: true, evidenceSource: 'p_1' },
      { name: 'Node.js', isVerified: true, evidenceSource: 'p_1' },
      { name: 'Python', isVerified: false },
      { name: 'SQL', isVerified: false },
    ],
    profileComplete: true,
    projects: [
      {
        id: 'p_1',
        title: 'E-Commerce Platform',
        description: 'Built a full-stack e-commerce site with Stripe integration.',
        codeUrl: 'https://github.com/ahmed/shop',
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    ],
    applications: [],
  },
  {
    id: 'st_124',
    name: 'Sara Bibi',
    university: 'Baba Guru Nanak University',
    department: 'Software Engineering',
    readinessScore: 85,
    skills: [
      { name: 'Flutter', isVerified: true, evidenceSource: 'p_2' },
      { name: 'Firebase', isVerified: true, evidenceSource: 'p_2' },
    ],
    profileComplete: true,
    projects: [
      {
        id: 'p_2',
        title: 'BGNU Campus App',
        description: 'Native mobile app for student management.',
        codeUrl: 'https://github.com/sara/bgnu-app',
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    ],
    applications: [
      {
        internshipId: 'i_1',
        status: 'PENDING',
        appliedDate: new Date().toISOString(),
      },
    ],
  },
];

const SEED_INTERNSHIPS = [
  {
    id: 'i_1',
    companyName: 'TechVanguard Lahore',
    role: 'Full Stack Intern',
    tier: 'TOP_TIER',
    location: 'Lahore (Remote)',
    stipend: 'PKR 45,000/mo',
    description: 'Work on cutting edge Fintech solutions using React and Node.js.',
    requirements: ['React', 'Node.js', 'PostgreSQL'],
  },
  {
    id: 'i_2',
    companyName: 'SoftSolutions Karachi',
    role: 'Frontend Developer',
    tier: 'MEDIUM_TIER',
    location: 'Karachi',
    stipend: 'PKR 20,000/mo',
    description: 'Help us migrate our legacy apps to Next.js.',
    requirements: ['JavaScript', 'CSS', 'Tailwind'],
  },
];

const FULL_SEED = {
  students: SEED_STUDENTS,
  internships: SEED_INTERNSHIPS,
  users: [
    {
      id: 'u_ahmed',
      email: 'ahmed@gmail.com',
      password: 'shoaib',
      role: 'STUDENT',
      studentId: 'st_123',
    },
    {
      id: 'u_sara',
      email: 'sara@gmail.com',
      password: 'shoaib',
      role: 'STUDENT',
      studentId: 'st_124',
    },
    {
      id: 'u_recruiter',
      email: 'recruiter@gmail.com',
      password: 'shoaib',
      role: 'RECRUITER',
      studentId: null,
    },
  ],
  applications: [],
  projects: [],
  cvs: [],
  assessments: [],
};

function ensureLocalDb() {
  if (!existsSync(LOCAL_DB_PATH)) {
    mkdirSync(dirname(LOCAL_DB_PATH), { recursive: true });
    writeFileSync(LOCAL_DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  }
}

function loadLocalDb() {
  ensureLocalDb();
  const raw = readFileSync(LOCAL_DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveLocalDb(data) {
  mkdirSync(dirname(LOCAL_DB_PATH), { recursive: true });
  writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function mapDoc(docSnap) {
  return { id: docSnap.id, ...(docSnap.data() ?? {}) };
}

async function loadFirestoreCollection(name) {
  const snapshot = await firestore.collection(name).get();
  return snapshot.docs.map(mapDoc);
}

async function loadFirestoreDb() {
  const result = {};
  await Promise.all(
    COLLECTIONS.map(async (name) => {
      result[name] = await loadFirestoreCollection(name);
    })
  );
  return result;
}

async function syncFirestoreCollection(name, docs) {
  const batch = firestore.batch();
  const snapshot = await firestore.collection(name).get();
  snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));

  docs.forEach((item) => {
    const id = String(item.id || `${name}_${randomUUID().slice(0, 8)}`);
    const ref = firestore.collection(name).doc(id);
    batch.set(ref, { ...item, id });
  });

  await batch.commit();
}

async function saveFirestoreDb(data) {
  await Promise.all(COLLECTIONS.map((name) => syncFirestoreCollection(name, Array.isArray(data[name]) ? data[name] : [])));
}

export async function loadDb() {
  if (useFirebase) {
    return loadFirestoreDb();
  }
  return loadLocalDb();
}

export function saveDb(data) {
  if (useFirebase) {
    return saveFirestoreDb(data);
  }
  saveLocalDb(data);
}

export async function seedIfEmpty(data) {
  if (useFirebase) {
    const isEmpty = COLLECTIONS.every((name) => Array.isArray(data[name]) && data[name].length === 0);
    if (isEmpty) {
      const seeded = structuredClone(FULL_SEED);
      await saveFirestoreDb(seeded);
      return seeded;
    }
    return data;
  }

  if (data.students.length === 0 && data.internships.length === 0) {
    const seeded = structuredClone(FULL_SEED);
    saveLocalDb(seeded);
    return seeded;
  }
  return upgradeLegacyDemoUsers(ensureUsersMigrated(data));
}

export function ensureUsersMigrated(data) {
  if (!Array.isArray(data.users)) return data;

  // Ensure legacy users have the minimal expected schema.
  data.users = data.users.map((user) => ({
    ...user,
    id: user.id || `u_${randomUUID().slice(0, 8)}`,
    email: String(user.email || '').trim().toLowerCase(),
    role: String(user.role || 'STUDENT').toUpperCase(),
    password: user.password || user.password_hash || 'demo123',
    studentId: user.studentId ?? null,
  }));

  return data;
}

export function upgradeLegacyDemoUsers(data) {
  if (!Array.isArray(data.users)) return data;
  const legacy = [
    { old: 'ahmed@demo.test', email: 'ahmed@gmail.com', password: 'shoaib' },
    { old: 'sara@demo.test', email: 'sara@gmail.com', password: 'shoaib' },
    { old: 'recruiter@demo.test', email: 'recruiter@gmail.com', password: 'shoaib' },
  ];
  let changed = false;
  for (const u of data.users) {
    const em = String(u.email || '').toLowerCase();
    const row = legacy.find((l) => l.old === em);
    if (row) {
      u.email = row.email;
      u.password = row.password;
      changed = true;
    }
  }

  const demoEmails = new Set(['ahmed@gmail.com', 'sara@gmail.com', 'recruiter@gmail.com']);
  for (const u of data.users) {
    const em = String(u.email || '').toLowerCase();
    if (demoEmails.has(em) && u.password === 'demo123') {
      u.password = 'shoaib';
      changed = true;
    }
  }
  if (changed) saveDb(data);
  return data;
}
