import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createDocument, createNotification, updateDocument } from './firestoreService';

export function startBanScheduler(currentUserRole: 'admin') {
  if (currentUserRole !== 'admin') return null;
  const intervalId = setInterval(() => {
    checkExpiredDefenseWindows().catch((err) => {
      console.error('Ban scheduler failed to check expired defense windows:', err);
    });
  }, 300000);
  return intervalId;
}

export async function checkExpiredDefenseWindows() {
  const usersCollection = collection(db, 'users');
  const now = Timestamp.now();
  const q = query(
    usersCollection,
    where('isBanned', '==', false),
    where('defenseDeadline', '<=', now)
  );

  const snapshot = await getDocs(q);
  const expiredUsers = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((user: any) => {
      const deadline = user.defenseDeadline;
      return deadline && typeof (deadline as any).toMillis === 'function' && (deadline as any).toMillis() <= now.toMillis();
    });

  await Promise.all(expiredUsers.map((user: any) => executeAutoBan(user.id, 'Automatic ban: 5 reports received, defense window expired')));
}

export async function executeAutoBan(userId: string, reason: string) {
  await updateDocument('users', userId, {
    isBanned: true,
    banReason: reason,
    defenseDeadline: null,
    bannedAt: Timestamp.now(),
  });

  const reportsCollection = collection(db, 'reports');
  const reportsQuery = query(
    reportsCollection,
    where('reportedUserId', '==', userId),
    where('status', '==', 'DEFENSE_PENDING')
  );
  const reportsSnapshot = await getDocs(reportsQuery);

  await Promise.all(
    reportsSnapshot.docs.map((reportDoc) =>
      updateDocument('reports', reportDoc.id, { status: 'AUTO_BAN_EXECUTED' })
    )
  );

  await createNotification({
    userId,
    recipientId: userId,
    type: 'ACCOUNT_BANNED',
    message:
      'Your account has been permanently banned due to multiple verified reports and failure to submit a defense within the 48-hour window. You may submit an appeal.',
    status: 'UNREAD',
  });

  await createDocument('auditLog', {
    adminId: 'SYSTEM',
    action: 'BAN',
    targetUserId: userId,
    targetRole: 'student',
    reason,
    timestamp: Timestamp.now(),
  } as any);
}
