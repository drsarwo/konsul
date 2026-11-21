import { ArrowRight, FileText, Lock, MessageSquare, ShieldCheck, Video } from 'lucide-react';
import { useState } from 'react';
import clinicHeroImg from '../assets/images/hero_dr_sarwo_clinic_1794717950554.jpg';

interface LandingAuthViewProps {
  pendingRoomCode: string | null;
  authError: string | null;
  isSigningIn: boolean;
  onSignIn: () => Promise<void>;
}

export function LandingAuthView({
  pendingRoomCode,
  authError,
  isSigningIn,
  onSignIn,
}: LandingAuthViewProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="/"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Klinik Sarwo
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#layanan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Layanan
            </a>
            <a
              href="#alur"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Cara Kerja
            </a>
            <a
              href="#dokter"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Profil Dokter
            </a>
            <a
              href="#privasi"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Privasi
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => void onSignIn()}
              disabled={isSigningIn}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              {isSigningIn ? 'Menghubungkan...' : 'Masuk dengan Google'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          {pendingRoomCode && (
            <div className="mb-8 p-4 bg-white border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-teal-800">
                  Undangan Ruang Konsultasi Terdeteksi
                </p>
                <p className="text-sm text-slate-700 mt-0.5">
                  Anda diundang bergabung ke ruang{' '}
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {pendingRoomCode}
                  </span>
                  . Silakan masuk dengan akun Google untuk terhubung bersama dr. Sarwo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onSignIn()}
                disabled={isSigningIn}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Masuk &amp; Gabung Ruang
              </button>
            </div>
          )}

          {authError && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              {authError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium text-teal-800 tracking-normal mb-3">
                Telemedisin Privat · Web Chat &amp; Video Call
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                Konsultasi medis langsung dari browser, tanpa instalasi.
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                Terhubung langsung dengan dr. Sarwo melalui percakapan teks real-time atau panggilan
                video tatap muka WebRTC. Riwayat keluhan dan ringkasan anjuran tersimpan rapi di
                ruang konsultasi Anda.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <span>{isSigningIn ? 'Memproses...' : 'Mulai Konsultasi'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#alur"
                  className="px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                >
                  Lihat alur sesi
                </a>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span>Enkripsi Peer-to-Peer WebRTC</span>
                <span aria-hidden="true">·</span>
                <span>Akses via Desktop &amp; Ponsel</span>
                <span aria-hidden="true">·</span>
                <span>Ringkasan Konsultasi Siap Cetak</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] lg:min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                {!heroImgFailed ? (
                  <img
                    src={clinicHeroImg}
                    alt="Suasana ruang konsultasi Klinik Sarwo dengan cahaya alami"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-100 to-teal-50 text-slate-600">
                    <Video className="w-10 h-10 text-teal-700 mb-3" />
                    <p className="font-display font-semibold text-slate-900">
                      Ruang Konsultasi Daring
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Klinik Sarwo</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section id="layanan" className="border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-14">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl font-bold text-slate-900 [text-wrap:balance]">
                Satu ruang terpadu untuk chat dan tatap muka video
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Pasien dapat memilih konsultasi tertulis terlebih dahulu atau langsung beralih ke
                panggilan video dalam sesi yang sama.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50">
                <MessageSquare className="w-5 h-5 text-teal-700 mb-4" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Web Chat Real-Time
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Kirim keluhan, riwayat alergi, serta diskusi dosis dan anjuran secara instan tanpa
                  jeda muat ulang halaman.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50">
                <Video className="w-5 h-5 text-teal-700 mb-4" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Video Call Berbasis Web
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Panggilan audio dan video langsung lewat browser menggunakan WebRTC, lengkap
                  dengan kontrol mikrofon, kamera, dan berbagi layar untuk hasil lab.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50">
                <FileText className="w-5 h-5 text-teal-700 mb-4" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Ringkasan Medis Terstruktur
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Setiap evaluasi, terapi anjuran, dan rencana kontrol dicatat oleh dokter dan
                  dapat dicetak pasien setelah sesi selesai.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works + Doctor Profile */}
        <section id="alur" className="border-t border-slate-200 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-7 space-y-6">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Alur Konsultasi Pasien &amp; Dokter
              </h2>
              <div className="divide-y divide-slate-200 border-t border-b border-slate-200 bg-white rounded-xl px-6">
                <div className="py-5 flex gap-4">
                  <span className="font-mono-tabular text-sm font-semibold text-teal-700 shrink-0">
                    01.
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      Masuk &amp; Isi Keluhan Singkat
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Pasien masuk menggunakan akun Google, lalu membuat ruang baru atau memasukkan
                      kode undangan dari dr. Sarwo.
                    </p>
                  </div>
                </div>
                <div className="py-5 flex gap-4">
                  <span className="font-mono-tabular text-sm font-semibold text-teal-700 shrink-0">
                    02.
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      Mulai Web Chat atau Video Call
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Dokter menerima antrean secara langsung, membalas chat, atau menekan tombol
                      Video Call untuk terhubung tatap muka.
                    </p>
                  </div>
                </div>
                <div className="py-5 flex gap-4">
                  <span className="font-mono-tabular text-sm font-semibold text-teal-700 shrink-0">
                    03.
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      Terima Catatan &amp; Rencana Tindak Lanjut
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Setelah pemeriksaan selesai, pasien memperoleh ringkasan evaluasi dan anjuran
                      yang tersimpan di riwayat akunnya.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div id="dokter" className="lg:col-span-5">
              <div className="p-6 bg-white border border-slate-200 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                    {!avatarImgFailed ? (
                      <img
                        src="/assets/aistudio/WhatsApp_Image_2026-11-15_at_11.34.42_c450ee95.jpeg"
                        alt="dr. Sarwo"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarImgFailed(true)}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-teal-700 text-white font-display font-bold text-lg">
                        DS
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">dr. Sarwo</h3>
                    <p className="text-sm text-slate-600">Konsultasi Medis Umum &amp; Telemedisin</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Web Chat · Video Call WebRTC · Tindak Lanjut Klinis
                    </p>
                  </div>
                </div>

                <div id="privasi" className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Lock className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                    <span>
                      Akses ruang konsultasi dibatasi hanya untuk dokter penanggung jawab dan akun
                      pasien pemilik sesi.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-sm text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                    <span>
                      Aliran audio dan video dikirim langsung antar-browser menggunakan protokol
                      WebRTC terenkripsi (DTLS/SRTP).
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>Klinik Sarwo — Layanan Konsultasi Medis Daring</span>
          <span>Untuk keadaan gawat darurat medis, segera hubungi IGD terdekat atau 112/119.</span>
        </div>
      </footer>
    </div>
  );
}
