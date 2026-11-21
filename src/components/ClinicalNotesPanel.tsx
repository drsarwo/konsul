import { CheckCircle2, Printer, Save } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { type Consultation, type UserRole } from '../types/telemedicine';

interface ClinicalNotesPanelProps {
  consultation: Consultation;
  userRole: UserRole;
  onSaveNotes: (notes: {
    diagnosisNote: string;
    prescriptionNote: string;
    followUpPlan: string;
    completeSession?: boolean;
  }) => Promise<void>;
}

export function ClinicalNotesPanel({
  consultation,
  userRole,
  onSaveNotes,
}: ClinicalNotesPanelProps) {
  const [diagnosisNote, setDiagnosisNote] = useState(consultation.diagnosisNote);
  const [prescriptionNote, setPrescriptionNote] = useState(consultation.prescriptionNote);
  const [followUpPlan, setFollowUpPlan] = useState(consultation.followUpPlan);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setDiagnosisNote(consultation.diagnosisNote);
    setPrescriptionNote(consultation.prescriptionNote);
    setFollowUpPlan(consultation.followUpPlan);
  }, [
    consultation.id,
    consultation.diagnosisNote,
    consultation.prescriptionNote,
    consultation.followUpPlan,
  ]);

  const handleSave = async (e: FormEvent, completeSession = false) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedNotice(false);
    try {
      await onSaveNotes({
        diagnosisNote,
        prescriptionNote,
        followUpPlan,
        completeSession,
      });
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
      {/* Patient Intake Section */}
      <div>
        <h3 className="font-display text-sm font-semibold text-slate-900">
          Informasi Keluhan Pasien
        </h3>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Nama Pasien</dt>
            <dd className="font-medium text-slate-900">
              {consultation.patientName || 'Menunggu pasien bergabung'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Keluhan Utama</dt>
            <dd className="text-slate-800 whitespace-pre-wrap">
              {consultation.chiefComplaint || '-'}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <dt className="text-xs text-slate-500">Durasi Gejala</dt>
              <dd className="text-slate-800">{consultation.symptomDuration || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Tanda Vital</dt>
              <dd className="font-mono-tabular text-slate-800">
                {consultation.vitalsNote || '-'}
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Riwayat Alergi</dt>
            <dd className="text-slate-800">{consultation.allergies || '-'}</dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Catatan Medis &amp; Anjuran Dokter
          </h3>
          {userRole === 'patient' &&
            (consultation.diagnosisNote ||
              consultation.prescriptionNote ||
              consultation.followUpPlan) && (
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-900 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak</span>
              </button>
            )}
        </div>

        {userRole === 'doctor' ? (
          <form onSubmit={(e) => void handleSave(e, false)} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Evaluasi / Diagnosis Awal
              </label>
              <textarea
                rows={3}
                maxLength={2000}
                value={diagnosisNote}
                onChange={(e) => setDiagnosisNote(e.target.value)}
                placeholder="Ringkasan anamnesis dan evaluasi klinis..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Anjuran Terapi / Resep
              </label>
              <textarea
                rows={3}
                maxLength={2000}
                value={prescriptionNote}
                onChange={(e) => setPrescriptionNote(e.target.value)}
                placeholder="Nama obat, dosis, frekuensi, atau terapi non-farmakologis..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rencana Tindak Lanjut &amp; Tanda Bahaya
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={followUpPlan}
                onChange={(e) => setFollowUpPlan(e.target.value)}
                placeholder="Kontrol ulang dalam 3 hari atau segera ke IGD jika..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
            </div>

            {savedNotice && (
              <p className="text-xs font-medium text-emerald-700">
                Catatan klinis berhasil disimpan dan terlihat oleh pasien.
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Catatan'}</span>
              </button>

              {consultation.status !== 'completed' && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={(e) => void handleSave(e, true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan &amp; Selesaikan Sesi</span>
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            {!consultation.diagnosisNote &&
            !consultation.prescriptionNote &&
            !consultation.followUpPlan ? (
              <p className="text-xs text-slate-500">
                Catatan evaluasi dan anjuran dari dr. Sarwo akan tampil di sini setelah dokter
                menyimpannya.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-xs text-slate-500">Evaluasi Dokter</p>
                  <p className="text-slate-900 whitespace-pre-wrap mt-0.5">
                    {consultation.diagnosisNote || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Anjuran Terapi / Resep</p>
                  <p className="text-slate-900 whitespace-pre-wrap mt-0.5">
                    {consultation.prescriptionNote || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rencana Tindak Lanjut</p>
                  <p className="text-slate-900 whitespace-pre-wrap mt-0.5">
                    {consultation.followUpPlan || '-'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
