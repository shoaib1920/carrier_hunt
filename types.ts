import type { Timestamp } from 'firebase/firestore';

export enum UserRole {
  STUDENT = 'student',
  RECRUITER = 'recruiter',
  ADMIN = 'admin'
}

export enum InternshipTier {
  TOP = 'TOP_TIER', // Paid/High-Stakes
  MEDIUM = 'MEDIUM_TIER', // Fee/Mid-Range
  FOUNDATIONAL = 'FOUNDATIONAL' // Free
}

// Aligning with Mobile: Pending, Accepted, Rejected
export type ApplicationStatus = 'Pending' | 'Accepted' | 'Rejected';

export interface Application {
  internshipId: string;
  status: ApplicationStatus;
  appliedDate: string;
}

export interface Skill {
  name: string;
  isVerified: boolean;
  evidenceSource?: string; // e.g. Project ID or Assessment ID
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

// New separate top-level collection for Projects
export interface ProjectDoc extends Project {
  studentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  profileComplete: boolean;
  profileImage?: string;
  isOnline?: boolean;
  isPrivate?: boolean;
  isBanned?: boolean;
  isPermanentBanned?: boolean;
  reportCount?: number;
  uniqueReporterCount?: number;
  strikeCount?: number;
  warningCount?: number;
  isShadowBanned?: boolean;
  banReason?: string;
  defenseDeadline?: Timestamp | null;
  appealStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  appealText?: string;
  lastReportedAt?: Timestamp | null;

  // Student Specific
  university?: string;
  degree?: string;
  department?: string;
  phone?: string;
  resumeUrl?: string;
  summary?: string;
  includeImageOnCV?: boolean;
  skills: Skill[];
  projects: Project[]; // Optional embedded cache, but source of truth is projects collection
  savedJobs?: string[];
  applications: Application[]; // Optional embedded cache
  aiReadinessScore?: number;
  industryReadiness?: string;
  cvText?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  linkedInUrl?: string;
  updatedAt?: string;

  // Recruiter Specific
  company?: string;
  companyId?: string;
  position?: string;
}

export type StudentProfile = UserProfile;

export interface UserDoc extends UserProfile {}

export interface AuthSession {
  userId: string;
  email: string;
  role: UserRole;
  studentId: string | null;
}

export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  role?: string;
  title: string;
  tier: InternshipTier;
  location: string;
  stipend?: string;
  description: string;
  skills: string[]; // Mobile specifically expects an array of strings
  requirements: string[]; // Keeping requirements for legacy support/UI
  postedBy: string;
  status: 'Open' | 'Closed';
  applicationsCount: number;
  createdAt: string;
  updatedAt?: string;
}

export type Internship = Job;

export interface ApplicationDoc {
  id: string;
  studentId: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDoc {
  id: string;
  userId: string;
  recipientId?: string;
  title?: string;
  body?: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'UPDATE' | 'REPORT_WARNING' | 'ACCOUNT_BANNED' | 'BAN_WARNING' | 'REPORT_READY_FOR_REVIEW' | 'NEW_REPORT' | 'REPORT_RESOLVED' | 'AUTO_VIOLATION_WARNING' | 'NEW_VIOLATION' | 'PROFILE_INCOMPLETE' | 'APPEAL_SUBMITTED';
  status?: 'UNREAD' | 'READ';
  read?: boolean;
  showCause?: string;
  reportId?: string;
  defenseDeadline?: Timestamp | null;
  relatedReportId?: string;
  relatedUserId?: string;
  createdAt: Timestamp | string;
}

// Mobile Chat Schema uses 'chats' top level collection with a 'messages' subcollection
export interface ChatDoc {
  id: string;
  users: string[]; // Array of two UIDs
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
}

export interface MessageDoc {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  messageType?: 'text' | 'voice' | 'file' | 'location' | 'image' | 'interview';
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  location?: {
    lat: number;
    lng: number;
  };
  meetingLink?: string;
  scheduledAt?: string;
  duration?: number;
  applicationId?: string;
  isRead: boolean;
  timestamp: string;
}

export interface InterviewDoc {
  id: string;
  studentId: string;
  recruiterId: string;
  applicationId: string;
  scheduledAt: string;
  duration: number;
  meetingLink: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReportAiAnalysis {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  suggestedAction: 'WARN' | 'SHADOW_BAN' | 'PERMANENT_BAN' | 'DISMISS';
  confidence: number;
}

export type ReportStatus =
  | 'PENDING'
  | 'AWAITING_ADMIN'
  | 'DEFENSE_PENDING'
  | 'AUTO_BAN_SCHEDULED'
  | 'RESOLVED'
  | 'APPEALED'
  | string;

export interface ReportDoc {
  id: string;
  reporterId: string;
  reporterRole?: 'student' | 'recruiter';
  reportedId?: string;
  reportedUserId?: string;
  reportedRole?: 'student' | 'recruiter';
  targetCompanyId?: string;
  recruiterId?: string;
  jobId?: string;
  reason: string;
  description?: string;
  details?: string;
  evidenceUrl?: string;
  evidenceUrls?: string[];
  status?: ReportStatus;
  type?: string;
  timestamp: string;
  aiAnalysis?: ReportAiAnalysis;
  recruiterDefense?: string;
  defenseEvidenceUrl?: string;
  defenseEvidenceUrls?: string[];
  defenseDeadline?: Timestamp | null;
  strikeTriggered?: boolean;
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
  industryReadiness: string;
}

export interface CVLoophole {
  issue: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Improvement {
  fix: string;
  impact: string;
}

export interface MarketTrend {
  tech: string;
  demand: 'HOT' | 'GROWING' | 'STABLE';
  context: string;
}

export interface SkillRecommendation {
  skill: string;
  reason: string;
  estimatedTimeToLearn: string;
}

export interface ElitePathInsights {
  cvLoopholes: CVLoophole[];
  improvements: Improvement[];
  marketTrends: MarketTrend[];
  bestSkillsToLearnNext: SkillRecommendation[];
}

export type ViolationType =
  | 'FAKE_LISTING'
  | 'GHOSTING'
  | 'SPAM_REPORT'
  | 'PROFILE_INCOMPLETE'
  | string;

export interface ViolationDoc {
  id: string;
  userId: string;
  violationType: ViolationType;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  resolved?: boolean;
  resolvedAt?: string;
}
