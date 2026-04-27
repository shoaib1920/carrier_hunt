
export enum UserRole {
  STUDENT = 'STUDENT',
  RECRUITER = 'RECRUITER',
  ADMIN = 'ADMIN'
}

export enum InternshipTier {
  TOP = 'TOP_TIER', // Paid/High-Stakes
  MEDIUM = 'MEDIUM_TIER', // Fee/Mid-Range
  FOUNDATIONAL = 'FOUNDATIONAL' // Free
}

export type ApplicationStatus = 'SUBMITTED' | 'PENDING' | 'INTERVIEWING' | 'OFFERED' | 'REJECTED';

export interface Application {
  internshipId: string;
  status: ApplicationStatus;
  appliedDate: string;
}

export interface Skill {
  name: string;
  isVerified: boolean;
  evidenceSource?: string; // e.g., Project ID or Assessment ID
}

export interface StudentProfile {
  id: string;
  name: string;
  university: string;
  department: string;
  readinessScore: number;
  skills: Skill[];
  projects: Project[];
  resumeUrl?: string;
  applications: Application[];
  profileComplete: boolean;
  email?: string;
  phone?: string;
  summary?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  codeUrl: string;
  demoUrl?: string;
  isVerified: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface Internship {
  id: string;
  companyName: string;
  role: string;
  tier: InternshipTier;
  location: string;
  stipend?: string;
  description: string;
  requirements: string[];
}

export interface RoadmapItem {
  type: 'COURSE' | 'PROJECT' | 'SKILL';
  title: string;
  provider?: string;
  description: string;
}

export interface AIAnalysisResult {
  score: number;
  roadmap: RoadmapItem[];
  compatibility: number;
  atsKeywords: string[];
}
