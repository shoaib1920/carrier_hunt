# CareerHunt

AI-powered internship platform for students and recruiters, with CV parsing, readiness scoring, project verification, and application tracking.

## Logo

`[Add CareerHunt logo here]`

## Features

- JWT-based login/register API with protected profile, applications, projects, roles, and assessments routes
- Bootstrap API for students/internships with realistic seeded demo data
- CV parse endpoint with Gemini integration and safe fallback payload on failure
- Recruiter and student dashboards, marketplace workflows, and verification flows
- Premium UI polish: design system, improved auth screen, upgraded sidebar, toast feedback, transitions
- Status page at `/status` and branded not-found page handling

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Express (Node.js), JWT, bcrypt, multer
- AI: Gemini API proxy
- Database scripts: PostgreSQL schema + seed script

## Local Setup

1. Install dependencies
   - `npm install`
2. Create environment file
   - Copy `.env.example` to `.env.local`
   - Add `GEMINI_API_KEY` for AI features
   - Add `JWT_SECRET`
3. Start the frontend
   - `npm run dev`
4. Open frontend
   - [http://localhost:3000](http://localhost:3000)

> The React app uses Firebase Auth and Firestore directly. You do not need to run `npm run server` unless you want the legacy JSON-backed API server.

### Database setup (required for full backend features)

The frontend itself is Firebase-powered and stores user data in Firestore.

If you want to use the legacy SQL backend instead, run:

```bash
createdb careerhunt
DATABASE_URL=postgresql://localhost/careerhunt npm run db:schema
DATABASE_URL=postgresql://localhost/careerhunt npm run db:seed
```

If PostgreSQL is not installed/running locally, install PostgreSQL first, run `createdb careerhunt`, then set `DATABASE_URL`.

### Firebase setup

To use your own Firebase project for the frontend, set the following environment variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

For the backend Firestore service account, use `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_KEY` in the `backend/` project.

## Optional PostgreSQL Setup

1. Set `DATABASE_URL` in environment
2. Run schema
   - `npm run db:schema`
3. Seed realistic records
   - `npm run db:seed`

## Demo Credentials

- Student: `student@demo.com` / `demo123`
- Student: `ahmed@gmail.com` / `shoaib`
- Student: `sara@gmail.com` / `shoaib`
- Recruiter: `recruiter@gmail.com` / `shoaib`

## Screenshots

- `[Add Auth screen screenshot]`
- `[Add Student dashboard screenshot]`
- `[Add Recruiter marketplace screenshot]`
