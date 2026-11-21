import { Timestamp } from 'firebase/firestore';

export const DOCTOR_EMAIL = 'drsarwo@gmail.com';
export const DOCTOR_DEFAULT_NAME = 'dr. Sarwo';

export type UserRole = 'doctor' | 'patient';
export type ConsultationMode = 'chat' | 'video';
export type ConsultationStatus = 'waiting' | 'active' | 'completed';
export type MessageType = 'text' | 'system' | 'call_event';
export type CallStatus = 'ringing' | 'connected' | 'ended' | 'declined';
export type MediaMode = 'video' | 'audio';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Consultation {
  id: string;
  inviteCode: string;
  doctorEmail: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  mode: ConsultationMode;
  status: ConsultationStatus;
  chiefComplaint: string;
  symptomDuration: string;
  allergies: string;
  vitalsNote: string;
  diagnosisNote: string;
  prescriptionNote: string;
  followUpPlan: string;
  lastMessagePreview: string;
  activeCallId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  type: MessageType;
  text: string;
  createdAt?: Timestamp;
}

export interface WebRtcCall {
  id: string;
  callerId: string;
  callerName: string;
  callerRole: UserRole;
  status: CallStatus;
  offerSdp: string;
  answerSdp: string;
  mediaMode: MediaMode;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PatientIntakeInput {
  patientName: string;
  chiefComplaint: string;
  symptomDuration: string;
  allergies: string;
  vitalsNote: string;
  mode: ConsultationMode;
}
