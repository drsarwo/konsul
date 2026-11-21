import { type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  type ChatMessage,
  type Consultation,
  type ConsultationMode,
  type ConsultationStatus,
  DOCTOR_DEFAULT_NAME,
  DOCTOR_EMAIL,
  type MessageType,
  type PatientIntakeInput,
  type UserProfile,
  type UserRole,
} from '../types/telemedicine';
import { db, handleFirestoreError, OperationType } from './firebase';

function clamp(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `KLS-${suffix}`;
}

export function generateSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function isDoctorEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === DOCTOR_EMAIL;
}

export async function upsertUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const role: UserRole = isDoctorEmail(user.email) ? 'doctor' : 'patient';
  const displayName = clamp(
    user.displayName || (role === 'doctor' ? DOCTOR_DEFAULT_NAME : user.email?.split('@')[0] || 'Pasien'),
    100
  );
  const email = clamp(user.email || '', 150);
  const photoURL = clamp(user.photoURL || '', 500);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const payload = {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      return { uid: user.uid, displayName, email, photoURL, role };
    } else {
      await updateDoc(ref, {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
      const existing = snap.data() as UserProfile;
      return {
        uid: existing.uid,
        displayName,
        email: existing.email,
        photoURL,
        role: existing.role,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createPatientConsultation(
  user: User,
  intake: PatientIntakeInput
): Promise<Consultation> {
  const code = generateRoomCode();
  const path = `consultations/${code}`;
  const ref = doc(db, 'consultations', code);

  const patientName = clamp(intake.patientName || user.displayName || 'Pasien', 100);
  const patientEmail = clamp(user.email || '', 150);
  const chiefComplaint = clamp(intake.chiefComplaint || 'Konsultasi umum', 1000);
  const symptomDuration = clamp(intake.symptomDuration || '-', 100);
  const allergies = clamp(intake.allergies || 'Tidak ada yang diketahui', 300);
  const vitalsNote = clamp(intake.vitalsNote || '-', 200);

  const payload = {
    id: code,
    inviteCode: code,
    doctorEmail: DOCTOR_EMAIL,
    doctorName: DOCTOR_DEFAULT_NAME,
    patientId: user.uid,
    patientName,
    patientEmail,
    mode: intake.mode,
    status: 'waiting' as ConsultationStatus,
    chiefComplaint,
    symptomDuration,
    allergies,
    vitalsNote,
    diagnosisNote: '',
    prescriptionNote: '',
    followUpPlan: '',
    lastMessagePreview: clamp(`Keluhan: ${chiefComplaint}`, 200),
    activeCallId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
    const msgId = generateSafeId('msg');
    await setDoc(doc(db, 'consultations', code, 'messages', msgId), {
      id: msgId,
      senderId: user.uid,
      senderName: patientName,
      senderRole: 'patient',
      type: 'system',
      text: clamp(
        `Ruang konsultasi dibuka (${intake.mode === 'video' ? 'Video Call & Chat' : 'Web Chat'}). Keluhan utama: ${chiefComplaint}`,
        2000
      ),
      createdAt: serverTimestamp(),
    });
    return {
      ...payload,
      createdAt: undefined,
      updatedAt: undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createDoctorInviteRoom(
  doctorUser: User,
  mode: ConsultationMode,
  expectedPatientName?: string
): Promise<Consultation> {
  const code = generateRoomCode();
  const path = `consultations/${code}`;
  const ref = doc(db, 'consultations', code);
  const doctorName = clamp(doctorUser.displayName || DOCTOR_DEFAULT_NAME, 100);
  const patientName = clamp(expectedPatientName || 'Menunggu Pasien Bergabung', 100);

  const payload = {
    id: code,
    inviteCode: code,
    doctorEmail: DOCTOR_EMAIL,
    doctorName,
    patientId: '',
    patientName,
    patientEmail: '',
    mode,
    status: 'waiting' as ConsultationStatus,
    chiefComplaint: '',
    symptomDuration: '',
    allergies: '',
    vitalsNote: '',
    diagnosisNote: '',
    prescriptionNote: '',
    followUpPlan: '',
    lastMessagePreview: 'Undangan ruang konsultasi dibuat oleh dokter',
    activeCallId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
    const msgId = generateSafeId('msg');
    await setDoc(doc(db, 'consultations', code, 'messages', msgId), {
      id: msgId,
      senderId: doctorUser.uid,
      senderName: doctorName,
      senderRole: 'doctor',
      type: 'system',
      text: `Ruang konsultasi ${code} siap. Bagikan kode atau tautan ini kepada pasien untuk memulai.`,
      createdAt: serverTimestamp(),
    });
    return {
      ...payload,
      createdAt: undefined,
      updatedAt: undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinConsultationByCode(
  rawCode: string,
  user: User,
  intake?: Partial<PatientIntakeInput>
): Promise<{ consultation: Consultation | null; error?: string }> {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!code || code.length < 4) {
    return { consultation: null, error: 'Kode ruang konsultasi tidak valid.' };
  }

  const path = `consultations/${code}`;
  const ref = doc(db, 'consultations', code);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { consultation: null, error: `Ruang konsultasi "${code}" tidak ditemukan.` };
    }
    const existing = snap.data() as Consultation;

    if (isDoctorEmail(user.email)) {
      return { consultation: existing };
    }

    if (existing.patientId && existing.patientId !== user.uid) {
      return {
        consultation: null,
        error: 'Ruang konsultasi ini sudah terhubung dengan akun pasien lain.',
      };
    }

    if (!existing.patientId) {
      if (existing.status === 'completed') {
        return { consultation: null, error: 'Sesi konsultasi ini telah selesai.' };
      }
      const patientName = clamp(intake?.patientName || user.displayName || 'Pasien', 100);
      const chiefComplaint = clamp(intake?.chiefComplaint || 'Bergabung melalui tautan undangan dokter', 1000);
      const symptomDuration = clamp(intake?.symptomDuration || '-', 100);
      const allergies = clamp(intake?.allergies || '-', 300);
      const vitalsNote = clamp(intake?.vitalsNote || '-', 200);
      const mode: ConsultationMode = intake?.mode || existing.mode || 'video';

      await updateDoc(ref, {
        patientId: user.uid,
        patientName,
        patientEmail: clamp(user.email || '', 150),
        chiefComplaint,
        symptomDuration,
        allergies,
        vitalsNote,
        mode,
        status: 'active',
        updatedAt: serverTimestamp(),
      });

      const msgId = generateSafeId('msg');
      await setDoc(doc(db, 'consultations', code, 'messages', msgId), {
        id: msgId,
        senderId: user.uid,
        senderName: patientName,
        senderRole: 'patient',
        type: 'system',
        text: `${patientName} telah bergabung ke ruang konsultasi.`,
        createdAt: serverTimestamp(),
      });

      return {
        consultation: {
          ...existing,
          patientId: user.uid,
          patientName,
          patientEmail: user.email || '',
          chiefComplaint,
          symptomDuration,
          allergies,
          vitalsNote,
          mode,
          status: 'active',
        },
      };
    }

    return { consultation: existing };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeDoctorConsultations(
  onData: (consultations: Consultation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'consultations';
  const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as Consultation);
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePatientConsultations(
  patientId: string,
  onData: (consultations: Consultation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'consultations';
  const q = query(collection(db, path), where('patientId', '==', patientId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as Consultation);
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeConsultation(
  consultationId: string,
  onData: (consultation: Consultation | null) => void
): Unsubscribe {
  const path = `consultations/${consultationId}`;
  return onSnapshot(
    doc(db, 'consultations', consultationId),
    (snapshot) => {
      onData(snapshot.exists() ? (snapshot.data() as Consultation) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeMessages(
  consultationId: string,
  onData: (messages: ChatMessage[]) => void
): Unsubscribe {
  const path = `consultations/${consultationId}/messages`;
  const q = query(collection(db, 'consultations', consultationId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const msgs = snapshot.docs.map((d) => d.data() as ChatMessage);
      onData(msgs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function sendConsultationMessage(
  consultationId: string,
  user: User,
  senderRole: UserRole,
  text: string,
  type: MessageType = 'text'
): Promise<void> {
  const cleanText = clamp(text, 2000);
  if (!cleanText) return;
  const msgId = generateSafeId('msg');
  const msgPath = `consultations/${consultationId}/messages/${msgId}`;
  const senderName = clamp(
    user.displayName || (senderRole === 'doctor' ? DOCTOR_DEFAULT_NAME : 'Pasien'),
    100
  );

  try {
    await setDoc(doc(db, 'consultations', consultationId, 'messages', msgId), {
      id: msgId,
      senderId: user.uid,
      senderName,
      senderRole,
      type,
      text: cleanText,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'consultations', consultationId), {
      lastMessagePreview: clamp(cleanText, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }
}

export async function updateDoctorClinicalNotes(
  consultationId: string,
  notes: {
    diagnosisNote: string;
    prescriptionNote: string;
    followUpPlan: string;
    status?: ConsultationStatus;
  }
): Promise<void> {
  const path = `consultations/${consultationId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      diagnosisNote: clamp(notes.diagnosisNote, 2000),
      prescriptionNote: clamp(notes.prescriptionNote, 2000),
      followUpPlan: clamp(notes.followUpPlan, 1000),
      updatedAt: serverTimestamp(),
    };
    if (notes.status) {
      updatePayload.status = notes.status;
    }
    await updateDoc(doc(db, 'consultations', consultationId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateConsultationStatus(
  consultationId: string,
  status: ConsultationStatus
): Promise<void> {
  const path = `consultations/${consultationId}`;
  try {
    await updateDoc(doc(db, 'consultations', consultationId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateConsultationMode(
  consultationId: string,
  mode: ConsultationMode
): Promise<void> {
  const path = `consultations/${consultationId}`;
  try {
    await updateDoc(doc(db, 'consultations', consultationId), {
      mode,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
