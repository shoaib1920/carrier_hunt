import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc as firebaseDeleteDoc,
  doc,
  getDoc as firebaseGetDoc,
  getDocs as firebaseGetDocs,
  limit,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  serverTimestamp,
  setDoc,
  updateDoc as firebaseUpdateDoc,
  where,
  increment,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
  import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { analyzeReport } from '../../services/geminiService';
import { UserRole } from '../../types';
import type { ApplicationDoc, Job, NotificationDoc, UserProfile, ChatDoc, MessageDoc, ProjectDoc, ReportDoc, InterviewDoc, ViolationDoc } from '../../types';

const usersCollection = collection(db, 'users');
const jobsCollection = collection(db, 'jobs');
const applicationsCollection = collection(db, 'applications');
const notificationsCollection = collection(db, 'notifications');
const chatsCollection = collection(db, 'chats');
const projectsCollection = collection(db, 'projects');
const reportsCollection = collection(db, 'reports');
const interviewsCollection = collection(db, 'interviews');
export const violationsCollection = collection(db, 'violations');
export const auditLogCollection = collection(db, 'auditLog');

const storage = getStorage();

export async function uploadFileToStorage(path: string, file: File) {
  const storageReference = storageRef(storage, path);
  await uploadBytes(storageReference, file);
  const url = await getDownloadURL(storageReference);
  return url;
}

function parseDate(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value).getTime();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime();
  }
  return 0;
}

function toData<T>(snapshot: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snapshot.id, ...(snapshot.data() as T) };
}

export async function createDocument<T extends Record<string, unknown>>(collectionPath: string, payload: T) {
  const ref = doc(collection(db, collectionPath));
  await setDoc(ref, {
    ...payload,
    id: ref.id,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDocument(collectionPath: string, id: string, payload: Partial<Record<string, unknown>>) {
  const ref = doc(db, collectionPath, id);
  await firebaseUpdateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(collectionPath: string, id: string) {
  await firebaseDeleteDoc(doc(db, collectionPath, id));
}

export async function getDocument<T>(collectionPath: string, id: string) {
  const snapshot = await firebaseGetDoc(doc(db, collectionPath, id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as T) };
}

export async function getChatById(chatId: string) {
  const snapshot = await firebaseGetDoc(doc(db, 'chats', chatId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as any) } as ChatDoc;
}

export async function getCollectionDocuments<T>(collectionPath: string) {
  const snap = await firebaseGetDocs(collection(db, collectionPath));
  return snap.docs.map((docSnapshot) => toData<T>(docSnapshot));
}

export async function getAdminUsers() {
  const q = firestoreQuery(usersCollection, where('role', '==', 'admin'));
  const snap = await firebaseGetDocs(q);
  return snap.docs.map((docSnapshot) => toData<UserProfile>(docSnapshot));
}

export function listenJobs(onUpdate: (jobs: Job[]) => void) {
  const q = firestoreQuery(jobsCollection, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<Job>(docSnapshot))));
}

export function listenUsers(onUpdate: (users: UserProfile[]) => void) {
  const q = firestoreQuery(usersCollection, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<UserProfile>(docSnapshot))));
}

export function listenUserProfile(uid: string, onUpdate: (profile: UserProfile | null) => void) {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) return onUpdate(null);
    onUpdate({ ...(snapshot.data() as Omit<UserProfile, 'uid'>), uid: snapshot.id });
  });
}

export function listenApplicationsForStudent(studentId: string, onUpdate: (applications: ApplicationDoc[]) => void) {
  const q = firestoreQuery(applicationsCollection, where('studentId', '==', studentId));
  return onSnapshot(q, (snapshot) => {
    const apps = snapshot.docs
      .map((docSnapshot) => toData<ApplicationDoc>(docSnapshot))
      .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
    onUpdate(apps);
  });
}

export function listenApplicationsForRecruiter(recruiterId: string, onUpdate: (applications: ApplicationDoc[]) => void): () => void;
export function listenApplicationsForRecruiter(recruiterJobIds: string[], onUpdate: (applications: ApplicationDoc[]) => void): () => void;
export function listenApplicationsForRecruiter(
  recruiterInput: string | string[],
  onUpdate: (applications: ApplicationDoc[]) => void
): () => void {
  if (typeof recruiterInput === 'string') {
    let unsubscribeApplications: () => void = () => undefined;

    const jobsQuery = firestoreQuery(jobsCollection, where('postedBy', '==', recruiterInput));
    const jobsUnsubscribe = onSnapshot(jobsQuery, (jobsSnapshot) => {
      const jobIds = jobsSnapshot.docs.map((jobDoc) => jobDoc.id);
      unsubscribeApplications();

      if (!jobIds.length) {
        onUpdate([]);
        unsubscribeApplications = () => undefined;
        return;
      }

      if (jobIds.length <= 10) {
        const appsQuery = firestoreQuery(applicationsCollection, where('jobId', 'in', jobIds));
        unsubscribeApplications = onSnapshot(appsQuery, (appsSnapshot) => {
          const apps = appsSnapshot.docs
            .map((docSnapshot) => toData<ApplicationDoc>(docSnapshot))
            .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
          onUpdate(apps);
        });
      } else {
        const appsQuery = firestoreQuery(applicationsCollection);
        unsubscribeApplications = onSnapshot(appsQuery, (appsSnapshot) => {
          const allApplications = appsSnapshot.docs
            .map((docSnapshot) => toData<ApplicationDoc>(docSnapshot))
            .filter((application) => jobIds.includes(application.jobId))
            .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
          onUpdate(allApplications);
        });
      }
    });

    return () => {
      unsubscribeApplications();
      jobsUnsubscribe();
    };
  }

  const recruiterJobIds = recruiterInput.slice(0, 30);
  if (!recruiterJobIds.length) {
    onUpdate([]);
    return () => undefined;
  }

  const q = firestoreQuery(applicationsCollection, where('jobId', 'in', recruiterJobIds));
  return onSnapshot(q, (snapshot) => {
    const apps = snapshot.docs.map((docSnapshot) => toData<ApplicationDoc>(docSnapshot));
    onUpdate(apps);
  });
}

export async function getApplicationForStudentAndRecruiter(studentId: string, recruiterId: string) {
  const q = firestoreQuery(applicationsCollection, where('studentId', '==', studentId));
  const snap = await firebaseGetDocs(q);
  const applications = snap.docs.map((docSnapshot) => toData<ApplicationDoc>(docSnapshot));

  for (const application of applications) {
    const jobSnap = await firebaseGetDoc(doc(db, 'jobs', application.jobId));
    if (jobSnap.exists()) {
      const job = jobSnap.data() as Job;
      if (job.postedBy === recruiterId) {
        return application;
      }
    }
  }

  return null;
}

export function listenNotificationsForUser(userId: string, onUpdate: (notifications: NotificationDoc[]) => void) {
  const q = firestoreQuery(notificationsCollection, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<NotificationDoc>(docSnapshot))));
}

export function listenUnreadNotificationsForUser(userId: string, onUpdate: (count: number) => void) {
  const q = firestoreQuery(notificationsCollection, where('userId', '==', userId), where('read', '==', false));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.size));
}

export async function markAllNotificationsRead(userId: string) {
  const q = firestoreQuery(notificationsCollection, where('userId', '==', userId), where('read', '==', false));
  const snapshot = await firebaseGetDocs(q);
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnapshot) => {
    batch.update(docSnapshot.ref, {
      read: true,
      status: 'READ',
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export function listenUserChats(userId: string, onUpdate: (chats: ChatDoc[]) => void) {
  const q = firestoreQuery(chatsCollection, where('participants', 'array-contains', userId), orderBy('lastMessageTime', 'desc'));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<ChatDoc>(docSnapshot))));
}

export function listenMessagesForChat(chatId: string, onUpdate: (messages: MessageDoc[]) => void) {
  const messagesSubCollection = collection(db, 'chats', chatId, 'messages');
  const q = firestoreQuery(messagesSubCollection, orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<MessageDoc>(docSnapshot))));
}

export async function sendMessage(chatId: string, message: Omit<MessageDoc, 'id' | 'timestamp'>) {
  const messagesSubCollection = collection(db, 'chats', chatId, 'messages');
  const messageRef = doc(messagesSubCollection);
  const payload = {
    ...message,
    id: messageRef.id,
    timestamp: serverTimestamp(),
  };
  await setDoc(messageRef, payload);

  const previewText = message.messageType === 'text'
    ? 'Encrypted message'
    : message.text || (message.messageType === 'file' ? `Sent ${message.fileName}` : 'Sent a message');

  // Update chat's last message preview
  await firebaseUpdateDoc(doc(db, 'chats', chatId), {
    lastMessage: previewText,
    lastMessageTime: serverTimestamp()
  });
}

export async function createJob(job: Omit<Job, 'id' | 'createdAt'>) {
  const ref = doc(jobsCollection);
  const payload = {
    ...job,
    id: ref.id,
    title: job.title || job.role || 'Untitled Role',
    role: job.role || job.title,
    status: job.status || 'Open',
    applicationsCount: job.applicationsCount || 0,
    skills: job.skills || [],
    createdAt: serverTimestamp(),
  } as Omit<Job, 'id' | 'createdAt'> & { id: string; createdAt: unknown };

  try {
    await setDoc(ref, payload);
    
    // Check for violations (fake listings, etc.)
    const { checkForViolations } = await import('./violationDetector');
    await checkForViolations({
      type: 'JOB_POSTED',
      userId: job.postedBy,
      userRole: 'recruiter',
      metadata: { jobData: { ...job, id: ref.id } },
    });
    
    return ref.id;
  } catch (error) {
    console.error('Failed to create job', {
      error,
      payload,
      collection: 'jobs',
      userId: job.postedBy,
    });
    throw error;
  }
}

export async function updateJob(jobId: string, updates: Partial<Job>) {
  await firebaseUpdateDoc(doc(db, 'jobs', jobId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteJob(jobId: string) {
  await firebaseDeleteDoc(doc(db, 'jobs', jobId));
}

export async function applyToJob(studentId: string, jobId: string) {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await firebaseGetDoc(jobRef);
  const recruiterId = jobSnap.exists() ? (jobSnap.data() as Job).postedBy : '';
  const timestamp = new Date().toISOString();
  const payload = {
    studentId,
    jobId,
    recruiterId,
    status: 'Pending',
    appliedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as const;

  const ref = await addDoc(applicationsCollection, payload);

  // Increment application count safely using get/update (ideally use increment from firestore, but this works for now)
  if (jobSnap.exists()) {
    const currentCount = jobSnap.data().applicationsCount || 0;
    await firebaseUpdateDoc(jobRef, { applicationsCount: currentCount + 1 });
  }

  return ref.id;
}

export async function updateApplicationStatus(applicationId: string, status: string) {
  const appRef = doc(db, 'applications', applicationId);
  const appSnap = await firebaseGetDoc(appRef);
  if (!appSnap.exists()) throw new Error('Application not found');

  const application = appSnap.data() as ApplicationDoc;
  if (application.status === status) return;

  await firebaseUpdateDoc(appRef, {
    status,
    updatedAt: serverTimestamp(),
  });

  if (application.studentId) {
    const jobSnap = await firebaseGetDoc(doc(db, 'jobs', application.jobId));
    const job = jobSnap.exists() ? (jobSnap.data() as Job) : null;
    const jobLabel = job?.title || job?.role || 'your application';

    await createNotification({
      userId: application.studentId,
      recipientId: application.studentId,
      type: 'UPDATE',
      message: `Your application for ${jobLabel} is now ${status}.`,
      status: 'UNREAD',
    });
  }
}

export async function saveJobForStudent(studentId: string, jobId: string) {
  const userRef = doc(db, 'users', studentId);
  const snapshot = await firebaseGetDoc(userRef);
  if (!snapshot.exists()) throw new Error('Student profile not found');
  const current = snapshot.data() as Partial<UserProfile>;
  const savedJobs = Array.isArray(current.savedJobs) ? current.savedJobs : [];
  const nextSaved = savedJobs.includes(jobId) ? savedJobs.filter((id) => id !== jobId) : [...savedJobs, jobId];
  await firebaseUpdateDoc(userRef, { savedJobs: nextSaved, updatedAt: serverTimestamp() });
  return nextSaved;
}

export async function createInterview(interview: Omit<InterviewDoc, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = doc(interviewsCollection);
  const payload = {
    ...interview,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return ref.id;
}

export function getNotificationTitle(type: NotificationDoc['type']) {
  const titles: Record<NotificationDoc['type'], string> = {
    REPORT_WARNING: "You've Been Reported",
    BAN_WARNING: '⚠️ Ban Warning — Action Required',
    ACCOUNT_BANNED: 'Account Banned',
    NEW_REPORT: 'New Report Filed',
    REPORT_READY_FOR_REVIEW: 'Report Ready for Admin Review',
    REPORT_RESOLVED: 'Report Resolved',
    INFO: 'Update',
    SUCCESS: 'Success',
    ERROR: 'Error',
    UPDATE: 'Update',
    AUTO_VIOLATION_WARNING: '⚠️ Auto Violation Warning',
    NEW_VIOLATION: 'New Policy Violation',
    PROFILE_INCOMPLETE: 'Profile Incomplete',
    APPEAL_SUBMITTED: 'Appeal Submitted',
  };
  return titles[type] || 'Notification';
}

export async function sendNotification(notification: Omit<NotificationDoc, 'id' | 'createdAt'>) {
  const ref = doc(notificationsCollection);
  const type = notification.type;
  const title = notification.title || getNotificationTitle(type as NotificationDoc['type']);
  const payload = {
    ...notification,
    id: ref.id,
    title,
    recipientId: notification.recipientId || notification.userId,
    status: notification.status || 'UNREAD',
    read: notification.read ?? false,
    createdAt: serverTimestamp(),
  } as Omit<NotificationDoc, 'id' | 'createdAt'> & { id: string; createdAt: unknown };
  await setDoc(ref, payload);
  return ref.id;
}

export async function createNotification(notification: Omit<NotificationDoc, 'id' | 'createdAt'>) {
  return sendNotification(notification);
}

export function listenAllApplications(onUpdate: (applications: ApplicationDoc[]) => void) {
  const q = firestoreQuery(applicationsCollection, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<ApplicationDoc>(docSnapshot))));
}

export async function removeUser(uid: string) {
  await firebaseDeleteDoc(doc(db, 'users', uid));
}

// Reports Collection
export async function createReport(report: Omit<ReportDoc, 'id' | 'timestamp'>) {
  const ref = doc(reportsCollection);
  await setDoc(ref, {
    ...report,
    id: ref.id,
    timestamp: serverTimestamp()
  });

  try {
    const aiAnalysis = await analyzeReport({
      reason: report.reason,
      description: (report as any).description || report.details,
      details: report.details,
    });
    await updateDocument('reports', ref.id, { aiAnalysis });

    const recruiterId = report.recruiterId || report.reportedId || '';
    if (recruiterId) {
      await createNotification({
        userId: recruiterId,
        recipientId: recruiterId,
        type: 'REPORT_WARNING',
        message: 'You have been reported. You are required to provide your defense.',
        showCause: aiAnalysis.summary,
        reportId: ref.id,
        status: 'UNREAD',
      });
    }

    const adminQuery = firestoreQuery(usersCollection, where('role', '==', 'admin'));
    const adminSnap = await firebaseGetDocs(adminQuery);
    await Promise.all(adminSnap.docs.map(async (adminDoc) => {
      await createNotification({
        userId: adminDoc.id,
        recipientId: adminDoc.id,
        type: 'NEW_REPORT',
        message: 'A new fraud report has been submitted',
        reportId: ref.id,
        status: 'UNREAD',
      });
    }));

    // Check for spam reporting
    const { checkSpamReporting } = await import('./violationDetector');
    await checkSpamReporting(report.reporterId);
  } catch (error) {
    console.error('Failed to update report with AI analysis or send notification:', error);
  }

  return ref.id;
}

export function listenReports(onUpdate: (reports: ReportDoc[]) => void) {
  const q = firestoreQuery(reportsCollection, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<ReportDoc>(docSnapshot))));
}

export function listenAuditLog(onUpdate: (logs: any[]) => void) {
  const q = firestoreQuery(auditLogCollection, orderBy('timestamp', 'desc'), limit(200));
  return onSnapshot(q, (snapshot) => onUpdate(snapshot.docs.map((docSnapshot) => toData<any>(docSnapshot))));
}

// Admin actions for warnings and bans
export async function adminIssueWarning(recruiterId: string, actorId: string) {
  const userRef = doc(db, 'users', recruiterId);
  const snap = await firebaseGetDoc(userRef);
  if (!snap.exists()) throw new Error('Recruiter not found');

  const targetData = snap.data() as Partial<UserProfile>;
  if ((targetData.role as any) === UserRole.ADMIN || (targetData.role as any) === 'admin') {
    throw new Error('Cannot perform this action on an admin account');
  }

  // Update warning count atomically
  await firebaseUpdateDoc(userRef, { warningCount: increment(1), updatedAt: serverTimestamp() });

  // Re-fetch the document to get the authoritative new count
  const updatedSnap = await firebaseGetDoc(userRef);
  if (!updatedSnap.exists()) throw new Error('Recruiter not found after update');
  const updatedData = updatedSnap.data() as Partial<UserProfile>;
  const newCount = typeof updatedData.warningCount === 'number' ? updatedData.warningCount : 0;

  // Check reports collection for unique reporterIds against this recruiter
  const q = firestoreQuery(reportsCollection, where('recruiterId', '==', recruiterId));
  const snapReports = await firebaseGetDocs(q);
  const uniqueReporters = new Set<string>();
  snapReports.docs.forEach((r) => {
    const data = r.data() as ReportDoc;
    if (data.reporterId) uniqueReporters.add(data.reporterId);
  });

  // If 5 or more unique reporters exist, shadow ban the recruiter
  if (uniqueReporters.size >= 5) {
    await firebaseUpdateDoc(userRef, { isShadowBanned: true, shadowBannedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  await createDocument('auditLog', {
    adminId: actorId,
    action: 'warning_issued',
    targetUserId: recruiterId,
    timestamp: serverTimestamp(),
  } as any);

  return { warningCount: newCount, uniqueReporterCount: uniqueReporters.size };
}

export async function adminShadowBan(recruiterId: string, actorId: string) {
  const userRef = doc(db, 'users', recruiterId);
  const snap = await firebaseGetDoc(userRef);
  if (!snap.exists()) throw new Error('Recruiter not found');

  const targetData = snap.data() as Partial<UserProfile>;
  if ((targetData.role as any) === UserRole.ADMIN || (targetData.role as any) === 'admin') {
    throw new Error('Cannot perform this action on an admin account');
  }

  await firebaseUpdateDoc(userRef, { isShadowBanned: true, shadowBannedAt: serverTimestamp(), updatedAt: serverTimestamp() });

  await createDocument('auditLog', {
    adminId: actorId,
    action: 'shadow_banned',
    targetUserId: recruiterId,
    timestamp: serverTimestamp(),
  } as any);

  return { isShadowBanned: true };
}

export async function adminPermanentBan(recruiterId: string, actorId: string) {
  const userRef = doc(db, 'users', recruiterId);
  const snap = await firebaseGetDoc(userRef);
  if (!snap.exists()) throw new Error('Recruiter not found');

  const targetData = snap.data() as Partial<UserProfile>;
  if ((targetData.role as any) === UserRole.ADMIN || (targetData.role as any) === 'admin') {
    throw new Error('Cannot perform this action on an admin account');
  }

  await firebaseUpdateDoc(userRef, { isPermanentBanned: true, pendingBanEmail: true, bannedAt: serverTimestamp(), updatedAt: serverTimestamp() });

  await createDocument('auditLog', {
    adminId: actorId,
    action: 'permanent_banned',
    targetUserId: recruiterId,
    timestamp: serverTimestamp(),
  } as any);

  return { isPermanentBanned: true };
}

export async function adminRestoreRecruiter(recruiterId: string, actorId: string) {
  const userRef = doc(db, 'users', recruiterId);
  const snap = await firebaseGetDoc(userRef);
  if (!snap.exists()) throw new Error('Recruiter not found');

  const targetData = snap.data() as Partial<UserProfile>;
  if ((targetData.role as any) === UserRole.ADMIN || (targetData.role as any) === 'admin') {
    throw new Error('Cannot perform this action on an admin account');
  }

  await firebaseUpdateDoc(userRef, {
    isShadowBanned: false,
    isPermanentBanned: false,
    pendingBanEmail: false,
    updatedAt: serverTimestamp(),
    restoredAt: serverTimestamp(),
  });

  await createDocument('auditLog', {
    adminId: actorId,
    action: 'restored',
    targetUserId: recruiterId,
    timestamp: serverTimestamp(),
  } as any);

  return { restored: true };
}

// Projects Collection
export async function createProject(project: Omit<ProjectDoc, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = doc(projectsCollection);
  await setDoc(ref, {
    ...project,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

// Get or Create Chat between two users
export async function getOrCreateChat(user1: string, user2: string) {
  const q = firestoreQuery(chatsCollection, where('participants', 'array-contains', user1));
  const snap = await firebaseGetDocs(q);
  const existing = snap.docs.find(docSnapshot => {
    const data = docSnapshot.data() as ChatDoc;
    return data.participants.includes(user2);
  });

  if (existing) {
    return existing.id;
  }

  const ref = doc(chatsCollection);
  const newChat = {
    id: ref.id,
    participants: [user1, user2],
    users: [user1, user2],
    lastMessage: '',
    lastMessageTime: serverTimestamp()
  };
  await setDoc(ref, newChat);
  return ref.id;
}

// Withdraw an application
export async function withdrawApplication(applicationId: string) {
  await firebaseDeleteDoc(doc(db, 'applications', applicationId));
}

// Reports - Defense and Appeal
export async function submitDefense(reportId: string, defenseText: string, defenseEvidenceUrls: string[]) {
  await updateDocument('reports', reportId, {
    recruiterDefense: defenseText,
    defenseEvidenceUrls,
    status: 'AWAITING_ADMIN',
  });
}

export async function submitAppeal(userId: string, appealText: string, evidenceUrls: string[]) {
  await updateDocument('users', userId, {
    appealStatus: 'pending',
    appealText,
    appealEvidenceUrls: evidenceUrls,
  });

  // Notify all admins
  const adminQuery = firestoreQuery(usersCollection, where('role', '==', 'admin'));
  const adminSnap = await firebaseGetDocs(adminQuery);
  await Promise.all(adminSnap.docs.map(async (adminDoc) => {
    await createNotification({
      userId: adminDoc.id,
      recipientId: adminDoc.id,
      type: 'NEW_REPORT',
      message: 'A user has submitted an appeal',
      status: 'UNREAD',
    });
  }));
}

export function listenReportsAgainstMe(userId: string, onUpdate: (reports: ReportDoc[]) => void) {
  const q = firestoreQuery(reportsCollection, where('reportedUserId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((docSnapshot) => toData<ReportDoc>(docSnapshot));
    reports.sort((a, b) => parseDate(b.timestamp) - parseDate(a.timestamp));
    onUpdate(reports);
  });
}

export function listenReportsFiledByMe(userId: string, onUpdate: (reports: ReportDoc[]) => void) {
  const q = firestoreQuery(reportsCollection, where('reporterId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((docSnapshot) => toData<ReportDoc>(docSnapshot));
    reports.sort((a, b) => parseDate(b.timestamp) - parseDate(a.timestamp));
    onUpdate(reports);
  });
}
