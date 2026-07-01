import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  fetchSignInMethodsForEmail,
  type User as FirebaseUser,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserRole, type UserProfile } from '../../types';

/**
 * Validates registration inputs before creating auth user
 * @throws Error with descriptive message if validation fails
 */
function validateRegistrationInput(
  name: string,
  email: string,
  password: string,
  role: UserRole
): void {
  if (!name || name.trim().length < 2) {
    throw new Error('Full name must be at least 2 characters');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (!role) {
    throw new Error('Please select a role');
  }
}

/**
 * Checks if a user already exists in Firestore
 */
async function checkIfUserExists(email: string): Promise<UserProfile | null> {
  try {
    // Query would be needed for email lookup, but for now we check during auth creation
    // This will be caught by the email-already-in-use error from Firebase Auth
    return null;
  } catch (err) {
    console.error('Error checking user existence:', err);
    return null;
  }
}

/**
 * Registers a new user with email/password and creates a Firestore profile
 * Matches mobile app schema: uid, name, email, role, createdAt
 */
export async function registerUser(name: string, email: string, password: string, role: UserRole) {
  // STEP 1: Validate all inputs BEFORE any auth/firestore operations
  validateRegistrationInput(name, email, password, role);

  let firebaseUser: FirebaseUser | null = null;

  try {
    // STEP 2: Create Firebase Auth user
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    firebaseUser = credential.user;

    // STEP 3: Update auth user profile
    await updateFirebaseProfile(firebaseUser, { displayName: name });

    // STEP 4: Write user document to Firestore with mobile-app-compatible schema
    // Schema matches mobile app: uid, name, email, role, createdAt (plus optional web fields)
    const userProfile: Partial<UserProfile> = {
      uid: firebaseUser.uid,
      name,
      email,
      role,
      createdAt: serverTimestamp() as any,
      profileComplete: role !== UserRole.STUDENT ? true : false,
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      isOnline: true,
      isPrivate: false,
      isBanned: false,
      skills: [],
      projects: [],
      applications: [],
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);

    return userProfile as UserProfile;
  } catch (err) {
    // STEP 5: Handle specific Firebase Auth errors
    const error = err as any;
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(
        'This email is already registered. Please login instead or use a different email.'
      );
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Use at least 6 characters.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Email/password signup is currently disabled');
    }

    // Re-throw with original message if not a specific Firebase error
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to register user. Please try again.');
  }
}


export async function loginUser(email: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (err) {
    const error = err as any;
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email. Please sign up first.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled');
    }
    throw err;
  }
}

const ADMIN_EMAIL = 'admin@careerbridge.com';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_DISPLAY_NAME = 'Platform Admin';

export async function loginAdmin(password: string) {
  if (password !== ADMIN_PASSWORD) {
    throw new Error('Invalid admin password');
  }

  try {
    return await loginUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (err) {
    const error = err as any;

    const shouldCreateAdmin =
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/invalid-email' ||
      error.code === 'auth/invalid-credential';

    if (shouldCreateAdmin) {
      const signInMethods = await fetchSignInMethodsForEmail(auth, ADMIN_EMAIL);
      if (signInMethods.length === 0) {
        const credential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        const firebaseUser = credential.user;
        await updateFirebaseProfile(firebaseUser, { displayName: ADMIN_DISPLAY_NAME });

        const adminProfile: Partial<UserProfile> = {
          uid: firebaseUser.uid,
          name: ADMIN_DISPLAY_NAME,
          email: ADMIN_EMAIL,
          role: UserRole.ADMIN,
          createdAt: serverTimestamp() as any,
          profileComplete: true,
          profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(ADMIN_DISPLAY_NAME)}&background=random`,
          isOnline: true,
          isPrivate: false,
          isBanned: false,
          skills: [],
          projects: [],
          applications: [],
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), adminProfile);
        await setDoc(
          doc(db, 'adminCredentials', 'fixed'),
          {
            email: ADMIN_EMAIL,
            role: UserRole.ADMIN,
            createdAt: serverTimestamp() as any,
          },
          { merge: true }
        );

        return firebaseUser;
      }

      if (error.code === 'auth/invalid-credential') {
        throw new Error('Admin account exists but the credential is invalid. Check Firebase Auth settings and account password.');
      }
    }

    throw err;
  }
}

const OAUTH_ROLE_KEY = 'careerbridge_oauth_role';

function mapOAuthError(err: unknown, provider: string): Error {
  const error = err as { code?: string; message?: string };
  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return new Error('Sign-in cancelled');
    case 'auth/popup-blocked':
      return new Error('Pop-up blocked. Allow pop-ups for this site, or try again to use redirect sign-in.');
    case 'auth/unauthorized-domain':
      return new Error('This domain is not authorized for sign-in. Add it in the Firebase Console.');
    case 'auth/operation-not-allowed':
      return new Error(`${provider} sign-in is not enabled. Enable it in Firebase Authentication settings.`);
    case 'auth/account-exists-with-different-credential':
      return new Error('An account already exists with this email using a different sign-in method.');
    case 'auth/cancelled-popup-request':
      return new Error('Sign-in was interrupted. Please try again.');
    default:
      return new Error(error.message || `${provider} sign-in failed`);
  }
}

function storeOAuthRole(role: UserRole) {
  sessionStorage.setItem(OAUTH_ROLE_KEY, role);
}

function readOAuthRole(): UserRole {
  const stored = sessionStorage.getItem(OAUTH_ROLE_KEY);
  sessionStorage.removeItem(OAUTH_ROLE_KEY);
  if (stored === UserRole.RECRUITER || stored === UserRole.ADMIN) {
    return stored;
  }
  return UserRole.STUDENT;
}

async function handleProviderSignIn(credential: UserCredential, role: UserRole = UserRole.STUDENT): Promise<UserProfile> {
  const firebaseUser = credential.user;
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const userProfile: Partial<UserProfile> = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Anonymous User',
      email: firebaseUser.email || '',
      role,
      createdAt: serverTimestamp() as any,
      profileComplete: role !== UserRole.STUDENT ? true : false,
      profileImage: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'A')}&background=random`,
      isOnline: true,
      isPrivate: false,
      isBanned: false,
      skills: [],
      projects: [],
      applications: [],
    };
    await setDoc(userRef, userProfile);
  }

  const profile = await fetchUserProfile(firebaseUser.uid);
  if (!profile) {
    throw new Error('Signed in successfully but failed to load your profile. Please try again.');
  }
  return profile;
}

async function signInWithProviderPopupOrRedirect(provider: GoogleAuthProvider | GithubAuthProvider, role: UserRole, providerName: string) {
  try {
    const credential = await signInWithPopup(auth, provider);
    return await handleProviderSignIn(credential, role);
  } catch (err) {
    const error = err as { code?: string };
    if (error.code === 'auth/popup-blocked') {
      storeOAuthRole(role);
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw mapOAuthError(err, providerName);
  }
}

export async function completeOAuthRedirect(): Promise<UserProfile | null> {
  try {
    const credential = await getRedirectResult(auth);
    if (!credential) {
      return null;
    }
    return handleProviderSignIn(credential, readOAuthRole());
  } catch (err) {
    throw mapOAuthError(err, 'OAuth');
  }
}

export async function loginWithGoogle(role: UserRole = UserRole.STUDENT): Promise<UserProfile | null> {
  const provider = new GoogleAuthProvider();
  return signInWithProviderPopupOrRedirect(provider, role, 'Google');
}

export async function loginWithGithub(role: UserRole = UserRole.STUDENT): Promise<UserProfile | null> {
  const provider = new GithubAuthProvider();
  return signInWithProviderPopupOrRedirect(provider, role, 'GitHub');
}


export async function logoutUser() {
  return signOut(auth);
}

export function subscribeAuthState(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  return { uid: userDoc.id, ...(userDoc.data() as Omit<UserProfile, 'uid'>) };
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
