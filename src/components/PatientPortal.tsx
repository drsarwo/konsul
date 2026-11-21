import { type User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  LogOut,
  MessageSquare,
  Video,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import drSarwoAvatar from '../assets/images/avatar_dr_sarwo_1794715382790.jpg';
import { useWebRtcCall } from '../hooks/useWebRtcCall';
import {
  createPatientConsultation,
  joinConsultationByCode,
  sendConsultationMessage,
  subscribeConsultation,
  subscribeMessages,
  subscribePatientConsultations,
} from '../lib/consultationService';
import {
  type ChatMessage,
  type Consultation,
  type ConsultationMode,
  type ConsultationStatus,
  DOCTOR_DEFAULT_NAME,
  type MediaMode,
} from '../types/telemedicine';
import { ChatPanel } from './ChatPanel';
import { ClinicalNotesPanel } from './ClinicalNotesPanel';
import { VideoCallStage } from './VideoCallStage';

interface PatientPortalProps {
  user: User;
  initialRoomCode: string | null;
  onSignOut: () => Promise<void>;
}

const STATUS_LABELS: Record<ConsultationStatus, string> = {
  waiting: 'Menunggu Dokter',
  active: 'Sedang Berlangsung',
  completed: 'Selesai',
};

const STATUS_COLOR: Record<ConsultationStatus, string> = {
  waiting: 'text-amber-700',
  active: 'text-emerald-700',
  completed: 'text-slate-600',
};

function formatDateTime(c: Consultation): string {
  if (!c.updatedAt || typeof c.updatedAt.toDate !== 'function') return 'Baru saja';
  return c.updatedAt.toDate().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PatientPortal({
  user,
  initialRoomCode,
  onSignOut,
}: PatientPortalProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Intake form state
  const [patientName, setPatientName] = useState(user.displayName || '');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptomDuration, setSymptomDuration] = useState('');
  const [allergies, setAllergies] = useState('');
  const [vitalsNote, setVitalsNote] = useState('');
  const [preferredMode, setPreferredMode] = useState<ConsultationMode>('video');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Join code state
  const [joinCode, setJoinCode] = useState(initialRoomCode || '');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Subscribe to patient's consultations
  useEffect(() => {
    const unsub = subscribePatientConsultations(user.uid, (items) => {
      setConsultations(items);
      setIsLoadingHistory(false);
    });
    return () => unsub();
  }, [user.uid]);

  // Auto-join if URL contains ?room=...
  useEffect(() => {
    if (!initialRoomCode) return;
    let cancelled = false;
    (async () => {
      setIsJoining(true);
      setJoinError(null);
      try {
        const res = await joinConsultationByCode(initialRoomCode, user, {
          patientName: user.displayName || 'Pasien',
        });
        if (!cancelled) {
          if (res.consultation) {
            setActiveRoomId(res.consultation.id);
          } else if (res.error) {
            setJoinError(res.error);
          }
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRoomCode, user]);

  // Subscribe to active consultation + messages
  useEffect(() => {
    if (!activeRoomId) {
      setActiveConsultation(null);
      setMessages([]);
      return;
    }
    const unsubDoc = subscribeConsultation(activeRoomId, (docData) => {
      setActiveConsultation(docData);
    });
    const unsubMsgs = subscribeMessages(activeRoomId, (msgs) => {
      setMessages(msgs);
    });
    return () => {
      unsubDoc();
      unsubMsgs();
    };
  }, [activeRoomId]);

  const webrtc = useWebRtcCall(activeConsultation, user, 'patient');

  const handleStartConsultation = async (e: FormEvent) => {
    e.preventDefault();
    if (!chiefComplaint.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const created = await createPatientConsultation(user, {
        patientName: patientName || user.displayName || 'Pasien',
        chiefComplaint,
        symptomDuration,
        allergies,
        vitalsNote,
        mode: preferredMode,
      });
      setChiefComplaint('');
      setSymptomDuration('');
      setAllergies('');
      setVitalsNote('');
      setActiveRoomId(created.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || isJoining) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await joinConsultationByCode(joinCode, user, {
        patientName: patientName || user.displayName || 'Pasien',
      });
      if (res.consultation) {
        setActiveRoomId(res.consultation.id);
        setJoinCode('');
      } else if (res.error) {
        setJoinError(res.error);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConsultation) return;
    await sendConsultationMessage(activeConsultation.id, user, 'patient', text, 'text');
  };

  const handleStartCall = async (mediaMode: MediaMode) => {
    await webrtc.startCall(mediaMode);
  };

  // --- Consultation Room View ---
  if (activeRoomId && activeConsultation) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="no-print h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setActiveRoomId(null)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Beranda Pasien</span>
            </button>

            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              /
            </span>

            <div className="min-w-0 hidden sm:block">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-display font-bold text-slate-900 truncate">
                  Konsultasi dengan {activeConsultation.doctorName || DOCTOR_DEFAULT_NAME}
                </span>
                <span className="font-mono-tabular text-xs text-slate-500">
                  {activeConsultation.inviteCode}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className={`text-xs font-semibold ${STATUS_COLOR[activeConsultation.status]}`}>
              {STATUS_LABELS[activeConsultation.status]}
            </span>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-700 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 flex flex-col gap-5">
              <VideoCallStage
                webrtc={webrtc}
                peerDisplayName={activeConsultation.doctorName || DOCTOR_DEFAULT_NAME}
                isCompleted={activeConsultation.status === 'completed'}
                onStartCall={handleStartCall}
              />

              <div className="h-[460px]">
                <ChatPanel
                  messages={messages}
                  currentUserId={user.uid}
                  userRole="patient"
                  isCompleted={activeConsultation.status === 'completed'}
                  onSendMessage={handleSendMessage}
                />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-5">
              {/* Doctor Summary Card */}
              <div className="no-print bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  {!avatarFailed ? (
                    <img
                      src={drSarwoAvatar}
                      alt="dr. Sarwo"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-teal-700 text-white font-bold">
                      DS
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-slate-900">
                    {activeConsultation.doctorName || DOCTOR_DEFAULT_NAME}
                  </p>
                  <p className="text-xs text-slate-500">
                    Dokter Penanggung Jawab · Ruang{' '}
                    <span className="font-mono-tabular">{activeConsultation.inviteCode}</span>
                  </p>
                </div>
              </div>

              <ClinicalNotesPanel
                consultation={activeConsultation}
                userRole="patient"
                onSaveNotes={async () => {}}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- Patient Home / Intake View ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="h-16 px-6 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Klinik Sarwo
          </span>

          <div className="flex items-center gap-4 text-sm text-slate-600 shrink-0">
            <span className="hidden sm:inline truncate max-w-[200px]">
              {user.displayName || user.email}
            </span>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Portal Konsultasi Pasien
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Mulai konsultasi baru bersama dr. Sarwo melalui web chat atau video call, atau masuk
            menggunakan kode ruang dari dokter.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Start New Consultation Form */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Mulai Konsultasi Baru
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Lengkapi informasi keluhan singkat agar dr. Sarwo dapat segera meninjau kondisi Anda.
            </p>

            <form onSubmit={(e) => void handleStartConsultation(e)} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap Pasien
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nama lengkap sesuai identitas"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Keluhan Utama
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={1000}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Jelaskan gejala atau keluhan yang sedang Anda rasakan..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sejak Kapan Dirasakan
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={symptomDuration}
                    onChange={(e) => setSymptomDuration(e.target.value)}
                    placeholder="Contoh: 2 hari terakhir"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Suhu / Tekanan Darah (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={vitalsNote}
                    onChange={(e) => setVitalsNote(e.target.value)}
                    placeholder="Contoh: 37.8°C, 120/80 mmHg"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Riwayat Alergi Obat / Makanan (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Contoh: Tidak ada / Alergi Amoxicillin"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Metode Konsultasi Pilihan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPreferredMode('video')}
                    className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                      preferredMode === 'video'
                        ? 'border-teal-700 bg-teal-50/70 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Video className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Video Call &amp; Chat</p>
                      <p className="text-xs text-slate-500">Tatap muka via browser</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreferredMode('chat')}
                    className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                      preferredMode === 'chat'
                        ? 'border-teal-700 bg-teal-50/70 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Web Chat</p>
                      <p className="text-xs text-slate-500">Konsultasi pesan teks</p>
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !chiefComplaint.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <span>
                  {isSubmitting ? 'Membuka Ruang Konsultasi...' : 'Masuk Ruang Konsultasi'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </section>

          {/* Right: Join by Code + Consultation History */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-slate-900">
                <KeyRound className="w-4 h-4 text-teal-700" />
                <h2 className="font-display text-base font-bold">Gabung dengan Kode Undangan</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan kode ruang dari dr. Sarwo (contoh: KLS-XXXXXX) jika Anda menerima tautan
                undangan.
              </p>

              <form onSubmit={(e) => void handleJoinByCode(e)} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="KLS-XXXXXX"
                  maxLength={16}
                  className="flex-1 font-mono-tabular uppercase rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isJoining || !joinCode.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isJoining ? 'Mencari...' : 'Gabung'}
                </button>
              </form>

              {joinError && <p className="mt-2.5 text-xs text-red-700">{joinError}</p>}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Riwayat Konsultasi Saya
                </h2>
              </div>

              {isLoadingHistory ? (
                <div className="p-5 space-y-3">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : consultations.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-medium text-slate-700">Belum ada riwayat konsultasi</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesi chat dan video call Anda dengan dr. Sarwo akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {consultations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveRoomId(c.id)}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular text-xs font-semibold text-slate-700">
                          {c.inviteCode}
                        </span>
                        <span className={`text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate mt-1">
                        {c.chiefComplaint || 'Konsultasi medis'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {c.mode === 'video' ? 'Video Call' : 'Web Chat'} ·{' '}
                        <span className="font-mono-tabular">{formatDateTime(c)}</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
