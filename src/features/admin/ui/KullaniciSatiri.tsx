"use client";

import {
  Award,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/features/profile/ui/Avatar";
import { DogrulanmisRozet } from "@/features/auth/ui/DogrulanmisRozet";
import { MentorAtamaHucresi } from "@/features/admin/ui/MentorAtamaHucresi";
import {
  getDisplayName,
  getInitials,
  statusConfig,
  type Mentor,
  type User,
} from "@/features/admin/ui/kullanici-sabitleri";

export type KullaniciSatiriProps = {
  user: User;
  mentors: Mentor[];
  isUpdating: boolean;
  onRolDegistir: (user: User, newRole: User["role"]) => void;
  onMentorlariAyarla: (studentId: string, mentorIds: string[]) => void;
  onHesapDurumu: (
    user: User,
    accountStatus: User["accountStatus"],
    customConfirmText?: string,
  ) => void;
  onSil: (user: User) => void;
  onBasvuruGor: (user: User) => void;
  onAnalizGor: (user: User) => void;
  onSertifika: (user: User) => void;
};

/**
 * Admin listesinde tek kullanıcı satırı. Veri ve eylemler ebeveynden gelir;
 * satır yalnız sunumdan ve satıra özgü eylem düğmelerinden sorumludur.
 */
export function KullaniciSatiri({
  user,
  mentors,
  isUpdating,
  onRolDegistir,
  onMentorlariAyarla,
  onHesapDurumu,
  onSil,
  onBasvuruGor,
  onAnalizGor,
  onSertifika,
}: KullaniciSatiriProps) {
  const status = statusConfig[user.accountStatus];
  const StatusIcon = status.icon;

  return (
        <div
          key={user.id}
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 py-4.5 hover:bg-slate-50/80 items-center transition-colors"
        >
          {/* Kullanıcı Künyesi */}
          <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
            {/* #265: Fotoğraf varsa gösterilir; yoksa eskisi gibi
                baş harfler. Renkler rol/durum bilgisini taşıdığı için
                fallback'te korunuyor. */}
            <Avatar
              userId={user.id}
              basHarfler={getInitials(user)}
              fotografVar={Boolean(user.avatarFile)}
              ad={getDisplayName(user)}
              arkaPlanSinifi={
                user.accountStatus === "GRADUATED"
                  ? "bg-gradient-to-br from-primary to-[#3e92cc] ring-2 ring-primary/20"
                  : user.role === "ADMIN"
                    ? "bg-gradient-to-br from-indigo-500 to-indigo-700"
                    : user.role === "MENTOR"
                      ? "bg-gradient-to-br from-blue-500 to-cyan-600"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600"
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {getDisplayName(user)}
                </p>
                {user.accountStatus === "GRADUATED" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Award className="w-3 h-3" /> Mezun
                  </span>
                )}
                {/* #259: Doğrulama durumu künyede; admin listeye
                    bakarken hangi hesapların doğrulandığını görsün. */}
                <DogrulanmisRozet
                  emailVerified={user.emailVerified}
                  boyut="kucuk"
                />
              </div>
              <p className="text-xs text-slate-500 truncate">
                {user.email}
              </p>
              {/* #287: Mentörün başvuru cevapları — onay kararı
                  artık ad-soyada bakılarak verilmiyor. */}
              {user.role === "MENTOR" && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <button
                    onClick={() => onBasvuruGor(user)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <FileText className="w-3 h-3" /> Başvuruyu Gör
                  </button>
                </div>
              )}

              {user.role === "STUDENT" && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${status.color}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                  {user.studentProfile && (
                    <button
                      onClick={() => onAnalizGor(user)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Analizi Gör
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rol Seçici (Onay Korumalı) */}
          <div className="lg:col-span-2 flex items-center gap-2">
            <select
              value={user.role}
              onChange={(e) =>
                onRolDegistir(user, e.target.value as User["role"])
              }
              disabled={isUpdating}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500 disabled:opacity-50 transition"
            >
              <option value="ADMIN">👑 Yönetici</option>
              <option value="MENTOR">🧑‍🏫 Mentor</option>
              <option value="STUDENT">🎓 Öğrenci</option>
            </select>
          </div>

          {/* Staj Durumu & Mentor Ataması — #489: `MentorAtamaHucresi`. */}
          <MentorAtamaHucresi
            user={user}
            mentors={mentors}
            isUpdating={isUpdating}
            gorunenAd={getDisplayName}
            onMentorlariAyarla={onMentorlariAyarla}
          />

          {/* Hızlı Aksiyonlar & Güvenli Silme Butonu */}
          <div className="lg:col-span-3 flex items-center justify-start lg:justify-end gap-2 flex-wrap">
            {isUpdating ? (
              <Loader2 className="animate-spin w-4 h-4 text-blue-600 my-1" />
            ) : (
              <>
                {/* #250: Mentör başvurusu. Onay butonları önceden
                    yalnızca STUDENT satırlarında vardı; admin
                    başvuruyu görebiliyor ama onaylayamıyordu.
                    "Mezun Et" mentöre uygulanmaz.
                    Reddet yalnızca bekleyen başvuruda: aktif bir
                    mentörün yetkisini almak atanmış öğrencileri
                    etkiler, o ayrı bir iş. */}
                {user.role === "MENTOR" &&
                  (user.accountStatus === "PENDING" ||
                    user.accountStatus === "REJECTED") && (
                    <>
                      <button
                        onClick={() =>
                          onHesapDurumu(
                            user,
                            "APPROVED",
                            `${getDisplayName(user)} adlı kişinin mentör başvurusunu onaylamak istediğinize emin misiniz?

Onaylandığında mentör paneline erişebilecek.`,
                          )
                        }
                        title="Mentör Başvurusunu Onayla"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Onayla
                      </button>

                      {user.accountStatus === "PENDING" && (
                        <button
                          onClick={() =>
                            onHesapDurumu(
                              user,
                              "REJECTED",
                              `${getDisplayName(user)} adlı kişinin mentör başvurusunu reddetmek istediğinize emin misiniz?`,
                            )
                          }
                          title="Mentör Başvurusunu Reddet"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-red-300 hover:text-red-600 text-slate-600 text-xs font-semibold shadow-sm transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reddet
                        </button>
                      )}
                    </>
                  )}

                {user.role === "STUDENT" && (
                  <>
                    {/* Onay Bekleyen veya Reddedilen → Onayla */}
                    {(user.accountStatus === "PENDING" ||
                      user.accountStatus === "REJECTED") && (
                      <button
                        onClick={() =>
                          onHesapDurumu(
                            user,
                            "APPROVED",
                            `${getDisplayName(user)} adlı öğrencinin hesabını onaylamak ve aktifleştirmek istediğinize emin misiniz?`,
                          )
                        }
                        title="Stajyeri Onayla"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Onayla
                      </button>
                    )}

                    {/* Aktif Stajyer → Mezun Et */}
                    {user.accountStatus === "APPROVED" && (
                      <button
                        onClick={() =>
                          onHesapDurumu(
                            user,
                            "GRADUATED",
                            `🎓 ${getDisplayName(user)} adlı öğrencinin staj sürecini başarıyla tamamlayıp "Mezun" durumuna geçirmek istediğinize emin misiniz?\n\nÖğrenci hesabına tekrar girdiğinde tebrik ve başarı mesajı ile karşılanacaktır.`,
                          )
                        }
                        title="Stajı Bitir & Mezun Et"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary hover:bg-[#1b2a55] text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5" /> Mezun Et
                      </button>
                    )}

                    {/* Onay Bekleyen veya Aktif → Reddet */}
                    {(user.accountStatus === "PENDING" ||
                      user.accountStatus === "APPROVED") && (
                      <button
                        onClick={() =>
                          onHesapDurumu(
                            user,
                            "REJECTED",
                            `${getDisplayName(user)} adlı öğrencinin başvurusunu/stajyerlik durumunu reddetmek istediğinize emin misiniz?`,
                          )
                        }
                        title="Başvuruyu Reddet"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reddet
                      </button>
                    )}

                    {/* Mezun veya Reddedilen → Tekrar Aktifleştir */}
                    {(user.accountStatus === "GRADUATED" ||
                      user.accountStatus === "REJECTED") && (
                      <button
                        onClick={() =>
                          onHesapDurumu(
                            user,
                            "APPROVED",
                            `${getDisplayName(user)} adlı öğrencinin staj hesabını yeniden "Aktif Stajyer" durumuna getirmek istediğinize emin misiniz?`,
                          )
                        }
                        title="Yeniden Aktifleştir"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Aktifleştir
                      </button>
                    )}

                    {/* Sertifika ve Mentör Referans Notu Yönetimi */}
                    {user.studentProfile && (
                      <button
                        onClick={() => onSertifika(user)}
                        title="Sertifika & Mentör Notu Yönetimi"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
                      >
                        <Award className="w-3.5 h-3.5" /> Sertifika & Not
                      </button>
                    )}
                  </>
                )}

                {/* Kalıcı Hesap Silme Butonu (Tüm roller için - admin kendini silemez) */}
                <button
                  onClick={() => onSil(user)}
                  title="Hesabı Kalıcı Olarak Sil"
                  className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
  );
}
