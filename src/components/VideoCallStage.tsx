import {
  ExternalLink,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type UseWebRtcCallResult } from '../hooks/useWebRtcCall';
import { type MediaMode } from '../types/telemedicine';

interface VideoCallStageProps {
  webrtc: UseWebRtcCallResult;
  peerDisplayName: string;
  isCompleted: boolean;
  onStartCall: (mode: MediaMode) => Promise<void>;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function VideoCallStage({
  webrtc,
  peerDisplayName,
  isCompleted,
  onStartCall,
}: VideoCallStageProps) {
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const isCallActiveOrDialing =
    webrtc.phase === 'calling' ||
    webrtc.phase === 'connecting' ||
    webrtc.phase === 'connected';

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    if (el.srcObject !== webrtc.remoteStream) {
      el.srcObject = webrtc.remoteStream;
    }
    if (webrtc.remoteStream && webrtc.remoteStream.getTracks().length > 0) {
      el.play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    }
  }, [webrtc.remoteStream, isCallActiveOrDialing]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (el.srcObject !== webrtc.localStream) {
      el.srcObject = webrtc.localStream;
    }
    if (webrtc.localStream) {
      el.play().catch(() => {});
    }
  }, [webrtc.localStream, isCallActiveOrDialing]);

  const handleUnlockAudio = () => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.play()
      .then(() => setAutoplayBlocked(false))
      .catch(() => {});
  };

  const hasRemoteVideo =
    !!webrtc.remoteStream && webrtc.remoteStream.getVideoTracks().length > 0;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div className="flex flex-col gap-3">
      {/* Error / Notice banners */}
      {webrtc.callError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-sm text-red-800">
          <span>{webrtc.callError}</span>
          <button
            type="button"
            onClick={webrtc.clearCallFeedback}
            className="text-xs font-medium underline shrink-0 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {webrtc.callNotice && !webrtc.callError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
          <span>{webrtc.callNotice}</span>
          <div className="flex items-center gap-3 shrink-0">
            {isInIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 underline"
              >
                <span>Buka di Tab Baru</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={webrtc.clearCallFeedback}
              className="text-xs font-medium underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Incoming Call Banner */}
      {webrtc.phase === 'ringing_incoming' && webrtc.activeCall && (
        <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">
                Panggilan {webrtc.activeCall.mediaMode === 'video' ? 'Video' : 'Suara'} Masuk
              </p>
              <p className="text-xs text-slate-300">
                Dari {webrtc.activeCall.callerName} · Menunggu Anda menjawab
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void webrtc.declineCall()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Tolak</span>
            </button>
            <button
              type="button"
              onClick={() => void webrtc.answerCall()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Phone className="w-4 h-4" />
              <span>Terima Panggilan</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Video Viewport */}
      {isCallActiveOrDialing ? (
        <div className="relative w-full aspect-video min-h-[300px] max-h-[520px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Waiting overlay when remote video isn't streaming yet */}
          {(!hasRemoteVideo || webrtc.phase !== 'connected') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-display text-xl font-bold text-teal-400 mb-3">
                {peerDisplayName.slice(0, 2).toUpperCase()}
              </div>
              <p className="font-display text-base font-semibold">{peerDisplayName}</p>
              <p className="text-sm text-slate-300 mt-1">
                {webrtc.phase === 'calling'
                  ? 'Memanggil lawan bicara...'
                  : webrtc.phase === 'connecting'
                    ? 'Menghubungkan media WebRTC...'
                    : webrtc.iceState === 'checking'
                      ? 'Menyambungkan jalur media...'
                      : 'Terhubung (kamera lawan tidak aktif)'}
              </p>
            </div>
          )}

          {/* Autoplay Unblock Button if browser muted playback */}
          {autoplayBlocked && (
            <button
              type="button"
              onClick={handleUnlockAudio}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-lg cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>Aktifkan Suara &amp; Video</span>
            </button>
          )}

          {/* Top Scrim & Status */}
          <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/75 via-black/30 to-transparent flex items-center justify-between text-white pointer-events-none">
            <div>
              <p className="text-sm font-semibold">{peerDisplayName}</p>
              <p className="text-xs text-slate-200">
                {webrtc.phase === 'connected'
                  ? 'Terhubung · WebRTC'
                  : webrtc.phase === 'calling'
                    ? 'Menunggu jawaban'
                    : 'Menyambungkan'}
              </p>
            </div>
            {webrtc.phase === 'connected' && (
              <div className="font-mono-tabular text-sm font-medium bg-black/50 px-2.5 py-1 rounded-md border border-white/15">
                {formatDuration(webrtc.callDurationSec)}
              </div>
            )}
          </div>

          {/* Local PiP Preview */}
          <div className="absolute bottom-20 right-4 w-32 sm:w-44 aspect-video rounded-lg overflow-hidden border border-white/25 bg-slate-800 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                webrtc.isScreenSharing ? '' : '-scale-x-100'
              }`}
            />
            {webrtc.isCameraOff && !webrtc.isScreenSharing && (
              <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-xs text-slate-300 px-2 text-center">
                Kamera mati
              </div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={webrtc.toggleMic}
              title={webrtc.isMicMuted ? 'Nyalakan Mikrofon' : 'Bisukan Mikrofon'}
              aria-label={webrtc.isMicMuted ? 'Nyalakan Mikrofon' : 'Bisukan Mikrofon'}
              className={`h-11 px-4 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                webrtc.isMicMuted
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-800/90 text-white hover:bg-slate-700 border border-white/15'
              }`}
            >
              {webrtc.isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {webrtc.isMicMuted ? 'Mikrofon Mati' : 'Mikrofon'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void webrtc.toggleCamera()}
              title={webrtc.isCameraOff ? 'Nyalakan Kamera' : 'Matikan Kamera'}
              aria-label={webrtc.isCameraOff ? 'Nyalakan Kamera' : 'Matikan Kamera'}
              className={`h-11 px-4 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                webrtc.isCameraOff
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-800/90 text-white hover:bg-slate-700 border border-white/15'
              }`}
            >
              {webrtc.isCameraOff ? (
                <VideoOff className="w-4 h-4" />
              ) : (
                <Video className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {webrtc.isCameraOff ? 'Kamera Mati' : 'Kamera'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void webrtc.toggleScreenShare()}
              title={webrtc.isScreenSharing ? 'Hentikan Berbagi Layar' : 'Bagikan Layar'}
              aria-label={webrtc.isScreenSharing ? 'Hentikan Berbagi Layar' : 'Bagikan Layar'}
              className={`h-11 px-4 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                webrtc.isScreenSharing
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-slate-800/90 text-white hover:bg-slate-700 border border-white/15'
              }`}
            >
              <MonitorUp className="w-4 h-4" />
              <span className="hidden sm:inline">
                {webrtc.isScreenSharing ? 'Berhenti Berbagi' : 'Bagikan Layar'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void webrtc.endCall()}
              title="Akhiri Panggilan"
              aria-label="Akhiri Panggilan"
              className="h-11 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Akhiri</span>
            </button>
          </div>
        </div>
      ) : (
        /* Idle Video Call Readiness Card */
        <div className="p-6 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Panggilan Video &amp; Suara WebRTC
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {isCompleted
                ? 'Sesi konsultasi telah selesai. Panggilan video dinonaktifkan.'
                : `Hubungi ${peerDisplayName} secara tatap muka atau panggilan suara langsung di browser.`}
            </p>
          </div>

          {!isCompleted && (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => void onStartCall('audio')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Phone className="w-4 h-4" />
                <span>Panggilan Suara</span>
              </button>
              <button
                type="button"
                onClick={() => void onStartCall('video')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                <span>Mulai Video Call</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
