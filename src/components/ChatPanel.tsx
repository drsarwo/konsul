import { Send } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { type ChatMessage, type UserRole } from '../types/telemedicine';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  userRole: UserRole;
  isCompleted: boolean;
  onSendMessage: (text: string) => Promise<void>;
}

const DOCTOR_QUICK_PROMPTS = [
  'Boleh ceritakan keluhan utama dan sejak kapan dirasakan?',
  'Apakah ada riwayat alergi obat atau penyakit sebelumnya?',
  'Apakah saat ini sedang mengonsumsi obat tertentu?',
  'Silakan sampaikan suhu tubuh atau tekanan darah jika sudah diukur.',
];

function formatTime(msg: ChatMessage): string {
  if (!msg.createdAt || typeof msg.createdAt.toDate !== 'function') {
    return 'Baru saja';
  }
  return msg.createdAt.toDate().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ChatPanel({
  messages,
  currentUserId,
  userRole,
  isCompleted,
  onSendMessage,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await onSendMessage(trimmed);
      setDraft('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[420px] bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Percakapan Konsultasi
          </h3>
          <p className="text-xs text-slate-500">
            Pesan teks tersinkronisasi real-time antara dokter dan pasien
          </p>
        </div>
        <span className="font-mono-tabular text-xs text-slate-500">
          {messages.length} pesan
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
            <p className="text-sm font-medium text-slate-700">Belum ada pesan percakapan</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Kirim pesan untuk memulai diskusi keluhan atau gunakan tombol Video Call di atas.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'system' || msg.type === 'call_event') {
              return (
                <div key={msg.id} className="flex justify-center py-1">
                  <p className="text-xs text-slate-500 text-center max-w-md px-3 py-1 bg-slate-100 rounded-md">
                    {msg.text} · <span className="font-mono-tabular">{formatTime(msg)}</span>
                  </p>
                </div>
              );
            }

            const isMine = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 px-1">
                  <span className="font-medium text-slate-700">
                    {isMine ? 'Anda' : msg.senderName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{formatTime(msg)}</span>
                </div>
                <div
                  className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isMine
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-slate-900 border border-slate-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Prompts for Doctor */}
      {userRole === 'doctor' && !isCompleted && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center gap-2 overflow-x-auto">
          {DOCTOR_QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setDraft(prompt)}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:border-teal-600 hover:text-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {prompt.length > 42 ? `${prompt.slice(0, 42)}...` : prompt}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      {isCompleted && userRole === 'patient' ? (
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-600">
          Sesi konsultasi telah diselesaikan oleh dokter. Anda tetap dapat membaca riwayat pesan dan
          ringkasan medis.
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="p-3 border-t border-slate-200 bg-white flex items-end gap-2"
        >
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
            maxLength={2000}
            placeholder="Tulis pesan konsultasi... (Enter untuk kirim)"
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isSending}
            className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </form>
      )}
    </div>
  );
}
