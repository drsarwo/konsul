# Security Specification: Klinik Sarwo Telemedicine

## 1. Data Invariants
1. **Identity & Role Integrity**: Only verified `drsarwo@gmail.com` (`request.auth.token.email_verified == true`) holds the `doctor` role. Patients cannot self-assign `role: 'doctor'`.
2. **PII Isolation**: User profile documents (`/users/{userId}`) containing `email` are strictly readable only by the owner (`userId == request.auth.uid`) or the verified doctor. `list` queries on `/users` are completely disabled.
3. **Consultation Ownership & Claiming**:
   - A patient can only create a consultation for themselves (`patientId == request.auth.uid`) with `status == 'waiting'` and empty clinical notes (`diagnosisNote == ''`, `prescriptionNote == ''`, `followUpPlan == ''`).
   - Only the doctor can write `diagnosisNote`, `prescriptionNote`, `followUpPlan`, or transition `status` to `completed`.
   - When the doctor pre-creates an invite room (`patientId == ''`), a verified patient may claim it once (`existing().patientId == '' && incoming().patientId == request.auth.uid`). Once claimed, `patientId` is immutable.
4. **Master Gate for Subcollections**: Every message, WebRTC call, and ICE candidate under `/consultations/{consultationId}` verifies membership against the parent consultation document via `get()`.
5. **Terminal State Locking**: Completed consultations (`status == 'completed'`) cannot be mutated by patients; only the doctor can amend notes if needed.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Doctor Spoof**: `{ role: 'doctor', email: 'drsarwo@gmail.com' }` with `email_verified: false` -> `PERMISSION_DENIED`.
2. **Patient Self-Promotion**: Authenticated patient creates `/users/{uid}` with `role: 'doctor'` -> `PERMISSION_DENIED`.
3. **Cross-Patient Consultation Read**: Patient A attempts `get` or `list` on Patient B's `/consultations/{id}` -> `PERMISSION_DENIED`.
4. **Patient Writing Prescription**: Patient creates or updates consultation with `diagnosisNote: 'Take antibiotics'` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection**: Update payload includes extra field `{ isVerified: true, status: 'active' }` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Document ID with >128 chars or invalid symbols (`../admin`) -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Create consultation with client-supplied past/future `createdAt` -> `PERMISSION_DENIED`.
8. **Message Sender Spoofing**: Patient sends message with `senderId: 'otherUid'` or `senderRole: 'doctor'` -> `PERMISSION_DENIED`.
9. **Unauthorized Room Eavesdropping**: Non-participant reads `/consultations/{id}/messages` -> `PERMISSION_DENIED`.
10. **Completed Consultation Tampering**: Patient updates `chiefComplaint` or sends message after `status == 'completed'` -> `PERMISSION_DENIED`.
11. **1MB String Exhaustion**: Message `text` > 2000 chars or `offerSdp` > 20000 chars -> `PERMISSION_DENIED`.
12. **Blanket User List Scraping**: Authenticated user queries `list /users` -> `PERMISSION_DENIED`.
