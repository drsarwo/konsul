import { type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  generateSafeId,
  sendConsultationMessage,
} from '../lib/consultationService';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  type Consultation,
  DOCTOR_DEFAULT_NAME,
  type MediaMode,
  type UserRole,
  type WebRtcCall,
} from '../types/telemedicine';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export type LocalCallPhase = 'idle' | 'calling' | 'ringing_incoming' | 'connecting' | 'connected';

export interface UseWebRtcCallResult {
  phase: LocalCallPhase;
  activeCall: WebRtcCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  iceState: string;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  callDurationSec: number;
  callError: string | null;
  callNotice: string | null;
  startCall: (mediaMode?: MediaMode) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  clearCallFeedback: () => void;
}

export function useWebRtcCall(
  consultation: Consultation | null,
  currentUser: User | null,
  userRole: UserRole
): UseWebRtcCallResult {
  const [phase, setPhase] = useState<LocalCallPhase>('idle');
  const [activeCall, setActiveCall] = useState<WebRtcCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [iceState, setIceState] = useState<string>('new');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);
  const [callNotice, setCallNotice] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const addedIceIdsRef = useRef<Set<string>>(new Set());
  const callUnsubsRef = useRef<Unsubscribe[]>([]);
  const activeCallRef = useRef<WebRtcCall | null>(null);
  const phaseRef = useRef<LocalCallPhase>('idle');
  const currentCallIdRef = useRef<string>('');
  const isSettingRemoteDescRef = useRef(false);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const cleanupPeerResources = useCallback(() => {
    callUnsubsRef.current.forEach((u) => u());
    callUnsubsRef.current = [];
    pendingIceRef.current = [];
    addedIceIdsRef.current.clear();
    isSettingRemoteDescRef.current = false;

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    currentCallIdRef.current = '';
    setLocalStream(null);
    setRemoteStream(null);
    setIceState('new');
    setIsMicMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setCallDurationSec(0);
    setPhase('idle');
  }, []);

  // Call duration timer when connected
  useEffect(() => {
    if (phase !== 'connected') {
      setCallDurationSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCallDurationSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Listen to activeCallId on the current consultation
  const consultationId = consultation?.id || '';
  const activeCallId = consultation?.activeCallId || '';

  useEffect(() => {
    if (!consultationId || !activeCallId || !currentUser) {
      if (phaseRef.current !== 'idle' && !activeCallId) {
        cleanupPeerResources();
      }
      setActiveCall(null);
      return;
    }

    // If activeCallId switched to a different call while an older call was lingering, reset first
    if (currentCallIdRef.current && currentCallIdRef.current !== activeCallId) {
      cleanupPeerResources();
    }

    const callPath = `consultations/${consultationId}/calls/${activeCallId}`;
    const callDocRef = doc(db, 'consultations', consultationId, 'calls', activeCallId);

    const unsub = onSnapshot(
      callDocRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          setActiveCall(null);
          return;
        }
        const callData = snapshot.data() as WebRtcCall;
        setActiveCall(callData);

        // Remote hangup or decline
        if (callData.status === 'ended' || callData.status === 'declined') {
          if (phaseRef.current !== 'idle') {
            setCallNotice(
              callData.status === 'declined'
                ? 'Panggilan ditolak oleh pihak lawan.'
                : 'Panggilan video telah diakhiri.'
            );
            cleanupPeerResources();
          }
          return;
        }

        // Incoming call for receiver
        if (callData.status === 'ringing' && callData.callerId !== currentUser.uid) {
          if (phaseRef.current === 'idle') {
            setPhase('ringing_incoming');
          }
        }

        // Caller receives answer SDP
        if (
          callData.callerId === currentUser.uid &&
          callData.status === 'connected' &&
          callData.answerSdp &&
          pcRef.current &&
          !pcRef.current.currentRemoteDescription &&
          !isSettingRemoteDescRef.current
        ) {
          isSettingRemoteDescRef.current = true;
          try {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: 'answer', sdp: callData.answerSdp })
            );
            for (const candidate of pendingIceRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingIceRef.current = [];
            setPhase('connected');
          } catch (err) {
            console.error('Failed setting remote answer SDP:', err);
          } finally {
            isSettingRemoteDescRef.current = false;
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, callPath);
      }
    );

    return () => {
      unsub();
    };
  }, [consultationId, activeCallId, currentUser, cleanupPeerResources]);

  // Cleanup on consultation switch or unmount
  useEffect(() => {
    return () => {
      cleanupPeerResources();
    };
  }, [consultationId, cleanupPeerResources]);

  const acquireUserMedia = useCallback(
    async (mediaMode: MediaMode): Promise<{ stream: MediaStream; hadAudio: boolean; hadVideo: boolean }> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCallNotice(
          'Browser atau frame ini membatasi akses kamera/mikrofon. Panggilan tetap terhubung dalam mode terima saja.'
        );
        return { stream: new MediaStream(), hadAudio: false, hadVideo: false };
      }

      if (mediaMode === 'audio') {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          return { stream: audioStream, hadAudio: true, hadVideo: false };
        } catch {
          setCallNotice(
            'Mikrofon tidak dapat diakses — Anda terhubung dalam mode dengar saja. Periksa izin browser atau buka di tab baru.'
          );
          return { stream: new MediaStream(), hadAudio: false, hadVideo: false };
        }
      }

      // Attempt HD video + audio first
      try {
        const fullStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });
        return { stream: fullStream, hadAudio: true, hadVideo: true };
      } catch {
        // Retry with unconstrained video (fixes OverconstrainedError on some webcams)
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          return { stream: basicStream, hadAudio: true, hadVideo: true };
        } catch {
          // Fallback to audio-only (e.g. webcam busy in another tab or missing)
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            setCallNotice(
              'Kamera tidak tersedia atau sedang digunakan — panggilan berjalan dengan suara saja (Anda tetap dapat melihat video lawan bicara).'
            );
            return { stream: audioOnly, hadAudio: true, hadVideo: false };
          } catch {
            // Last resort: receive-only stream so WebRTC still connects cleanly
            setCallNotice(
              'Kamera & mikrofon diblokir atau tidak tersedia. Anda terhubung dalam mode terima video/suara saja — buka aplikasi di tab baru untuk mengaktifkan kamera.'
            );
            return { stream: new MediaStream(), hadAudio: false, hadVideo: false };
          }
        }
      }
    },
    []
  );

  const setupPeerConnection = useCallback(
    (stream: MediaStream, targetConsultationId: string, callId: string, isCaller: boolean) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      currentCallIdRef.current = callId;

      const remote = new MediaStream();
      setRemoteStream(remote);

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => pc.addTrack(track, stream));
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => pc.addTrack(track, stream));
      } else {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }

      pc.ontrack = (event) => {
        const incomingTracks =
          event.streams[0]?.getTracks() && event.streams[0].getTracks().length > 0
            ? event.streams[0].getTracks()
            : [event.track];

        let changed = false;
        incomingTracks.forEach((track) => {
          if (!remote.getTracks().some((existing) => existing.id === track.id)) {
            remote.addTrack(track);
            changed = true;
          }
          track.onunmute = () => {
            setRemoteStream(new MediaStream(remote.getTracks()));
          };
          track.onended = () => {
            setRemoteStream(new MediaStream(remote.getTracks()));
          };
        });

        if (changed || remote.getTracks().length > 0) {
          setRemoteStream(new MediaStream(remote.getTracks()));
        }
      };

      const candidateColName = isCaller ? 'offerCandidates' : 'answerCandidates';
      const remoteCandidateColName = isCaller ? 'answerCandidates' : 'offerCandidates';

      pc.onicecandidate = async (event) => {
        // Ignore end-of-candidates empty signals (candidate === "")
        if (!event.candidate || !event.candidate.candidate || !currentUser) return;
        const candId = generateSafeId('ice');
        const candPath = `consultations/${targetConsultationId}/calls/${callId}/${candidateColName}/${candId}`;
        try {
          await setDoc(
            doc(
              db,
              'consultations',
              targetConsultationId,
              'calls',
              callId,
              candidateColName,
              candId
            ),
            {
              candidate: event.candidate.candidate.slice(0, 2000),
              sdpMid: (event.candidate.sdpMid ?? '').slice(0, 64),
              sdpMLineIndex:
                typeof event.candidate.sdpMLineIndex === 'number' &&
                event.candidate.sdpMLineIndex >= 0 &&
                event.candidate.sdpMLineIndex <= 32
                  ? event.candidate.sdpMLineIndex
                  : 0,
              senderId: currentUser.uid,
              createdAt: serverTimestamp(),
            }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, candPath);
        }
      };

      pc.oniceconnectionstatechange = () => {
        setIceState(pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setPhase('connected');
        } else if (pc.iceConnectionState === 'failed') {
          setCallError(
            'Koneksi media peer-to-peer gagal menembus jaringan. Coba akhiri dan panggil ulang, atau pastikan tidak terblokir VPN/firewall.'
          );
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setPhase('connected');
        } else if (pc.connectionState === 'failed') {
          setCallError('Koneksi peer-to-peer terputus. Silakan coba panggil ulang.');
        }
      };

      // Subscribe to remote ICE candidates
      const remoteIcePath = `consultations/${targetConsultationId}/calls/${callId}/${remoteCandidateColName}`;
      const unsubIce = onSnapshot(
        collection(
          db,
          'consultations',
          targetConsultationId,
          'calls',
          callId,
          remoteCandidateColName
        ),
        async (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added' && !addedIceIdsRef.current.has(change.doc.id)) {
              addedIceIdsRef.current.add(change.doc.id);
              const data = change.doc.data();
              if (!data.candidate) continue;
              const iceInit: RTCIceCandidateInit = {
                candidate: data.candidate,
                sdpMid: data.sdpMid || null,
                sdpMLineIndex: typeof data.sdpMLineIndex === 'number' ? data.sdpMLineIndex : 0,
              };
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(iceInit));
                } catch (err) {
                  console.error('Error adding ICE candidate:', err);
                }
              } else {
                pendingIceRef.current.push(iceInit);
              }
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, remoteIcePath);
        }
      );

      callUnsubsRef.current.push(unsubIce);
      return pc;
    },
    [currentUser]
  );

  const startCall = useCallback(
    async (mediaMode: MediaMode = 'video') => {
      if (!consultation || !currentUser) return;
      if (consultation.status === 'completed') {
        setCallError('Konsultasi ini sudah selesai.');
        return;
      }

      // Reset any prior call resources cleanly before dialing
      if (phaseRef.current !== 'idle') {
        cleanupPeerResources();
      }

      setCallError(null);
      setCallNotice(null);

      try {
        const { stream, hadAudio, hadVideo } = await acquireUserMedia(mediaMode);
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsMicMuted(!hadAudio);
        setIsCameraOff(!hadVideo);
        setPhase('calling');

        const callId = generateSafeId('call');
        const pc = setupPeerConnection(stream, consultation.id, callId, true);

        const offer = await pc.createOffer();
        const callerName = (
          currentUser.displayName?.trim() ||
          (userRole === 'doctor' ? DOCTOR_DEFAULT_NAME : 'Pasien')
        ).slice(0, 100);

        // Create the signaling document BEFORE setLocalDescription triggers onicecandidate
        await setDoc(doc(db, 'consultations', consultation.id, 'calls', callId), {
          id: callId,
          callerId: currentUser.uid,
          callerName,
          callerRole: userRole,
          status: 'ringing',
          offerSdp: (offer.sdp || '').slice(0, 32000),
          answerSdp: '',
          mediaMode,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await pc.setLocalDescription(offer);

        const consultationUpdate: Record<string, unknown> = {
          activeCallId: callId,
          mode: 'video',
          updatedAt: serverTimestamp(),
        };
        if (userRole === 'doctor' && consultation.status === 'waiting') {
          consultationUpdate.status = 'active';
        }
        await updateDoc(doc(db, 'consultations', consultation.id), consultationUpdate);

        await sendConsultationMessage(
          consultation.id,
          currentUser,
          userRole,
          mediaMode === 'video' ? 'Memulai panggilan video...' : 'Memulai panggilan suara...',
          'call_event'
        );
      } catch (err) {
        cleanupPeerResources();
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Izin kamera/mikrofon ditolak. Aktifkan izin di bilah alamat browser lalu coba lagi.'
            : err instanceof Error
              ? err.message
              : 'Gagal memulai panggilan video.';
        setCallError(msg);
      }
    },
    [consultation, currentUser, userRole, acquireUserMedia, setupPeerConnection, cleanupPeerResources]
  );

  const answerCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!consultation || !currentUser || !call || call.status !== 'ringing') return;

    setCallError(null);
    setCallNotice(null);
    setPhase('connecting');

    try {
      const { stream, hadAudio, hadVideo } = await acquireUserMedia(call.mediaMode);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMicMuted(!hadAudio);
      setIsCameraOff(!hadVideo);

      const pc = setupPeerConnection(stream, consultation.id, call.id, false);
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: call.offerSdp })
      );

      for (const candidate of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIceRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const callPath = `consultations/${consultation.id}/calls/${call.id}`;
      try {
        await updateDoc(doc(db, 'consultations', consultation.id, 'calls', call.id), {
          answerSdp: (answer.sdp || '').slice(0, 32000),
          status: 'connected',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, callPath);
      }

      setPhase('connected');
    } catch (err) {
      cleanupPeerResources();
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Izin kamera/mikrofon ditolak. Izinkan akses perangkat untuk menjawab panggilan.'
          : err instanceof Error
            ? err.message
            : 'Gagal menjawab panggilan.';
      setCallError(msg);
    }
  }, [consultation, currentUser, acquireUserMedia, setupPeerConnection, cleanupPeerResources]);

  const declineCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!consultation || !currentUser || !call) return;

    try {
      if (call.status === 'ringing' || call.status === 'connected') {
        await updateDoc(doc(db, 'consultations', consultation.id, 'calls', call.id), {
          status: 'declined',
          updatedAt: serverTimestamp(),
        });
      }
      if (consultation.activeCallId === call.id) {
        await updateDoc(doc(db, 'consultations', consultation.id), {
          activeCallId: '',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `consultations/${consultation.id}/calls/${call.id}`);
    } finally {
      cleanupPeerResources();
    }
  }, [consultation, currentUser, cleanupPeerResources]);

  const endCall = useCallback(async () => {
    const call = activeCallRef.current;
    cleanupPeerResources();

    if (!consultation || !currentUser || !call) return;

    try {
      if (call.status === 'ringing' || call.status === 'connected') {
        await updateDoc(doc(db, 'consultations', consultation.id, 'calls', call.id), {
          status: 'ended',
          updatedAt: serverTimestamp(),
        });
      }
      if (consultation.activeCallId === call.id) {
        await updateDoc(doc(db, 'consultations', consultation.id), {
          activeCallId: '',
          updatedAt: serverTimestamp(),
        });
      }
      await sendConsultationMessage(
        consultation.id,
        currentUser,
        userRole,
        'Panggilan video berakhir.',
        'call_event'
      );
    } catch (err) {
      console.error('Error ending call:', err);
    }
  }, [consultation, currentUser, userRole, cleanupPeerResources]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const nextMuted = !isMicMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMicMuted(nextMuted);
  }, [isMicMuted]);

  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      const nextOff = !isCameraOff;
      videoTracks.forEach((track) => {
        track.enabled = !nextOff;
      });
      setIsCameraOff(nextOff);
    }
  }, [isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return;

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const camTrack = stream.getVideoTracks()[0];
      const videoTransceiver = pc
        .getTransceivers()
        .find((t) => t.receiver.track?.kind === 'video');
      if (videoTransceiver?.sender) {
        await videoTransceiver.sender.replaceTrack(camTrack || null);
      }
      setLocalStream(stream);
      setIsScreenSharing(false);
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = displayStream;
      const videoTransceiver = pc
        .getTransceivers()
        .find((t) => t.receiver.track?.kind === 'video');
      if (videoTransceiver?.sender) {
        if (videoTransceiver.direction === 'recvonly') {
          videoTransceiver.direction = 'sendrecv';
        }
        await videoTransceiver.sender.replaceTrack(screenTrack);
      }

      const previewStream = new MediaStream([screenTrack, ...stream.getAudioTracks()]);
      setLocalStream(previewStream);
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        const camTrack = stream.getVideoTracks()[0];
        if (videoTransceiver?.sender) {
          void videoTransceiver.sender.replaceTrack(camTrack || null);
        }
        setLocalStream(stream);
        setIsScreenSharing(false);
      };
    } catch {
      // User cancelled screen share prompt
    }
  }, [isScreenSharing]);

  const clearCallFeedback = useCallback(() => {
    setCallError(null);
    setCallNotice(null);
  }, []);

  return {
    phase,
    activeCall,
    localStream,
    remoteStream,
    iceState,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    callDurationSec,
    callError,
    callNotice,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    clearCallFeedback,
  };
}
