import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'schema.sql');
const DATABASE_URL = process.env.DATABASE_URL;
const runSchemaOnly = process.argv.includes('--schema');

const users = [
  { name: 'TechCorp Talent', email: 'recruiter@demo.com', password: 'demo123', role: 'recruiter' },
  { name: 'Arbisoft HR', email: 'arbisoft@demo.com', password: 'demo123', role: 'recruiter' },
  { name: 'Ali Hassan', email: 'student@demo.com', password: 'demo123', role: 'student', university: 'COMSATS Lahore', department: 'Computer Science', readiness_score: 78, skills: ['React', 'Node.js', 'PostgreSQL', 'Python'] },
  { name: 'Fatima Malik', email: 'fatima@demo.com', password: 'demo123', role: 'student', university: 'NUST Islamabad', department: 'AI', readiness_score: 85, skills: ['Machine Learning', 'Python', 'TensorFlow', 'Data Analysis'] },
  { name: 'Usman Khan', email: 'usman@demo.com', password: 'demo123', role: 'student', university: 'FAST NUCES', department: 'Software Engineering', readiness_score: 62, skills: ['Flutter', 'Dart', 'Firebase', 'UI Design'] },
  { name: 'Sara Ahmed', email: 'sara@demo.com', password: 'demo123', role: 'student', university: 'LUMS Lahore', department: 'Management Science', readiness_score: 91, skills: ['Product Management', 'Figma', 'SQL', 'Business Analysis'] },
  { name: 'Bilal Raza', email: 'bilal@demo.com', password: 'demo123', role: 'student', university: 'UET Lahore', department: 'Electrical Engineering', readiness_score: 55, skills: ['C++', 'Embedded Systems', 'Arduino', 'IoT'] },
  { name: 'Zara Siddiqui', email: 'zara@demo.com', password: 'demo123', role: 'student', university: 'IBA Karachi', department: 'Computer Science', readiness_score: 73, skills: ['React Native', 'TypeScript', 'AWS', 'GraphQL'] },
];

const internships = [
  ['Google', 'Software Engineering Intern', 'Remote / Islamabad', 'PKR 120,000/month', 1, ['Python', 'Data Structures', 'Algorithms']],
  ['Arbisoft', 'Full Stack Developer Intern', 'Lahore', 'PKR 45,000/month', 1, ['React', 'Django', 'PostgreSQL']],
  ['Systems Limited', 'Business Analyst Intern', 'Lahore', 'PKR 35,000/month', 2, ['SQL', 'Excel', 'Business Writing']],
  ['Careem', 'Product Management Intern', 'Karachi', 'PKR 55,000/month', 1, ['Product Thinking', 'Figma', 'Analytics']],
  ['Daraz', 'Data Science Intern', 'Lahore', 'PKR 40,000/month', 2, ['Python', 'Machine Learning', 'SQL']],
  ['10Pearls', 'React Developer Intern', 'Islamabad', 'PKR 38,000/month', 2, ['React', 'TypeScript', 'REST APIs']],
  ['Netsol Technologies', 'QA Engineer Intern', 'Lahore', 'PKR 30,000/month', 2, ['Manual Testing', 'JIRA', 'SQL']],
  ['Jazz', 'Mobile App Intern', 'Islamabad', 'PKR 42,000/month', 2, ['Flutter', 'Firebase', 'UX Design']],
  ['Bykea', 'Backend Engineering Intern', 'Karachi', 'PKR 35,000/month', 3, ['Node.js', 'MongoDB', 'REST APIs']],
  ['Telenor', 'Cloud Infrastructure Intern', 'Islamabad', 'PKR 48,000/month', 1, ['AWS', 'Linux', 'DevOps']],
  ['Microsoft', 'Azure Engineering Intern', 'Remote', 'PKR 130,000/month', 1, ['C#', 'Azure', 'Distributed Systems']],
  ['Teradata', 'Data Engineering Intern', 'Remote', 'PKR 75,000/month', 1, ['SQL', 'Python', 'Data Warehousing']],
];

async function run() {
  if (!DATABASE_URL) {
    console.log('DATABASE_URL missing. Skipping SQL schema/seed run.');
    return;
  }
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    if (runSchemaOnly) {
      console.log('Schema executed.');
      return;
    }
    await client.query('BEGIN');
    await client.query('TRUNCATE assessments, cvs, projects, applications, internships, users RESTART IDENTITY CASCADE');

    const idByEmail = new Map();
    for (const u of users) {
      const password_hash = await bcrypt.hash(u.password, 10);
      const result = await client.query(
        `INSERT INTO users(name,email,password_hash,role,university,department,skills,summary,readiness_score)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [u.name, u.email, password_hash, u.role, u.university ?? null, u.department ?? null, JSON.stringify(u.skills ?? []), 'Profile seeded for demo.', u.readiness_score ?? 50]
      );
      idByEmail.set(u.email, result.rows[0].id);
    }

    const recruiterIds = [idByEmail.get('recruiter@demo.com'), idByEmail.get('arbisoft@demo.com')];
    const internshipIds = [];
    for (let i = 0; i < internships.length; i += 1) {
      const [company, title, location, salary, tier, requirements] = internships[i];
      const result = await client.query(
        `INSERT INTO internships(recruiter_id,title,company,location,description,salary,tier,requirements)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [recruiterIds[i % recruiterIds.length], title, company, location, `${title} position at ${company}.`, salary, tier, JSON.stringify(requirements)]
      );
      internshipIds.push(result.rows[0].id);
    }

    const studentEmails = ['student@demo.com', 'fatima@demo.com', 'usman@demo.com', 'sara@demo.com', 'bilal@demo.com', 'zara@demo.com'];
    const statuses = ['PENDING', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'PENDING', 'INTERVIEWING', 'OFFERED', 'PENDING', 'REJECTED', 'INTERVIEWING'];
    for (let i = 0; i < 10; i += 1) {
      const studentId = idByEmail.get(studentEmails[i % studentEmails.length]);
      const internshipId = internshipIds[i % internshipIds.length];
      await client.query(
        `INSERT INTO applications(student_id, internship_id, status) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [studentId, internshipId, statuses[i]]
      );
    }

    await client.query('COMMIT');
    console.log('Seed completed.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
