# CareerHunt — FYP Documentation Brief

> This file contains all the factual details of the CareerHunt project, organized to match the
> typical FYP report structure (Introduction → Objectives → Literature/Existing Systems →
> Methodology → System Design → Implementation → Testing → Conclusion & Future Work).
> The writer can expand each section into full prose.

---

## 1. Project Title & One-line Summary

**CareerHunt** — an AI-powered internship platform that connects university students with
recruiters, featuring AI CV parsing, readiness scoring, project verification, skill assessments,
in-app chat/interviews, and an AI-assisted trust & safety (moderation) system.

## 2. Problem Statement

- Students struggle to find internships matched to their actual skill level, and their CVs are
  often not optimized for applicant tracking systems (ATS).
- Recruiters cannot easily verify whether the skills and projects a student claims are real.
- Existing job boards have no protection against fake listings, ghosting recruiters, or spam,
  and no structured way to prove candidate readiness.

CareerHunt addresses these by (a) using AI (Google Gemini) to parse CVs, score readiness, and
recommend roles; (b) verifying student projects and skills with evidence; and (c) building an
AI-assisted reporting/moderation pipeline that detects fake jobs and bad actors.

## 3. Objectives

1. Provide role-based portals for three actors: **Student**, **Recruiter**, **Admin**.
2. Automate CV parsing and profile creation using a large language model (Gemini).
3. Compute an **AI Readiness Score** and personalized learning roadmap for each student.
4. Offer a tiered internship marketplace (Top-tier / Medium-tier / Foundational) with
   application tracking (Pending / Accepted / Rejected).
5. Enable direct recruiter–student communication: real-time chat (text, voice, file, location,
   image) and interview scheduling with meeting links.
6. Assess students through an assessment engine and an AI voice assessor.
7. Protect the platform with a report → AI analysis → defense → strike/ban moderation workflow.

## 4. Users & Roles

| Role | Capabilities |
|---|---|
| **Student** | Register/login, complete profile (university, degree, skills, projects, links), upload CV for AI parsing, browse/save/apply to internships, take assessments, use CV optimizer, chat with recruiters, attend interviews, report abuse, appeal bans |
| **Recruiter** | Company profile, post/close internship listings (with tier, stipend, skills, requirements), review applicants and student profiles, accept/reject applications, schedule interviews, chat, submit defenses against reports |
| **Admin** | Admin dashboard, user management (students / companies), report management & moderation panel, audit log viewer, ban/strike/appeal handling |

## 5. Core Modules (map these to chapters/sections)

### 5.1 Authentication & Authorization
- Firebase Authentication on the frontend (email/password; Google OAuth library included).
- Role-based access via `ProtectedRoute` (students/recruiters) and `ProtectedAdminRoute` (admin),
  with separate `/auth` and `/admin/login` entry points.
- The standalone backend adds bcrypt (12 rounds) password hashing and JWT access + refresh
  tokens (refresh tokens hashed in DB), with rate limiting (auth 5/min, API 100/min).

### 5.2 Student Profile & CV Intelligence (AI)
Implemented in `services/geminiService.ts` using the Gemini API:
- `parseCV` / `parseCVText` — extract structured profile data (skills, education, summary) from
  an uploaded CV (PDF/image base64 or plain text), with a safe fallback payload if AI fails.
- `analyzeStudentProfile` — produces `AIAnalysisResult`: readiness **score**, learning
  **roadmap** (courses/projects/skills), job **compatibility**, **ATS keywords**, and an
  **industry readiness** label.
- `generateCVContent` — AI CV optimizer, optionally tailored to a job description.
- `getRoleRecommendations` — ranks open internships for a student with score + reason.
- `generatePreparationKit` — interview preparation checklist for a specific internship.
- `getElitePathInsights` — CV loopholes (with severity), improvement fixes, market trends
  (HOT/GROWING/STABLE), and best-skills-to-learn-next with estimated learning time.
- `generateCandidateSignal` — a recruiter-facing summary signal of a candidate.

### 5.3 Internship Marketplace & Applications
- Jobs have tiers: `TOP_TIER` (paid/high-stakes), `MEDIUM_TIER`, `FOUNDATIONAL` (free).
- Job fields: title, company, location, stipend, description, required skills, requirements,
  status (Open/Closed), applications count.
- Students can save jobs and apply; application status lifecycle: Pending → Accepted/Rejected;
  students can withdraw applications.

### 5.4 Projects & Verification
- Students add projects (title, description, code URL, demo URL).
- Each project has a verification workflow: `PENDING → VERIFIED / REJECTED`, feeding into
  verified skills (each skill records whether it's verified and its evidence source —
  a project ID or assessment ID). Project gallery UI (`ProjectGallery.tsx`) and
  AI spot-check component (`AISpotCheck.tsx`).

### 5.5 Assessments
- `AssessmentEngine.tsx` — structured skill assessments.
- `VoiceAssessor.tsx` — AI voice-based assessment for a target role (e.g., Software Engineer).

### 5.6 Communication: Chat & Interviews
- Firestore-backed chat: `chats` collection with `messages` subcollection; two-participant
  conversations with last-message preview and read receipts.
- Message types: text, voice, file, location, image, and **interview** (interview invites
  carry meeting link, scheduled time, duration, and application ID).
- `InterviewDoc` records interviews between student and recruiter tied to an application;
  `InterviewOverlay.tsx` + `InterviewContext.tsx` handle the in-app experience.
- Notification system (`NotificationDropdown`, `Notifications.tsx`) with typed notifications
  (INFO, SUCCESS, ERROR, ban warnings, report updates, appeal status, etc.).

### 5.7 Trust & Safety / Moderation (a distinguishing FYP feature)
- Users can **report** other users or job listings with reason, description, and evidence URLs.
- **AI report analysis** (`analyzeReport`): Gemini assigns severity (LOW/MEDIUM/HIGH), a
  summary, a suggested action (WARN / SHADOW_BAN / PERMANENT_BAN / DISMISS), and a confidence
  score.
- Accused recruiters can submit a **defense** with evidence; `compareReportAndDefense` uses AI
  to weigh both sides. A defense deadline countdown is shown (`DefenseCountdown.tsx`).
- Report status machine: `PENDING → AWAITING_ADMIN → DEFENSE_PENDING → AUTO_BAN_SCHEDULED →
  RESOLVED / APPEALED`.
- Automated services: `fakeJobDetectorService.ts` (detects fraudulent listings),
  `violationDetector.ts` (violation types: FAKE_LISTING, GHOSTING, SPAM_REPORT,
  PROFILE_INCOMPLETE), `banScheduler.ts` (schedules automatic bans).
- User standing fields: strike count, warning count, report count, unique reporter count,
  shadow ban, temporary/permanent ban, ban reason, appeal workflow
  (none/pending/approved/rejected).
- Admin tooling: Report Management, Moderation Panel, User Management, Audit Log Viewer.

### 5.8 Admin Dashboard
- Global stats dashboard, user/company/student management views, audit trail, settings (WIP).

## 6. System Architecture

```
┌────────────────────────────────────────────────────────┐
│  Frontend: React 19 + TypeScript + Vite + Tailwind CSS │
│  (react-router-dom v7, zustand state, react-hot-toast) │
└──────────────┬─────────────────────────┬───────────────┘
               │                         │
     Firebase Auth + Firestore     Gemini AI proxy
     (primary data layer:          (Express server —
      users, jobs, applications,    server/gemini.mjs —
      chats, notifications,         keeps API key off
      reports, violations)          the client)
               │
   ┌───────────┴───────────────────────────────┐
   │  Production backend (Phase 1, in /backend)│
   │  Express + Prisma + PostgreSQL (Docker),  │
   │  JWT + refresh tokens, Helmet, CORS,      │
   │  rate limiting, audit logging             │
   └───────────────────────────────────────────┘
```

- **Current working system:** the React app talks directly to Firebase Auth + Firestore, and
  calls a small Express server that proxies Gemini AI requests (so the API key stays server-side)
  and handles file upload (multer).
- **Legacy prototype:** a JSON-file-backed Express API (`server/index.mjs`, `server/store.mjs`)
  with a PostgreSQL schema + seed script (`server/schema.sql`, `server/seed.js`).
- **Production migration path (documented in `docs/PRODUCTION_ROADMAP.md`):** a Prisma +
  PostgreSQL backend with entities Users, Students, Skills, Projects, Internships, Applications,
  Assessments (+questions, results), CVHistory, AuditLog, RefreshToken; Docker Compose for
  Postgres; security baseline (Helmet, CORS, body limits, rate limits); audit trail on all auth
  events. Future steps listed: full REST migration, AI job queues (Bull/Redis), S3 + ClamAV file
  scanning, Redis caching, Jest/supertest/Playwright test suites and CI.

## 7. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.8, Vite 6, Tailwind CSS 3.4, React Router 7, Zustand, react-hot-toast, react-icons |
| Auth & Data | Firebase Authentication, Cloud Firestore (with `firestore.rules` security rules), @react-oauth/google |
| AI | Google Gemini API (`@google/genai`) via server-side proxy |
| Backend | Node.js + Express 4, JWT (jsonwebtoken), bcryptjs, multer (uploads), CORS, dotenv |
| Database (production track) | PostgreSQL (pg / Prisma), Docker Compose |
| Tooling | npm, Vite build, PostCSS/Autoprefixer |

## 8. Data Model (key Firestore collections / entities)

- **users** (`UserProfile`): uid, name, email, role, profile completeness, student fields
  (university, degree, department, phone, CV text/URL, summary, skills[], projects[],
  savedJobs[], applications[], aiReadinessScore, industryReadiness, portfolio/GitHub/LinkedIn),
  recruiter fields (company, companyId, position), and moderation fields (bans, strikes,
  warnings, appeal status).
- **jobs / internships** (`Job`): tiered listings with skills, requirements, status, counts.
- **projects** (`ProjectDoc`): top-level collection keyed to studentId with verification status.
- **applications** (`ApplicationDoc`): studentId + jobId + status + timestamps.
- **chats** → **messages** subcollection (`ChatDoc`, `MessageDoc`): multi-type messages.
- **interviews** (`InterviewDoc`): scheduling records tied to applications.
- **notifications** (`NotificationDoc`): typed, read/unread.
- **reports** (`ReportDoc`): reporter/reported parties, evidence, AI analysis, defense,
  deadlines, status machine.
- **violations** (`ViolationDoc`): typed automated violations with severity and resolution.

(For the SQL/Prisma track: Users, Students, Skills, Projects, Internships, Applications,
Assessments + Questions + Results, CVHistory, AuditLog, RefreshToken.)

## 9. Security Measures (for the "Security" section)

- Firebase Auth session management + Firestore security rules (`firestore.rules`).
- Role-gated routing on the client (student/recruiter/admin separation).
- Gemini API key kept server-side behind a proxy endpoint; safe AI fallback responses.
- Backend track: bcrypt(12) hashing, short-lived JWT access tokens + hashed refresh tokens,
  Helmet security headers, configurable CORS, request body size limits, per-route rate limiting,
  and an audit log of auth events (register/login/refresh/logout).

## 10. How to Run (for the "Implementation/Deployment" appendix)

1. `npm install`
2. Copy `.env.example` → `.env.local`; set `GEMINI_API_KEY`, `JWT_SECRET`, and the six
   `VITE_FIREBASE_*` variables for your Firebase project.
3. `npm run dev` → app at http://localhost:3000 (Firebase-powered; the legacy API server
   `npm run server` is optional).
4. Optional SQL backend: `createdb careerhunt`, then `npm run db:schema` and `npm run db:seed`
   with `DATABASE_URL` set. Docker Compose is available for Postgres.

Demo accounts: students `student@demo.com/demo123`, `ahmed@gmail.com`, `sara@gmail.com`;
recruiter `recruiter@gmail.com` (password `shoaib` for the last three).

## 11. Application Routes (useful for screenshots/appendix)

Public: `/auth`, `/admin/login`, `/status`, branded 404.
Student/Recruiter (protected): `/dashboard`, `/marketplace`, `/profile`, `/gallery`,
`/cv-optimizer`, `/assessments`, `/voice-assessor`, `/applications`, `/notifications`,
`/reports`, `/chat`, `/chat/:conversationId`.
Admin (protected): `/admin/dashboard`, `/admin/reports`, `/admin/moderation`, `/admin/users`,
`/admin/companies`, `/admin/students`, `/admin/audit`, `/admin/settings` (WIP).

## 12. Limitations & Future Work (be honest here — examiners like this)

- Full REST backend migration from Firebase/legacy JSON API to the Prisma + PostgreSQL service
  is in progress (Phase 1 complete per the production roadmap).
- AI processing is synchronous; queued background jobs (Bull/Redis) are planned.
- File-upload virus scanning (ClamAV) and S3 storage are planned, not implemented.
- Automated test suites (Jest, supertest, Playwright) and CI are planned.
- Admin settings page is a work in progress.
- A companion **mobile app** is implied by the schema design (types are explicitly aligned with
  a mobile client) — mention it if it's part of the FYP scope.

## 13. Suggested FYP Report Chapter Mapping

1. **Introduction** — §1, §2
2. **Objectives & Scope** — §3, §4
3. **Literature Review / Existing Systems** — compare with LinkedIn, Indeed, Internshala:
   none combine AI readiness scoring + project verification + AI moderation.
4. **Requirements & Analysis** — derive functional requirements from §5, non-functional from §9.
5. **System Design** — §6 (architecture diagram), §8 (ERD/data model), use-case diagrams from §4.
6. **Implementation** — §5 (modules), §7 (stack), §10, §11.
7. **Testing** — manual test cases per module; note automated testing as future work (§12).
8. **Conclusion & Future Work** — §12.
