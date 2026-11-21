import { type User } from 'firebase/auth';
import {
  Check,
  Copy,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Video,
  X,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import drSarwoAvatar from '../assets/images/avatar_dr_sarwo_1794715382790.jpg';
import { useWebRtcCall } from '../hooks/useWebRtcCall';
import {
  createDoctorInviteRoom,
  sendConsultationMessage,
  subscribeConsultation,
  subscribeDoctorConsultations,
  subscribeMessages,
  updateConsultationMode,
  updateConsultationStatus,
  updateDoctorClinicalNotes,
} from '../lib/consultationService';
import {
  type ChatMessage,
  type Consultation,
  type ConsultationMode,
  type ConsultationStatus,
  type MediaMode,
} from '../types/telemedicine';
import { ChatPanel } from './ChatPanel';
import { ClinicalNotesPanel } from './ClinicalNotesPanel';
import { VideoCallStage } from './VideoCallStage';

interface DoctorWorkspaceProps {
  user: User;
  initialRoomCode: string | null;
  onSignOut: () => Promise<void>;
}

type StatusFilter = 'all' | ConsultationStatus;

const STATUS_LABELS: Record<ConsultationStatus, string> = {
  waiting: 'Menunggu',
  active: 'Berlangsung',
  completed: 'Selesai',
};

const STATUS_TEXT_COLOR: Record<ConsultationStatus, string> = {
  waiting: 'text-amber-700',
  active: 'text-emerald-700',
  completed: 'text-slate-600',
};

function formatShortTime(c: Consultation): string {
  if (!c.updatedAt || typeof c.updatedAt.toDate !== 'function') return 'Baru';
  return c.updatedAt.toDate().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DoctorWorkspace({
  user,
  initialRoomCode,
  onSignOut,
}: DoctorWorkspaceProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initialRoomCode);
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [invitePatientName, setInvitePatientName] = useState('');
  const [inviteMode, setInviteMode] = useState<ConsultationMode>('video');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Subscribe to all consultations for Dr. Sarwo
  useEffect(() => {
    const unsub = subscribeDoctorConsultations((items) => {
      setConsultations(items);
      setIsLoadingList(false);
      setSelectedId((prev) => {
        if (prev && items.some((i) => i.id === prev)) return prev;
        if (initialRoomCode && items.some((i) => i.id === initialRoomCode)) return initialRoomCode;
        return items[0]?.id ?? null;
      });
    });
    return () => unsub();
  }, [initialRoomCode]);

  // Subscribe to active consultation doc and its messages
  useEffect(() => {
    if (!selectedId) {
      setActiveConsultation(null);
      setMessages([]);
      return;
    }

    const unsubDoc = subscribeConsultation(selectedId, (docData) => {
      setActiveConsultation(docData);
    });
    const unsubMsgs = subscribeMessages(selectedId, (msgs) => {
      setMessages(msgs);
    });

    return () => {
      unsubDoc();
      unsubMsgs();
    };
  }, [selectedId]);

  const webrtc = useWebRtcCall(activeConsultation, user, 'doctor');

  const filteredConsultations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return consultations.filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.patientName.toLowerCase().includes(q) ||
        c.inviteCode.toLowerCase().includes(q) ||
        c.chiefComplaint.toLowerCase().includes(q)
      );
    });
  }, [consultations, filter, searchQuery]);

  const handleCreateInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    try {
      const created = await createDoctorInviteRoom(user, inviteMode, invitePatientName);
      setSelectedId(created.id);
      setInvitePatientName('');
      setShowInviteForm(false);
      setMobileSidebarOpen(false);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCopyInviteLink = async (roomId: string) => {
    const url = `${window.location.origin}/?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(roomId);
      window.setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConsultation) return;
    if (activeConsultation.status === 'waiting') {
      await updateConsultationStatus(activeConsultation.id, 'active');
    }
    await sendConsultationMessage(activeConsultation.id, user, 'doctor', text, 'text');
  };

  const handleSaveNotes = async (notes: {
    diagnosisNote: string;
    prescriptionNote: string;
    followUpPlan: string;
    completeSession?: boolean;
  }) => {
    if (!activeConsultation) return;
    await updateDoctorClinicalNotes(activeConsultation.id, {
      diagnosisNote: notes.diagnosisNote,
      prescriptionNote: notes.prescriptionNote,
      followUpPlan: notes.followUpPlan,
      status: notes.completeSession ? 'completed' : undefined,
    });
    if (notes.completeSession) {
      await sendConsultationMessage(
        activeConsultation.id,
        user,
        'doctor',
        'Sesi konsultasi telah diselesaikan. Ringkasan medis dan anjuran dokter sudah tersedia.',
        'system'
      );
    }
  };

  const handleStartCall = async (mediaMode: MediaMode) => {
    await webrtc.startCall(mediaMode);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
        />
      )}

      {/* Left Queue Sidebar */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-40 w-80 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Klinik Sarwo
          </span>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Tutup daftar antrean"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Doctor Profile Strip */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              {!avatarFailed ? (
                <img
                  src={drSarwoAvatar}
                  alt="dr. Sarwo"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-teal-700 text-white text-xs font-bold">
                  DS
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user.displayName || 'dr. Sarwo'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onSignOut()}
            title="Keluar Akun"
            aria-label="Keluar Akun"
            className="p-2 text-slate-500 hover:text-red-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Create Invite Room CTA & Search */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <button
            type="button"
            onClick={() => setShowInviteForm((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Ruang Undangan</span>
          </button>

          {showInviteForm && (
            <form
              onSubmit={(e) => void handleCreateInvite(e)}
              className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Pasien (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={invitePatientName}
                  onChange={(e) => setInvitePatientName(e.target.value)}
                  placeholder="Contoh: Ibu Siti"
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
                <button
                  type="button"
                  onClick={() => setInviteMode('video')}
                  className={`flex-1 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    inviteMode === 'video'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Video Call
                </button>
                <button
                  type="button"
                  onClick={() => setInviteMode('chat')}
                  className={`flex-1 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    inviteMode === 'chat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Web Chat
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRoom}
                  className="flex-1 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded-md hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
                >
                  {isCreatingRoom ? 'Membuat...' : 'Buat Kode'}
                </button>
              </div>
            </form>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pasien atau kode..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          {/* Segmented Status Filter */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'waiting', 'active', 'completed'] as StatusFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  filter === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {key === 'all'
                  ? 'Semua'
                  : key === 'waiting'
                    ? 'Tunggu'
                    : key === 'active'
                      ? 'Aktif'
                      : 'Selesai'}
              </button>
            ))}
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoadingList ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-slate-700">Belum ada antrean konsultasi</p>
              <p className="text-xs text-slate-500 mt-1">
                Buat ruang undangan baru untuk dibagikan kepada pasien, atau tunggu pasien masuk.
              </p>
            </div>
          ) : (
            filteredConsultations.map((c) => {
              const isSelected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {c.patientName || 'Menunggu Pasien'}
                    </span>
                    <span className="font-mono-tabular text-xs text-slate-500 shrink-0">
                      {formatShortTime(c)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {c.chiefComplaint || c.lastMessagePreview || 'Belum ada keluhan tertulis'}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs mt-1.5">
                    <span className={`font-medium ${STATUS_TEXT_COLOR[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-500">
                      {c.mode === 'video' ? 'Video Call' : 'Web Chat'}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono-tabular text-slate-500">{c.inviteCode}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Context Bar */}
        <header className="no-print h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Buka daftar antrean"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {activeConsultation ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-display font-bold text-slate-900 truncate">
                    {activeConsultation.patientName || 'Menunggu Pasien Bergabung'}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    /
                  </span>
                  <span className="font-mono-tabular text-xs font-medium text-slate-600 shrink-0">
                    {activeConsultation.inviteCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  Status:{' '}
                  <span className={`font-medium ${STATUS_TEXT_COLOR[activeConsultation.status]}`}>
                    {STATUS_LABELS[activeConsultation.status]}
                  </span>
                  {' · '}
                  {activeConsultation.patientEmail || 'Tautan undangan siap dibagikan ke pasien'}
                </p>
              </div>
            ) : (
              <span className="font-display text-sm font-semibold text-slate-700">
                Ruang Praktik Daring dr. Sarwo
              </span>
            )}
          </div>

          {activeConsultation && (
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Mode Toggle */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => void updateConsultationMode(activeConsultation.id, 'chat')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    activeConsultation.mode === 'chat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Web Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => void updateConsultationMode(activeConsultation.id, 'video')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    activeConsultation.mode === 'video'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video Call</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleCopyInviteLink(activeConsultation.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedId === activeConsultation.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tautan Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link Pasien</span>
                  </>
                )}
              </button>
            </div>
          )}
        </header>

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {!activeConsultation ? (
            <div className="h-full min-h-[420px] bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center p-8 text-center">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Belum ada sesi konsultasi yang dipilih
              </h2>
              <p className="text-sm text-slate-600 mt-2 max-w-md">
                Pilih pasien dari daftar antrean di sebelah kiri, atau buat ruang undangan baru
                untuk dikirimkan ke pasien melalui WhatsApp atau email.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(true);
                  setMobileSidebarOpen(true);
                }}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Ruang Undangan Pertama</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Video Call Stage + Real-Time Web Chat */}
              <div className="lg:col-span-7 flex flex-col gap-5">
                <VideoCallStage
                  webrtc={webrtc}
                  peerDisplayName={activeConsultation.patientName || 'Pasien'}
                  isCompleted={activeConsultation.status === 'completed'}
                  onStartCall={handleStartCall}
                />

                <div className="h-[460px]">
                  <ChatPanel
                    messages={messages}
                    currentUserId={user.uid}
                    userRole="doctor"
                    isCompleted={activeConsultation.status === 'completed'}
                    onSendMessage={handleSendMessage}
                  />
                </div>
              </div>

              {/* Right Column: Patient Intake & Clinical Notes */}
              <div className="lg:col-span-5">
                <ClinicalNotesPanel
                  consultation={activeConsultation}
                  userRole="doctor"
                  onSaveNotes={handleSaveNotes}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
