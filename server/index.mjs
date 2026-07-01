import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import axios from 'axios';
import { loadDb, saveDb, seedIfEmpty } from './store.mjs';
import * as gemini from './gemini.mjs';
import { firestore, auth as adminAuth } from './firebase.mjs';
import { FieldValue } from 'firebase-admin/firestore';

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const JWT_SECRET = process.env.JWT_SECRET || 'careerhunt-dev-secret';
const JWT_EXPIRES = '7d';
const HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL);
const USE_FIREBASE = Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.FIRESTORE_EMULATOR_HOST
);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

let db = await seedIfEmpty(await loadDb());

function persist() {
  return Promise.resolve(saveDb(db)).catch((error) => {
    console.error('Failed to persist database state:', error);
  });
}

const app = express();
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    api: true,
    db: HAS_DATABASE_URL ? 'sql' : USE_FIREBASE ? 'firestore' : 'offline (no DATABASE_URL)',
    gemini: Boolean(process.env.GEMINI_API_KEY),
  });
});

function authSessionFromUser(u) {
  return {
    userId: u.id,
    email: u.email,
    role: u.role,
    studentId: u.studentId ?? null,
  };
}

function signToken(user) {
  return jwt.sign({ userId: user.id, role: user.role, studentId: user.studentId ?? null }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    role: user.role,
    university: user.university ?? null,
    department: user.department ?? null,
    summary: user.summary ?? null,
    readiness_score: Number(user.readiness_score ?? 50),
    skills: Array.isArray(user.skills) ? user.skills : [],
  };
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await firestore.collection('users').doc(decoded.uid).get();
    const userData = userSnap.data() || {};
    const role = String(userData.role || 'STUDENT').toUpperCase();
    
    req.auth = {
      userId: decoded.uid,
      email: decoded.email,
      role: role,
    };
    return next();
  } catch (firebaseErr) {
    const errorMessage = String(firebaseErr.message || firebaseErr);
    if (errorMessage.includes('credentials') || errorMessage.includes('Project Id') || errorMessage.includes('app')) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.iss && decoded.iss.startsWith('https://securetoken.google.com/')) {
          const users = db.users || [];
          const user = users.find(u => u.id === decoded.uid || u.email === decoded.email);
          const role = String((user && user.role) || 'RECRUITER').toUpperCase();
          
          req.auth = {
            userId: decoded.uid || decoded.sub,
            email: decoded.email,
            role: role,
          };
          return next();
        }
      } catch (decodeErr) {
        console.error('Offline Firebase ID token decode failed:', decodeErr);
      }
    }

    try {
      req.auth = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (jwtErr) {
      console.warn('Auth verification failed. Firebase:', firebaseErr.message || firebaseErr, 'JWT:', jwtErr.message || jwtErr);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

function requireRole(allowed) {
  return (req, res, next) => {
    if (!req.auth || !allowed.includes(req.auth.role)) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  };
}

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.users.find((u) => String(u.email).toLowerCase() === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const match = user.password_hash ? await bcrypt.compare(password, user.password_hash) : user.password === password;
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });
  const token = signToken(user);
  const student = user.studentId ? db.students.find((s) => s.id === user.studentId) : null;
  return res.json({ token, user: sanitizeUser(user), session: authSessionFromUser(user), student: student ?? null });
});

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  const role = req.body?.role === 'RECRUITER' ? 'RECRUITER' : 'STUDENT';
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (role === 'STUDENT' && !name) return res.status(400).json({ error: 'Display name required for students' });
  if (db.users.some((u) => String(u.email).toLowerCase() === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const userId = `u_${randomUUID().slice(0, 8)}`;
  if (role === 'RECRUITER') {
    const user = { id: userId, email, password_hash, role: 'RECRUITER', studentId: null, name };
    db.users.push(user);
    persist();
    return res.status(201).json({ token: signToken(user), user: sanitizeUser(user), session: authSessionFromUser(user), student: null });
  }
  const studentId = `st_${randomUUID().slice(0, 8)}`;
  const student = {
    id: studentId,
    name,
    university: 'Baba Guru Nanak University',
    department: '',
    readinessScore: 50,
    skills: [],
    projects: [],
    applications: [],
    profileComplete: false,
    email,
  };
  db.students.push(student);
  const user = {
    id: userId, email, password_hash, role: 'STUDENT', studentId, name,
    university: student.university, department: student.department, skills: student.skills.map((s) => s.name), summary: student.summary, readiness_score: student.readinessScore
  };
  db.users.push(user);
  persist();
  return res.status(201).json({ token: signToken(user), user: sanitizeUser(user), session: authSessionFromUser(user), student });
});

app.get('/api/bootstrap', (_req, res) => {
  db = seedIfEmpty(loadDb());
  const students = db.students.map((s) => ({
    id: s.id, name: s.name, email: s.email, role: 'student', university: s.university, department: s.department,
    skills: Array.isArray(s.skills) ? s.skills.map((x) => (typeof x === 'string' ? x : x.name)) : [],
    summary: s.summary ?? '', readiness_score: s.readinessScore ?? 50, projects: s.projects ?? [], applications: s.applications ?? []
  }));
  const internships = db.internships.map((i) => ({
    id: i.id, title: i.role, company: i.companyName, location: i.location, description: i.description, salary: i.stipend ?? '',
    tier: i.tier, requirements: i.requirements ?? [], recruiter_id: i.recruiter_id ?? null,
    applicants: db.students.filter((s) => s.applications?.some((a) => a.internshipId === i.id)).map((s) => s.id),
  }));
  res.json({ students, internships });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const user = db.users.find((u) => u.id === req.auth.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: sanitizeUser(user) });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const user = db.users.find((u) => u.id === req.auth.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { name, university, department, skills, summary } = req.body || {};
  if (name !== undefined) user.name = String(name);
  if (university !== undefined) user.university = String(university);
  if (department !== undefined) user.department = String(department);
  if (summary !== undefined) user.summary = String(summary);
  if (skills !== undefined) {
    if (!Array.isArray(skills)) return res.status(400).json({ error: 'skills must be an array' });
    user.skills = skills.map((s) => String(s));
  }
  if (user.studentId) {
    const st = db.students.find((s) => s.id === user.studentId);
    if (st) {
      if (name !== undefined) st.name = String(name);
      if (university !== undefined) st.university = String(university);
      if (department !== undefined) st.department = String(department);
      if (summary !== undefined) st.summary = String(summary);
      if (Array.isArray(skills)) st.skills = skills.map((s) => ({ name: String(s), isVerified: false }));
    }
  }
  persist();
  return res.json({ user: sanitizeUser(user) });
});

app.post('/api/apply/:internshipId', requireAuth, requireRole(['STUDENT']), (req, res) => {
  const user = db.users.find((u) => u.id === req.auth.userId);
  const student = user?.studentId ? db.students.find((s) => s.id === user.studentId) : null;
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const internship = db.internships.find((i) => i.id === req.params.internshipId);
  if (!internship) return res.status(404).json({ error: 'Internship not found' });
  if (student.applications.some((a) => a.internshipId === internship.id)) return res.status(400).json({ error: 'Already applied' });
  const application = { id: `app_${randomUUID().slice(0, 8)}`, student_id: student.id, internship_id: internship.id, status: 'PENDING', applied_at: new Date().toISOString() };
  student.applications.push({ internshipId: internship.id, status: 'PENDING', appliedDate: application.applied_at });
  db.applications = Array.isArray(db.applications) ? db.applications : [];
  db.applications.push(application);
  persist();
  return res.status(201).json({ success: true, application });
});

app.get('/api/applications', requireAuth, (req, res) => {
  if (req.auth.role === 'RECRUITER') {
    const rows = (db.applications || []).filter((a) => {
      const role = db.internships.find((i) => i.id === a.internship_id);
      return role?.recruiter_id === req.auth.userId;
    });
    return res.json({ applications: rows });
  }
  const user = db.users.find((u) => u.id === req.auth.userId);
  const rows = (db.applications || []).filter((a) => a.student_id === user?.studentId);
  return res.json({ applications: rows });
});

app.put('/api/applications/:id/status', requireAuth, requireRole(['RECRUITER']), (req, res) => {
  const status = String(req.body?.status || '');
  if (!['PENDING', 'INTERVIEWING', 'OFFERED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const row = (db.applications || []).find((a) => a.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Application not found' });
  row.status = status;
  const st = db.students.find((s) => s.id === row.student_id);
  if (st) {
    const appRow = st.applications.find((a) => a.internshipId === row.internship_id);
    if (appRow) appRow.status = status;
  }
  persist();
  return res.json({ application: row });
});

app.post('/api/cv/parse', requireAuth, requireRole(['STUDENT']), upload.single('cv'), async (req, res) => {
  const fallback = { skills: ['Communication', 'Problem Solving', 'Teamwork', 'Adaptability'], readiness_score: 68 };
  const user = db.users.find((u) => u.id === req.auth.userId);
  const student = user?.studentId ? db.students.find((s) => s.id === user.studentId) : null;
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!req.file) return res.status(400).json({ error: 'CV file is required' });
  let parsed = fallback;
  try {
    const out = await gemini.parseCV(req.file.buffer.toString('base64'), req.file.mimetype);
    parsed = {
      skills: Array.isArray(out.skills) && out.skills.length ? out.skills.map((s) => String(s)) : fallback.skills,
      readiness_score: Number.isFinite(Number(out.readiness_score)) ? Math.max(0, Math.min(100, Number(out.readiness_score))) : fallback.readiness_score,
    };
  } catch {}
  db.cvs = Array.isArray(db.cvs) ? db.cvs : [];
  db.cvs.push({ id: `cv_${randomUUID().slice(0, 8)}`, student_id: student.id, readiness_score: parsed.readiness_score, skills: parsed.skills, parsed_at: new Date().toISOString() });
  student.readinessScore = parsed.readiness_score;
  student.skills = parsed.skills.map((name) => ({ name, isVerified: false }));
  if (user) {
    user.readiness_score = parsed.readiness_score;
    user.skills = parsed.skills;
  }
  persist();
  return res.json(parsed);
});

app.post('/api/roles', requireAuth, requireRole(['RECRUITER']), (req, res) => {
  const { title, company, location, description, salary, tier, requirements } = req.body || {};
  if (!title || !company) return res.status(400).json({ error: 'title and company are required' });
  const role = { id: `i_${randomUUID().slice(0, 8)}`, recruiter_id: req.auth.userId, companyName: String(company), role: String(title), location: String(location || ''), description: String(description || ''), stipend: String(salary || ''), tier: tier || 'MEDIUM_TIER', requirements: Array.isArray(requirements) ? requirements : [] };
  db.internships.push(role);
  persist();
  return res.status(201).json({ role });
});

app.delete('/api/roles/:id', requireAuth, requireRole(['RECRUITER']), (req, res) => {
  const idx = db.internships.findIndex((i) => i.id === req.params.id && i.recruiter_id === req.auth.userId);
  if (idx === -1) return res.status(404).json({ error: 'Role not found' });
  db.internships.splice(idx, 1);
  persist();
  return res.json({ success: true });
});

app.post('/api/projects', requireAuth, requireRole(['STUDENT']), (req, res) => {
  const user = db.users.find((u) => u.id === req.auth.userId);
  const student = user?.studentId ? db.students.find((s) => s.id === user.studentId) : null;
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const { title, description, tech_stack, github_url } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
  const project = { id: `p_${randomUUID().slice(0, 8)}`, title: String(title), description: String(description), codeUrl: String(github_url || ''), isVerified: false, verificationStatus: 'PENDING', tech_stack: Array.isArray(tech_stack) ? tech_stack : [] };
  student.projects.push(project);
  db.projects = Array.isArray(db.projects) ? db.projects : [];
  db.projects.push({ id: project.id, student_id: student.id, title: project.title, description: project.description, tech_stack: project.tech_stack, github_url: project.codeUrl, status: 'PENDING' });
  persist();
  return res.status(201).json({ project });
});

app.put('/api/projects/:id/verify', requireAuth, requireRole(['RECRUITER']), (req, res) => {
  const status = String(req.body?.status || '');
  if (!['VERIFIED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  let updated = null;
  for (const student of db.students) {
    const project = student.projects.find((p) => p.id === req.params.id);
    if (project) {
      project.isVerified = status === 'VERIFIED';
      project.verificationStatus = status;
      updated = project;
      break;
    }
  }
  if (!updated) return res.status(404).json({ error: 'Project not found' });
  persist();
  return res.json({ project: updated });
});

app.post('/api/assessments/complete', requireAuth, requireRole(['STUDENT']), (req, res) => {
  const { challenge, score } = req.body || {};
  const numericScore = Number(score);
  if (!challenge || !Number.isFinite(numericScore)) return res.status(400).json({ error: 'challenge and score are required' });
  const readiness_bonus = Math.max(1, Math.min(15, Math.round(numericScore / 10)));
  const user = db.users.find((u) => u.id === req.auth.userId);
  const student = user?.studentId ? db.students.find((s) => s.id === user.studentId) : null;
  if (!student) return res.status(404).json({ error: 'Student not found' });
  student.readinessScore = Math.min(100, (student.readinessScore || 0) + readiness_bonus);
  db.assessments = Array.isArray(db.assessments) ? db.assessments : [];
  db.assessments.push({ id: `as_${randomUUID().slice(0, 8)}`, student_id: student.id, challenge: String(challenge), score: numericScore, readiness_bonus, completed_at: new Date().toISOString() });
  persist();
  return res.json({ readiness_bonus });
});

app.get('/api/students', (_req, res) => {
  res.json(db.students);
});

app.get('/api/students/:id', (req, res) => {
  const s = db.students.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Student not found' });
  res.json(s);
});

app.patch('/api/students/:id', (req, res) => {
  const idx = db.students.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Student not found' });
  const prev = db.students[idx];
  const body = req.body || {};
  const next = { ...prev, ...body, id: prev.id };
  if (body.skills && !Array.isArray(body.skills)) return res.status(400).json({ error: 'skills must be an array' });
  if (body.projects && !Array.isArray(body.projects)) return res.status(400).json({ error: 'projects must be an array' });
  if (body.applications && !Array.isArray(body.applications)) return res.status(400).json({ error: 'applications must be an array' });
  db.students[idx] = next;
  persist();
  res.json(next);
});

app.post('/api/students', (req, res) => {
  const body = req.body || {};
  const id = body.id || `st_${randomUUID().slice(0, 8)}`;
  const student = {
    id,
    name: body.name || 'New Student',
    university: body.university || 'Baba Guru Nanak University',
    department: body.department || '',
    readinessScore: typeof body.readinessScore === 'number' ? body.readinessScore : 50,
    skills: Array.isArray(body.skills) ? body.skills : [],
    projects: Array.isArray(body.projects) ? body.projects : [],
    applications: Array.isArray(body.applications) ? body.applications : [],
    profileComplete: Boolean(body.profileComplete),
    email: body.email,
    phone: body.phone,
    summary: body.summary,
    resumeUrl: body.resumeUrl,
  };
  db.students.push(student);
  persist();
  res.status(201).json(student);
});

app.get('/api/internships', (_req, res) => {
  res.json(db.internships);
});

app.post('/api/internships', (req, res) => {
  const body = req.body || {};
  const item = {
    id: `i_${randomUUID().slice(0, 8)}`,
    companyName: body.companyName || '',
    role: body.role || '',
    tier: body.tier || 'FOUNDATIONAL',
    location: body.location || '',
    stipend: body.stipend,
    description: body.description || '',
    requirements: Array.isArray(body.requirements) ? body.requirements : [],
  };
  db.internships.push(item);
  persist();
  res.status(201).json(item);
});

app.delete('/api/internships/:id', (req, res) => {
  const before = db.internships.length;
  db.internships = db.internships.filter((i) => i.id !== req.params.id);
  if (db.internships.length === before) return res.status(404).json({ error: 'Not found' });
  persist();
  res.status(204).end();
});

app.post('/api/students/:id/applications', (req, res) => {
  const student = db.students.find((x) => x.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const internshipId = req.body?.internshipId;
  if (!internshipId) return res.status(400).json({ error: 'internshipId required' });
  if (student.applications.some((a) => a.internshipId === internshipId)) {
    return res.json(student);
  }
  student.applications.push({
    internshipId,
    status: 'SUBMITTED',
    appliedDate: new Date().toISOString(),
  });
  persist();
  res.json(student);
});

app.patch('/api/students/:sid/applications/:iid', (req, res) => {
  const student = db.students.find((x) => x.id === req.params.sid);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const status = req.body?.status;
  if (!status) return res.status(400).json({ error: 'status required' });
  const appRow = student.applications.find((a) => a.internshipId === req.params.iid);
  if (!appRow) return res.status(404).json({ error: 'Application not found' });
  appRow.status = status;
  persist();
  res.json(student);
});

app.post('/api/students/:id/projects', (req, res) => {
  const student = db.students.find((x) => x.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const body = req.body || {};
  const project = {
    id: `p_${randomUUID().slice(0, 8)}`,
    title: body.title || '',
    description: body.description || '',
    codeUrl: body.codeUrl || '',
    demoUrl: body.demoUrl,
    isVerified: false,
    verificationStatus: 'PENDING',
  };
  student.projects.push(project);
  persist();
  res.status(201).json({ student, project });
});

app.patch('/api/students/:sid/projects/:pid/verify', (req, res) => {
  const student = db.students.find((x) => x.id === req.params.sid);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const status = req.body?.status;
  if (status !== 'VERIFIED' && status !== 'REJECTED') {
    return res.status(400).json({ error: 'status must be VERIFIED or REJECTED' });
  }
  const project = student.projects.find((p) => p.id === req.params.pid);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  project.isVerified = status === 'VERIFIED';
  project.verificationStatus = status;

  const updatedSkills = student.skills.map((skill) => {
    if (status === 'VERIFIED' && !skill.isVerified) {
      const proj = student.projects.find((p) => p.id === req.params.pid);
      if (proj && (proj.title.includes(skill.name) || proj.description.includes(skill.name))) {
        return { ...skill, isVerified: true, evidenceSource: req.params.pid };
      }
    }
    return skill;
  });
  student.skills = updatedSkills;
  const bonus = status === 'VERIFIED' ? 10 : 0;
  student.readinessScore = Math.min(100, student.readinessScore + bonus);
  persist();
  res.json(student);
});

app.post('/api/students/:id/readiness', (req, res) => {
  const student = db.students.find((x) => x.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const delta = Number(req.body?.delta);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: 'delta must be a number' });
  student.readinessScore = Math.min(100, Math.max(0, student.readinessScore + delta));
  persist();
  res.json(student);
});

/** AI proxy — keeps API keys off the client in production */
app.post('/api/ai/analyze-profile', async (req, res) => {
  try {
    const { skills, projects, targetRole } = req.body || {};
    const out = await gemini.analyzeStudentProfile(skills || [], projects || [], targetRole);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/ai/parse-cv', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body || {};
    if (!base64Data || !mimeType) return res.status(400).json({ error: 'base64Data and mimeType required' });
    const out = await gemini.parseCV(base64Data, mimeType);
    if (!out || (!out.name && !out.summary && !(out.skills || []).length)) {
      return res.status(422).json({ error: 'Could not extract details from this CV. Try another file or enter manually.' });
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/ai/parse-cv-text', async (req, res) => {
  try {
    const { textContent } = req.body || {};
    if (!textContent || !String(textContent).trim()) {
      return res.status(400).json({ error: 'textContent required' });
    }
    const out = await gemini.parseCVText(String(textContent));
    if (!out || (!out.name && !out.summary && !(out.skills || []).length)) {
      return res.status(422).json({ error: 'Could not extract details from this CV text.' });
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/ai/generate-cv', async (req, res) => {
  try {
    const { student, jobDescription } = req.body || {};
    const out = await gemini.generateCVContent(student, jobDescription);
    res.json(out ?? {});
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/ai/candidate-signal', async (req, res) => {
  try {
    const { student, internship } = req.body || {};
    const text = await gemini.generateCandidateSignal(student, internship);
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/ai/prep-kit', async (req, res) => {
  try {
    const { student, internship } = req.body || {};
    const questions = await gemini.generatePreparationKit(student, internship);
    res.json({ questions });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/ai/recommendations', async (req, res) => {
  try {
    const { student, internships } = req.body || {};
    const items = await gemini.getRoleRecommendations(student, internships || []);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/ai/project-prep', async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const questions = await gemini.generateProjectPrepQuestions(title || '', description || '');
    res.json({ questions });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/violations/report-fake-job', requireAuth, requireRole(['RECRUITER']), async (req, res) => {
  try {
    const { jobData, confidence, source, reason } = req.body || {};
    if (!jobData || !jobData.id) {
      return res.status(400).json({ error: 'jobData and jobData.id are required.' });
    }

    const userId = req.auth.userId;

    if (!USE_FIREBASE) {
      const violationId = `v_${randomUUID().slice(0, 8)}`;
      if (!db.violations) db.violations = [];
      db.violations.push({
        id: violationId,
        userId,
        violationType: 'FAKE_LISTING',
        severity: confidence > 85 ? 'HIGH' : 'MEDIUM',
        description: reason,
        metadata: {
          jobTitle: jobData.title || '',
          jobId: jobData.id,
          confidence: confidence || 50,
          source: source || 'Hugging Face Space',
        },
        createdAt: new Date().toISOString(),
        resolved: false,
      });

      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: `n_${randomUUID().slice(0, 8)}`,
        userId,
        recipientId: userId,
        type: 'AUTO_VIOLATION_WARNING',
        title: '⚠️ Auto Violation Warning',
        message: `Your job posting '${jobData.title || 'Untitled Job'}' has been flagged for potential policy violations: ${reason}. Please review our posting guidelines.`,
        status: 'UNREAD',
        read: false,
        createdAt: new Date().toISOString(),
      });

      persist();
      return res.json({ success: true, violationId, localFallback: true });
    }

    // 1. Fetch the job document and verify owner (postedBy)
    const jobRef = firestore.collection('jobs').doc(jobData.id);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const job = jobSnap.data();
    if (job.postedBy !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this job listing.' });
    }

    // 2. Immediately flag and block/close listing in Firestore
    await jobRef.update({
      status: 'Closed',
      isSuspicious: true,
      verificationStatus: 'REJECTED',
    });

    // 3. Create violation document
    const violationRef = firestore.collection('violations').doc();
    const violationId = violationRef.id;
    await violationRef.set({
      id: violationId,
      userId,
      violationType: 'FAKE_LISTING',
      severity: confidence > 85 ? 'HIGH' : 'MEDIUM',
      description: reason,
      metadata: {
        jobTitle: jobData.title || '',
        jobId: jobData.id,
        confidence: confidence || 50,
        source: source || 'Hugging Face Space',
      },
      createdAt: FieldValue.serverTimestamp(),
      resolved: false,
    });

    // 4. Send notification to recruiter
    const recruiterNotificationRef = firestore.collection('notifications').doc();
    await recruiterNotificationRef.set({
      id: recruiterNotificationRef.id,
      userId,
      recipientId: userId,
      type: 'AUTO_VIOLATION_WARNING',
      title: '⚠️ Auto Violation Warning',
      message: `Your job posting '${jobData.title || 'Untitled Job'}' has been flagged for potential policy violations: ${reason}. Please review our posting guidelines.`,
      status: 'UNREAD',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 5. Send notification to all admins
    const adminsSnapshot = await firestore.collection('users').where('role', '==', 'admin').get();
    const adminNotificationsPromises = adminsSnapshot.docs.map(adminDoc => {
      const adminNotificationRef = firestore.collection('notifications').doc();
      return adminNotificationRef.set({
        id: adminNotificationRef.id,
        userId: adminDoc.id,
        recipientId: adminDoc.id,
        type: 'NEW_VIOLATION',
        title: 'New Policy Violation',
        message: `New violation detected: Fake listing from recruiter ${userId}`,
        status: 'UNREAD',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await Promise.all(adminNotificationsPromises);

    res.json({ success: true, violationId });
  } catch (e) {
    console.error('Error reporting fake job:', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/violations/predict-fake-job', requireAuth, async (req, res) => {
  try {
    const { title, description, stipend } = req.body || {};
    const response = await axios.post(
      'https://shoaibliaqat-fake-job-detector.hf.space/predict',
      { title, description, stipend },
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    res.json(response.data);
  } catch (e) {
    console.error('Error in proxying fake job prediction:', e);
    // Return standard fallback if HF prediction fails or times out
    res.json({
      isSuspicious: true,
      confidence: 50.0,
    });
  }
});

app.get('/api/reports/talent-csv', (_req, res) => {
  const lines = [
    ['id', 'name', 'department', 'readinessScore', 'verifiedProjects', 'applications'].join(','),
    ...db.students.map((s) =>
      [
        s.id,
        JSON.stringify(s.name),
        JSON.stringify(s.department),
        s.readinessScore,
        s.projects.filter((p) => p.verificationStatus === 'VERIFIED').length,
        s.applications.length,
      ].join(',')
    ),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="talent-pool.csv"');
  res.send(lines.join('\n'));
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  if (!HAS_DATABASE_URL && !USE_FIREBASE) {
    console.warn('DATABASE_URL not set. Using JSON store fallback mode.');
  }
  console.log(`CareerHunt API running on port ${PORT}`);
  console.log(`Database mode: ${HAS_DATABASE_URL ? 'sql' : USE_FIREBASE ? 'firestore' : 'json-fallback'}`);
});
