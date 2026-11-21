import { onAuthStateChanged, type User } from 'firebase/auth';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { DoctorWorkspace } from './components/DoctorWorkspace';
import { LandingAuthView } from './components/LandingAuthView';
import { PatientPortal } from './components/PatientPortal';
import { isDoctorEmail, upsertUserProfile } from './lib/consultationService';
import { auth, signInWithGoogle, signOutUser } from './lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
            <h1 className="font-display text-lg font-bold text-slate-900">
              Terjadi Gangguan Koneksi
            </h1>
            <p className="text-sm text-slate-600">
              Silakan muat ulang halaman untuk menyambungkan kembali sesi konsultasi Anda.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getRoomCodeFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    return code ? code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') : null;
  } catch {
    return null;
  }
}

function TelemedicineApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingRoomCode] = useState<string | null>(() => getRoomCodeFromUrl());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser) {
        try {
          await upsertUserProfile(nextUser);
        } catch (err) {
          console.error('Failed upserting user profile:', err);
        }
      }
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('popup-closed-by-user')
          ? 'Jendela login Google ditutup sebelum selesai.'
          : 'Gagal masuk dengan Google. Pastikan pop-up diizinkan oleh browser Anda.';
      setAuthError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingAuthView
        pendingRoomCode={pendingRoomCode}
        authError={authError}
        isSigningIn={isSigningIn}
        onSignIn={handleSignIn}
      />
    );
  }

  if (isDoctorEmail(user.email)) {
    return (
      <DoctorWorkspace
        user={user}
        initialRoomCode={pendingRoomCode}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <PatientPortal
      user={user}
      initialRoomCode={pendingRoomCode}
      onSignOut={handleSignOut}
    />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <TelemedicineApp />
    </AppErrorBoundary>
  );
}
