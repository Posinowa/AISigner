// 🧭 Admin paneli — kullanıcı/rol yönetimi, staj yaşam döngüsü, mezuniyet ve güvenli hesap silme
"use client";

import { IstatistikKartlari } from "@/features/admin/ui/IstatistikKartlari";
import { AramaVeKategoriler } from "@/features/admin/ui/AramaVeKategoriler";
import { KullaniciSatiri } from "@/features/admin/ui/KullaniciSatiri";
import { AnalizModali } from "@/features/admin/ui/AnalizModali";
import { MentorBasvuruModal } from "@/features/mentors/ui/MentorBasvuruModal";
import { Sparkles, Users } from "lucide-react";
import { useKullaniciYonetimi } from "@/features/admin/hooks/useKullaniciYonetimi";
import { YuklemeEkrani, HataEkrani } from "@/features/admin/ui/AdminDurumEkranlari";
import { MentorBasvuruUyarisi, AdminBildirimleri } from "@/features/admin/ui/AdminUyarilari";
import { CertificateModal } from "@/components/certificate/CertificateModal";

export default function AdminDashboard() {
  const {
    mentors,
    loading,
    loadError,
    updating,
    search,
    setSearch,
    filterCategory,
    setFilterCategory,
    nextCursor,
    dahaYukleniyor,
    analysisModalUser,
    analysisData,
    analysisLoading,
    analysisError,
    certModalUser,
    setCertModalUser,
    certModalData,
    setCertModalData,
    basvuruMentoru,
    setBasvuruMentoru,
    openAnalysisModal,
    openCertificateModal,
    handleSaveCertificateDetails,
    closeAnalysisModal,
    analysisModalRef,
    loadData,
    dahaYukle,
    handleRoleChange,
    handleSetMentors,
    handleAccountStatus,
    handleDeleteUser,
    filteredUsers,
    stats,
  } = useKullaniciYonetimi();


  if (loading) return <YuklemeEkrani />;
  if (loadError) return <HataEkrani onTekrarDene={loadData} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Sayfa Başlığı */}
        <div className="mb-8 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Yönetici Paneli
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm">
              Staj yaşam döngüsünü yönet, öğrencileri onayla/mezun et ve kullanıcı hesaplarını düzenle
            </p>
          </div>
          <a
            href="/admin-dashboard/assignments"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 transition self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            Öğrenci İlerlemeleri & GitHub Yönetimi
          </a>
        </div>

        <MentorBasvuruUyarisi stats={stats} setFilterCategory={setFilterCategory} />

        {/* İstatistik Kartları — #489: sunum `IstatistikKartlari`'ne taşındı. */}
        <IstatistikKartlari
          sayilar={stats}
          aktifKategori={filterCategory}
          onKategori={setFilterCategory}
        />

        <AdminBildirimleri stats={stats} filterCategory={filterCategory} />

        {/* Arama & Kategori Filtreleri — #489: `AramaVeKategoriler`. */}
        <AramaVeKategoriler
          arama={search}
          onArama={setSearch}
          sayilar={stats}
          aktifKategori={filterCategory}
          onKategori={setFilterCategory}
        />

        {/* Kullanıcı Tablosu / Listesi */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm font-medium">
                {search || filterCategory !== "ALL"
                  ? "Filtreyle eşleşen kullanıcı kaydı bulunamadı."
                  : "Henüz kayıtlı kullanıcı bulunmuyor."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Başlık satırı (Masaüstü) */}
              <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="col-span-4">Kullanıcı Bilgileri</div>
                <div className="col-span-2">Rol & Yetki</div>
                <div className="col-span-3">Staj Durumu / Mentor</div>
                <div className="col-span-3 text-right">Hızlı Eylemler & Silme</div>
              </div>

              {filteredUsers.map((user) => (
                <KullaniciSatiri
                  key={user.id}
                  user={user}
                  mentors={mentors}
                  isUpdating={updating === user.id}
                  onRolDegistir={handleRoleChange}
                  onMentorlariAyarla={handleSetMentors}
                  onHesapDurumu={handleAccountStatus}
                  onSil={handleDeleteUser}
                  onBasvuruGor={(u) => setBasvuruMentoru(u)}
                  onAnalizGor={openAnalysisModal}
                  onSertifika={openCertificateModal}
                />
              ))}

              {/*
                Sayfalama — "daha fazla yükle".
                Sonsuz kaydırma YAPILMADI: tablo satırları eylem düğmeleri
                taşıyor ve admin çoğu zaman ARIYOR, listeyi gezmiyor. Açık
                bir düğme kaç kaydın yüklü olduğunu da görünür kılıyor.
              */}
              {nextCursor && (
                <div className="px-6 py-4 flex items-center justify-center gap-3 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    {filteredUsers.length} kayıt yüklendi
                  </span>
                  <button
                    onClick={dahaYukle}
                    disabled={dahaYukleniyor}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {dahaYukleniyor ? "Yükleniyor…" : "Daha fazla yükle"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin — Detaylı AI Profil Analizi Modal'ı (lazy fetch) */}
      {basvuruMentoru && (
        <MentorBasvuruModal
          mentorId={basvuruMentoru.id}
          mentorAdi={[basvuruMentoru.name, basvuruMentoru.lastName].filter(Boolean).join(" ") || basvuruMentoru.email}
          onClose={() => setBasvuruMentoru(null)}
        />
      )}
      {analysisModalUser && (
        <AnalizModali
          kullanici={analysisModalUser}
          dialogRef={analysisModalRef}
          analysis={analysisData}
          loading={analysisLoading}
          error={analysisError}
          onKapat={closeAnalysisModal}
        />
      )}

      {/* Admin — Sertifika & Referans Notu Modal'ı */}
      {certModalData && certModalUser && (
        <CertificateModal
          certificate={certModalData}
          isOpen={!!certModalUser}
          onClose={() => {
            setCertModalUser(null);
            setCertModalData(null);
          }}
          isAdmin={true}
          onSave={handleSaveCertificateDetails}
        />
      )}
    </div>
  );
}
