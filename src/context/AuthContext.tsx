import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "../firebase/config";

export type RoleType =
  | "Administrator"
  | "BarangayStaff"
  | "Requester"
  | "FinanceManager"
  | "DepartmentHead"
  | "BudgetOfficer"
  | "ProcurementOfficer"
  | "Auditor"
  | "Guest";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role: RoleType;
  department?: string;
  barangayId?: number | null;
  barangayName?: string | null;
  barangaySealUrl?: string | null;
  status?: "active" | "pending" | "rejected";
  profileImageUrl?: string | null;
}

export interface GoogleAccount {
  displayName: string;
  email: string | null;
  photoUrl: string | null;
}

export interface GoogleSignInResult {
  account: GoogleAccount;
  profile?: UserProfile;
}

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  googleSignIn: () => Promise<GoogleSignInResult>;
  completeGoogleOnboarding: (role: RoleType, barangayId?: number | string) => Promise<UserProfile>;
  cancelGoogleSignIn: () => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    role: RoleType,
    department?: string,
    barangayId?: number | string,
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultProfile: UserProfile | null = null;

class AccountAccessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AccountAccessError";
  }
}

const getAccountAccessMessage = (code?: string) => {
  if (code === "account_pending_approval") {
    return "Your account is pending administrator approval.";
  }
  if (code === "account_rejected") {
    return "Your account has been rejected. Please contact an administrator.";
  }
  return "We could not verify that your account is allowed to sign in.";
};

const fetchBackendUserProfile = async (token: string): Promise<UserProfile | null> => {
  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const code = data?.status === "rejected" ? "account_rejected" : (data?.error || "profile_unavailable");
      throw new AccountAccessError(getAccountAccessMessage(code), code);
    }

    const data = await res.json();
    if (!data?.profile) {
      return null;
    }

    return {
      uid: data.profile.firebase_uid,
      email: data.profile.email || null,
      displayName: data.profile.display_name || null,
      role: data.profile.role as RoleType,
      department: data.profile.department || undefined,
      barangayId: data.profile.barangay_id ?? null,
      barangayName: data.profile.barangay_name || null,
      barangaySealUrl: data.profile.barangay_seal_url || null,
      status: data.profile.status || "active",
      profileImageUrl: data.profile.profile_image_url || null,
    };
  } catch (error) {
    if (error instanceof AccountAccessError) {
      throw error;
    }
    console.error('Unable to fetch backend profile', error);
    throw new AccountAccessError(getAccountAccessMessage(), "profile_unavailable");
  }
};

const createBackendUserProfile = async (
  token: string,
  displayName: string,
  role: RoleType,
  department?: string,
  barangayId?: number | string,
  profileImageUrl?: string | null,
) => {
  if (!token) {
    throw new Error('No Firebase ID token available for backend registration');
  }

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ display_name: displayName, role, department, barangay_id: barangayId ? Number(barangayId) : null, profile_image_url: profileImageUrl || null }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Unable to create backend profile');
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileLoadPromise = useRef<Promise<UserProfile | null> | null>(null);
  const googleOnboardingUser = useRef<User | null>(null);
  const googleOnboardingInProgress = useRef(false);

  const loadProfile = async (user: User | null): Promise<UserProfile | null> => {
    if (!user) {
      setProfile(null);
      return null;
    }

    if (profileLoadPromise.current) {
      return profileLoadPromise.current;
    }

    const request = (async () => {
      const token = await user.getIdToken();
      const backendProfile = token ? await fetchBackendUserProfile(token) : null;

      if (!backendProfile || backendProfile.status !== "active") {
        const code = backendProfile?.status === "rejected" ? "account_rejected" : "account_pending_approval";
        throw new AccountAccessError(getAccountAccessMessage(code), code);
      }

      setProfile(backendProfile);
      return backendProfile;
    })();

    profileLoadPromise.current = request;
    try {
      return await request;
    } finally {
      if (profileLoadPromise.current === request) {
        profileLoadPromise.current = null;
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        if (googleOnboardingInProgress.current || googleOnboardingUser.current?.uid === user.uid) {
          setCurrentUser(user);
          setProfile(null);
          setIsLoading(false);
          return;
        }
        try {
          const loadedProfile = await loadProfile(user);
          setCurrentUser(loadedProfile ? user : null);
        } catch (err) {
          setError(err instanceof Error ? err.message : getAccountAccessMessage());
          setCurrentUser(null);
          setProfile(null);
          await signOut(auth);
        }
      } else {
        setCurrentUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const loadedProfile = await loadProfile(result.user);
      if (!loadedProfile) {
        throw new AccountAccessError(getAccountAccessMessage(), "profile_unavailable");
      }
      return loadedProfile;
    } catch (err) {
      const errorInfo = err as any;
      const message = err instanceof AccountAccessError
        ? err.message
        : "Unable to sign in. Check your credentials.";
      setError(message);
      await signOut(auth);
      try {
        await fetch('/api/auth/login-failed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, reason: errorInfo?.message || 'signin_error' }),
        });
      } catch (e: any) {
        console.warn('Failed to report login failure to backend', e?.message);
      }
      throw err;
    }
  };

  const googleSignIn = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      googleOnboardingInProgress.current = true;
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        googleOnboardingUser.current = result.user;
        setCurrentUser(result.user);
        const account = {
          displayName: result.user.displayName || 'Google User',
          email: result.user.email,
          photoUrl: result.user.photoURL,
        };
        const token = await result.user.getIdToken(true);
        const existingProfile = await fetchBackendUserProfile(token);

        // An approved account goes straight in. A previously submitted request
        // has a barangay assignment, so it must not be presented as new again.
        if (existingProfile?.status === 'active' || existingProfile?.barangayId) {
          googleOnboardingUser.current = null;
          googleOnboardingInProgress.current = false;
          if (existingProfile.status === 'active') {
            setProfile(existingProfile);
          } else {
            await signOut(auth);
            setCurrentUser(null);
            setProfile(null);
          }
          return { account, profile: existingProfile };
        }

        return { account };
      }
      throw new AccountAccessError(getAccountAccessMessage(), "profile_unavailable");
    } catch (err: any) {
      googleOnboardingInProgress.current = false;
      const message = err && (err.message || err.code) ? (err.message || err.code) : 'Google sign-in failed';
      setError(message);
      await signOut(auth);
      throw err;
    }
  };

  const completeGoogleOnboarding = async (role: RoleType, barangayId?: number | string) => {
    const user = googleOnboardingUser.current;
    if (!user) throw new Error('Your Google sign-in session has expired. Please try again.');

    const token = await user.getIdToken(true);
    await createBackendUserProfile(
      token,
      user.displayName || 'Google User',
      role,
      undefined,
      barangayId,
      user.photoURL,
    );
    const backendProfile = await fetchBackendUserProfile(token);
    googleOnboardingUser.current = null;
    googleOnboardingInProgress.current = false;
    if (!backendProfile) throw new Error('Unable to save your account details.');

    if (backendProfile.status === 'active') {
      setCurrentUser(user);
      setProfile(backendProfile);
    } else {
      await signOut(auth);
      setCurrentUser(null);
      setProfile(null);
    }
    return backendProfile;
  };

  const cancelGoogleSignIn = async () => {
    googleOnboardingUser.current = null;
    googleOnboardingInProgress.current = false;
    await signOut(auth);
    setCurrentUser(null);
    setProfile(null);
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
    role: RoleType,
    department?: string,
    barangayId?: number | string,
  ) => {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        const token = await result.user.getIdToken(true);
        await createBackendUserProfile(token, displayName, role, department, barangayId);
        await loadProfile(result.user);
      }
    } catch (err: any) {
      const message = err && (err.message || err.code) ? (err.message || err.code) : 'Sign up failed';
      setError(message);
      throw err;
    }
  };

  const signOutUser = async () => {
    setError(null);
    try {
      // notify backend about logout (best-effort)
      try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        if (token) {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (e: any) {
        console.warn('Failed to notify backend of logout', e?.message);
      }

      await signOut(auth);
      setCurrentUser(null);
      setProfile(null);
    } catch (err) {
      setError("Unable to sign out. Please try again.");
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await loadProfile(currentUser);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!currentUser) return null;
    return currentUser.getIdToken();
  };

  const value = useMemo(
    () => ({
      currentUser,
      profile,
      isLoading,
      error,
      signIn,
      googleSignIn,
      completeGoogleOnboarding,
      cancelGoogleSignIn,
      register,
      signOutUser,
      refreshProfile,
      getIdToken,
    }),
    [currentUser, profile, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
