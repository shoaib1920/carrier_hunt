import {
  collection,
  query as firestoreQuery,
  where,
  orderBy,
  getDocs as firebaseGetDocs,
  setDoc,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { predictFakeJob } from './fakeJobDetectorService';
import { GoogleGenAI, Type } from '@google/genai';
import type { ViolationDoc, UserProfile, ApplicationDoc, ReportDoc } from '../../types';
import { createNotification } from './firestoreService';
import { apiFetch } from '../../services/api';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const violationsCollection = collection(db, 'violations');

function getClientApiKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || '';
}

const ai = new GoogleGenAI({ apiKey: getClientApiKey() });

// Types
export interface ViolationEvent {
  type: 'JOB_POSTED' | 'APPLICATION_GHOSTED' | 'CHAT_PII_DETECTED' | 'REPORT_SPAM_SUSPECTED' | 'PROFILE_UNVERIFIED';
  userId: string;
  userRole: 'student' | 'recruiter';
  metadata: Record<string, any>;
}

// Main router function
export async function checkForViolations(event: ViolationEvent): Promise<void> {
  try {
    switch (event.type) {
      case 'JOB_POSTED':
        await checkFakeListing(event.userId, event.metadata.jobData);
        break;
      case 'APPLICATION_GHOSTED':
        await checkGhosting(event.metadata.applicationId, event.metadata.recruiterId, event.metadata.studentId);
        break;
      case 'REPORT_SPAM_SUSPECTED':
        await checkSpamReporting(event.userId);
        break;
      case 'PROFILE_UNVERIFIED':
        await checkUnverifiedProfile(event.userId, event.userRole, event.metadata.createdAt);
        break;
      default:
        console.warn(`Unknown violation event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error checking for violations:', error);
  }
}

/**
 * Helper function to flag a job listing as suspicious, reject/close it, log the violation, and send warnings.
 */
async function flagSuspiciousListing(
  userId: string,
  jobData: any,
  confidence: number,
  source: string,
  reason: string
): Promise<void> {
  console.log(`Delegating fake listing enforcement for job ${jobData.id} to backend server...`);
  try {
    const res = await apiFetch<{ success?: boolean; localFallback?: boolean }>('/api/violations/report-fake-job', {
      method: 'POST',
      body: JSON.stringify({
        jobData,
        confidence,
        source,
        reason,
      }),
    });
    console.log(`Successfully completed backend enforcement for suspicious listing: ${jobData.id}`);

    // If backend reports it was using local fallback (no Firebase admin credentials),
    // update the job status client-side since the backend couldn't write to Firestore.
    if (res && res.localFallback) {
      console.log('Backend is in json-fallback mode. Updating job status and creating notification from client...');
      const jobRef = doc(db, 'jobs', jobData.id);
      await updateDoc(jobRef, {
        status: 'Closed',
        isSuspicious: true,
        verificationStatus: 'REJECTED',
      });
      try {
        await createNotification({
          userId: userId,
          recipientId: userId,
          type: 'AUTO_VIOLATION_WARNING',
          title: '⚠️ Auto Violation Warning',
          message: `Your job posting '${jobData.title || 'Untitled Job'}' has been flagged for potential policy violations: ${reason}. Please review our posting guidelines.`,
          status: 'UNREAD',
          read: false,
        });
      } catch (notifErr) {
        console.error('Failed to create warning notification locally:', notifErr);
      }
    }
  } catch (error) {
    console.error('Failed to report suspicious listing to backend server:', error);
    // If backend fails, we still try to at least update the job status client-side so it is hidden, 
    // even if violation log/notifications fail (graceful degradation)
    try {
      const jobRef = doc(db, 'jobs', jobData.id);
      await updateDoc(jobRef, {
        status: 'Closed',
        isSuspicious: true,
        verificationStatus: 'REJECTED',
      });
      try {
        await createNotification({
          userId: userId,
          recipientId: userId,
          type: 'AUTO_VIOLATION_WARNING',
          title: '⚠️ Auto Violation Warning',
          message: `Your job posting '${jobData.title || 'Untitled Job'}' has been flagged for potential policy violations: ${reason}. Please review our posting guidelines.`,
          status: 'UNREAD',
          read: false,
        });
      } catch (notifErr) {
        console.error('Failed to create warning notification locally in catch block:', notifErr);
      }
    } catch (dbErr) {
      console.error('Failed to close job locally after backend error:', dbErr);
    }
  }
}

/**
 * Check if a job posting appears fraudulent or misleading
 */
export async function checkFakeListing(userId: string, jobData: any): Promise<void> {
  try {
    // 1. Call the Hugging Face prediction service (Gatekeeper)
    const prediction = await predictFakeJob(
      jobData.title || '',
      jobData.description || '',
      jobData.stipend || ''
    );

    const isSuspicious = prediction.isSuspicious;
    const confidence = prediction.confidence;
    const reason = 'Hugging Face sequence classifier flagged this listing.';

    // 2. Hybrid evaluation logic
    if (!isSuspicious) {
      // Clean posting: tag metadata as verified
      const jobRef = doc(db, 'jobs', jobData.id);
      await updateDoc(jobRef, {
        isVerified: true,
        aiVerified: true,
        verificationStatus: 'VERIFIED',
      });
      console.log(`Job listing ${jobData.id} verified as clean by Hugging Face detector.`);
      return;
    }

    // Highly suspicious posting (confidence > 70%)
    if (isSuspicious && confidence > 70) {
      await flagSuspiciousListing(
        userId,
        jobData,
        confidence,
        'Hugging Face Space Sequence Classifier',
        reason
      );
      return;
    }

    // Ambiguous posting (isSuspicious === true but confidence <= 70, or score is low/API failure)
    // Route to advanced semantic layer (Gemini Service) for secondary deep-reasoning verification audit
    const apiKey = getClientApiKey();
    if (!apiKey || apiKey === 'your_key_here' || !apiKey.startsWith('AIzaSy')) {
      console.warn('Ambiguous decision, but no valid Gemini API key configured for fallback. Relying on Hugging Face prediction.');
      await flagSuspiciousListing(
        userId,
        jobData,
        confidence,
        'Hugging Face Space (Gemini Fallback Unconfigured)',
        reason
      );
      return;
    }

    const prompt = `Analyze this job posting for signs of fraud or misleading content. 
Job title: ${jobData.title || 'N/A'}
Description: ${jobData.description || 'N/A'}
Salary/Stipend: ${jobData.stipend || 'Not specified'}

Reply with JSON only: { isSuspicious: boolean, reason: string, confidence: number }
Where confidence is 0-100.`;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isSuspicious: { type: Type.BOOLEAN },
              reason: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ['isSuspicious', 'reason', 'confidence'],
          },
        },
      });

      const analysis = JSON.parse(response.text || '{}');

      if (analysis.isSuspicious && analysis.confidence > 70) {
        await flagSuspiciousListing(
          userId,
          jobData,
          analysis.confidence,
          'Gemini Deep-Reasoning Fallback Audit',
          analysis.reason
        );
      } else {
        // Gemini cleared the job posting
        const jobRef = doc(db, 'jobs', jobData.id);
        await updateDoc(jobRef, {
          isVerified: true,
          aiVerified: true,
          verificationStatus: 'VERIFIED',
        });
        console.log(`Job listing ${jobData.id} verified as clean by Gemini deep audit.`);
      }
    } catch (geminiError) {
      console.error('Gemini fallback audit failed, relying on Hugging Face prediction:', geminiError);
      await flagSuspiciousListing(
        userId,
        jobData,
        confidence,
        'Hugging Face Space (Gemini Fallback Failed)',
        reason
      );
    }
  } catch (error) {
    console.error('Error checking for fake listing:', error);
  }
}

// Helper function to send notifications
async function sendSuspiciousNotifications(userId: string, jobData: any, reason: string) {
  // Send notification to recruiter
  await createNotification({
    userId,
    recipientId: userId,
    type: 'AUTO_VIOLATION_WARNING',
    message: `Your job posting '${jobData.title}' has been flagged for potential policy violations: ${reason}. Please review our posting guidelines.`,
    status: 'UNREAD',
  });

  // Send notification to all admins
  const usersCollection = collection(db, 'users');
  const adminQuery = firestoreQuery(usersCollection, where('role', '==', 'admin'));
  const adminSnap = await firebaseGetDocs(adminQuery);
  await Promise.all(
    adminSnap.docs.map((adminDoc) =>
      createNotification({
        userId: adminDoc.id,
        recipientId: adminDoc.id,
        type: 'NEW_VIOLATION',
        message: `New violation detected: Fake listing from recruiter ${userId}`,
        status: 'UNREAD',
      })
    )
  );
}

/**
 * Check if a recruiter is ghosting an applicant (accepted 7+ days with no follow-up)
 */
export async function checkGhosting(applicationId: string, recruiterId: string, studentId: string): Promise<void> {
  try {
    // Get application doc
    const applicationsCollection = collection(db, 'applications');
    const applicationQuery = firestoreQuery(
      applicationsCollection,
      where('__name__', '==', applicationId)
    );
    const applicationSnap = await firebaseGetDocs(applicationQuery);
    
    if (applicationSnap.empty) {
      // Fallback: try direct doc fetch
      const appRef = doc(db, 'applications', applicationId);
      const appSnap = await firebaseGetDocs(firestoreQuery(applicationsCollection));
      
      const application = appSnap.docs.find(d => d.id === applicationId)?.data() as ApplicationDoc | undefined;
      if (!application) return;
      
      // Check if status is 'Accepted' (or similar)
      if (application.status !== 'Accepted') return;

      // Check how long it's been accepted
      const appliedAtMs = new Date(application.updatedAt || application.createdAt).getTime();
      const nowMs = Date.now();
      const daysSinceAccepted = (nowMs - appliedAtMs) / (1000 * 60 * 60 * 24);

      if (daysSinceAccepted < 7) return;

      // Check if there's been recent chat communication
      try {
        // Try to find chat between recruiter and student
        const chatsCollection = collection(db, 'chats');
        const chatQuery = firestoreQuery(
          chatsCollection,
          where('participants', 'array-contains', recruiterId)
        );
        const chatSnap = await firebaseGetDocs(chatQuery);

        let hasRecentMessage = false;
        for (const chatDoc of chatSnap.docs) {
          const chatData = chatDoc.data();
          const chatMembers = chatData.participants || chatData.users || [];
          if (Array.isArray(chatMembers) && chatMembers.includes(studentId)) {
            // Check messages in this chat
            const messagesCollection = collection(db, 'chats', chatDoc.id, 'messages');
            const messageQuery = firestoreQuery(messagesCollection, orderBy('timestamp', 'desc'));
            const messageSnap = await firebaseGetDocs(messageQuery);

            if (!messageSnap.empty) {
              const lastMessage = messageSnap.docs[0].data();
              const lastMessageTime = new Date(lastMessage.timestamp).getTime();
              const hoursSinceLastMessage = (nowMs - lastMessageTime) / (1000 * 60 * 60);

              if (hoursSinceLastMessage < 24) {
                hasRecentMessage = true;
                break;
              }
            }
          }
        }

        // If no recent communication, flag as ghosting
        if (!hasRecentMessage) {
          const violationRef = doc(violationsCollection);
          await setDoc(violationRef, {
            id: violationRef.id,
            userId: recruiterId,
            violationType: 'GHOSTING',
            severity: 'MEDIUM',
            description: `Accepted application for ${daysSinceAccepted.toFixed(0)} days without follow-up communication`,
            metadata: {
              applicationId,
              studentId,
              daysSinceAccepted: daysSinceAccepted.toFixed(1),
            },
            createdAt: serverTimestamp(),
            resolved: false,
          });

          // Send notification to recruiter
          await createNotification({
            userId: recruiterId,
            recipientId: recruiterId,
            type: 'AUTO_VIOLATION_WARNING',
            message: `You have accepted an application but not followed up in ${daysSinceAccepted.toFixed(0)} days. Please communicate with the candidate or update their status.`,
            status: 'UNREAD',
          });
        }
      } catch (chatError) {
        console.error('Error checking chat history for ghosting:', chatError);
      }
      return;
    }

    const application = applicationSnap.docs[0].data() as ApplicationDoc;

    // Check if status is 'Accepted' (or similar)
    if (application.status !== 'Accepted') return;

    // Check how long it's been accepted
    const appliedAtMs = new Date(application.updatedAt || application.createdAt).getTime();
    const nowMs = Date.now();
    const daysSinceAccepted = (nowMs - appliedAtMs) / (1000 * 60 * 60 * 24);

    if (daysSinceAccepted < 7) return;

    // Check if there's been recent chat communication
    try {
      // Try to find chat between recruiter and student
      const chatsCollection = collection(db, 'chats');
      const chatQuery = firestoreQuery(
        chatsCollection,
        where('participants', 'array-contains', recruiterId)
      );
      const chatSnap = await firebaseGetDocs(chatQuery);

      let hasRecentMessage = false;
      for (const chatDoc of chatSnap.docs) {
        const chatData = chatDoc.data();
        const chatMembers = chatData.participants || chatData.users || [];
        if (Array.isArray(chatMembers) && chatMembers.includes(studentId)) {
          // Check messages in this chat
          const messagesCollection = collection(db, 'chats', chatDoc.id, 'messages');
          const messageQuery = firestoreQuery(messagesCollection, orderBy('timestamp', 'desc'));
          const messageSnap = await firebaseGetDocs(messageQuery);

          if (!messageSnap.empty) {
            const lastMessage = messageSnap.docs[0].data();
            const lastMessageTime = new Date(lastMessage.timestamp).getTime();
            const hoursSinceLastMessage = (nowMs - lastMessageTime) / (1000 * 60 * 60);

            if (hoursSinceLastMessage < 24) {
              hasRecentMessage = true;
              break;
            }
          }
        }
      }

      // If no recent communication, flag as ghosting
      if (!hasRecentMessage) {
        const violationRef = doc(violationsCollection);
        await setDoc(violationRef, {
          id: violationRef.id,
          userId: recruiterId,
          violationType: 'GHOSTING',
          severity: 'MEDIUM',
          description: `Accepted application for ${daysSinceAccepted.toFixed(0)} days without follow-up communication`,
          metadata: {
            applicationId,
            studentId,
            daysSinceAccepted: daysSinceAccepted.toFixed(1),
          },
          createdAt: serverTimestamp(),
          resolved: false,
        });

        // Send notification to recruiter
        await createNotification({
          userId: recruiterId,
          recipientId: recruiterId,
          type: 'AUTO_VIOLATION_WARNING',
          message: `You have accepted an application but not followed up in ${daysSinceAccepted.toFixed(0)} days. Please communicate with the candidate or update their status.`,
          status: 'UNREAD',
        });
      }
    } catch (chatError) {
      console.error('Error checking chat history for ghosting:', chatError);
    }
  } catch (error) {
    console.error('Error checking for ghosting:', error);
  }
}

/**
 * Check if a user is filing reports too frequently (spam)
 */
export async function checkSpamReporting(reporterId: string): Promise<void> {
  try {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const reportsCollection = collection(db, 'reports');
    const recentReportsQuery = firestoreQuery(
      reportsCollection,
      where('reporterId', '==', reporterId)
    );
    const recentReportsSnap = await firebaseGetDocs(recentReportsQuery);

    // Count reports from the last 24 hours
    let countIn24h = 0;
    recentReportsSnap.docs.forEach((doc) => {
      const data = doc.data() as ReportDoc;
      const timestampVal = data.timestamp as any;
      const reportTime = typeof timestampVal === 'string' 
        ? new Date(timestampVal).getTime()
        : (timestampVal && typeof timestampVal === 'object' && 'toDate' in timestampVal)
        ? timestampVal.toDate().getTime()
        : (timestampVal && typeof timestampVal === 'object' && 'toMillis' in timestampVal)
        ? timestampVal.toMillis()
        : 0;
      
      if (reportTime > oneDayAgo) {
        countIn24h++;
      }
    });

    // If more than 3 reports in 24 hours, flag as spam
    if (countIn24h > 3) {
      // Check if we already have a violation for this user in the last 24 hours
      const violationsCollection = collection(db, 'violations');
      const existingQuery = firestoreQuery(
        violationsCollection,
        where('userId', '==', reporterId),
        where('violationType', '==', 'SPAM_REPORT')
      );
      const existingSnap = await firebaseGetDocs(existingQuery);

      let shouldCreateViolation = true;
      existingSnap.docs.forEach((doc) => {
        const data = doc.data() as ViolationDoc;
        const createdTime = typeof data.createdAt === 'string'
          ? new Date(data.createdAt).getTime()
          : 0;
        if (now - createdTime < 24 * 60 * 60 * 1000) {
          shouldCreateViolation = false;
        }
      });

      if (shouldCreateViolation) {
        const violationRef = doc(violationsCollection);
        await setDoc(violationRef, {
          id: violationRef.id,
          userId: reporterId,
          violationType: 'SPAM_REPORT',
          severity: 'MEDIUM',
          description: `User filed ${countIn24h} reports in 24 hours`,
          metadata: {
            reportsCount: countIn24h,
          },
          createdAt: serverTimestamp(),
          resolved: false,
        });

        // Send warning notification
        await createNotification({
          userId: reporterId,
          recipientId: reporterId,
          type: 'AUTO_VIOLATION_WARNING',
          message: 'You are filing reports too frequently. Abuse of the reporting system may result in account restrictions.',
          status: 'UNREAD',
        });
      }
    }
  } catch (error) {
    console.error('Error checking for spam reporting:', error);
  }
}

/**
 * Check if an account is unverified and incomplete after 30 days
 */
export async function checkUnverifiedProfile(userId: string, userRole: string, createdAt: Timestamp | string): Promise<void> {
  try {
    const accountAge = Date.now() - (createdAt instanceof Timestamp ? createdAt.toMillis() : new Date(createdAt).getTime());
    const daysOld = accountAge / (1000 * 60 * 60 * 24);

    // Only check if account is older than 30 days
    if (daysOld < 30) return;

    // Get user profile - use direct doc fetch instead of query
    const userRef = doc(db, 'users', userId);
    const userSnap = await firebaseGetDocs(firestoreQuery(collection(db, 'users'), where('__name__', '==', userId)));
    
    let userProfile: UserProfile | undefined;
    
    if (!userSnap.empty) {
      userProfile = userSnap.docs[0].data() as UserProfile;
    } else {
      // Try to get by importing getDoc from firestoreService
      const docRef = doc(db, 'users', userId);
      const snap = await firebaseGetDocs(firestoreQuery(collection(db, 'users')));
      userProfile = snap.docs.find(d => d.id === userId)?.data() as UserProfile | undefined;
    }

    if (!userProfile) return;

    let isIncomplete = false;

    if (userRole === 'recruiter') {
      // Check for company name and logo
      isIncomplete = !userProfile.company || !userProfile.profileImage;
    } else if (userRole === 'student') {
      // Check for CV uploaded or profile complete
      isIncomplete = !userProfile.profileComplete || (!userProfile.resumeUrl && !userProfile.cvText);
    }

    if (!isIncomplete) return;

    // Check if we already have a notification for this
    const violationsCollection = collection(db, 'violations');
    const existingQuery = firestoreQuery(
      violationsCollection,
      where('userId', '==', userId),
      where('violationType', '==', 'PROFILE_INCOMPLETE')
    );
    const existingSnap = await firebaseGetDocs(existingQuery);

    // Only send once - don't spam the user
    if (existingSnap.size > 0) {
      return;
    }

    // Create violation record
    const violationRef = doc(violationsCollection);
    await setDoc(violationRef, {
      id: violationRef.id,
      userId,
      violationType: 'PROFILE_INCOMPLETE',
      severity: 'LOW',
      description: `${userRole} account incomplete after ${daysOld.toFixed(0)} days`,
      metadata: {
        daysOld: daysOld.toFixed(1),
      },
      createdAt: serverTimestamp(),
      resolved: false,
    });

    // Send one-time notification
    await createNotification({
      userId,
      recipientId: userId,
      type: 'PROFILE_INCOMPLETE',
      message: 'Complete your profile to maintain full access to Career Bridge features.',
      status: 'UNREAD',
    });
  } catch (error) {
    console.error('Error checking for unverified profile:', error);
  }
}

/**
 * Get violation history for a user
 */
export async function getViolationHistory(userId: string): Promise<ViolationDoc[]> {
  try {
    const violationsCollection = collection(db, 'violations');
    const q = firestoreQuery(
      violationsCollection,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await firebaseGetDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ViolationDoc));
  } catch (error) {
    console.error('Error fetching violation history:', error);
    return [];
  }
}
