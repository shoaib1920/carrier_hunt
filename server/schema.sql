CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'student',
  university VARCHAR(255),
  department VARCHAR(255),
  skills JSONB DEFAULT '[]',
  summary TEXT,
  readiness_score INTEGER DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internships (
  id SERIAL PRIMARY KEY,
  recruiter_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  salary VARCHAR(100),
  tier INTEGER DEFAULT 2,
  requirements JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES users(id),
  internship_id INTEGER REFERENCES internships(id),
  status VARCHAR(50) DEFAULT 'PENDING',
  applied_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, internship_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES users(id),
  title VARCHAR(255),
  description TEXT,
  tech_stack JSONB DEFAULT '[]',
  github_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'PENDING',
  verified_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cvs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES users(id),
  readiness_score INTEGER,
  skills JSONB DEFAULT '[]',
  parsed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES users(id),
  challenge VARCHAR(255),
  score INTEGER,
  readiness_bonus INTEGER,
  completed_at TIMESTAMP DEFAULT NOW()
);
