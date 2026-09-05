"use client";

import { GraduationCap, XCircle, Loader2, AlertCircle } from "lucide-react";
import { MentorOnerisiPaneli } from "@/features/matching/ui/MentorOnerisiPaneli";
import { kapasiteDurumu, kapasiteEtiketi } from "@/features/mentors/kapasite";

/**
 * Kullanıcı satırındaki "Staj Durumu & Mentör Ataması" hücresi (#489).
 *
 * Panel dosyasından çıkarıldı: 1224 satırlık tek bileşenin içinde bu blok
 * ~120 satırdı ve kendi başına anlaşılabilir bir bütün.
 *
 * ⚠️ MENTÖR ATAMASI M:N (#195). Öğrencinin 0..n mentörü olur; chip'ler
 * kaldırma düğmesi taşır ve ekleme açılır menüden yapılır. Her iki işlem de
 * aynı çağrıyı kullanıyor — TAM LİSTE gönderiliyor, fark değil.
 */

type MentorOzeti = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  /** #404: Açılır listede yük görünsün diye. */
  aktifOgrenci: number;
  kapasite: number | null;
};

type SatirKullanicisi = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";
  studentProfile?: {
    id: string;
    mentors: { id: string; name: string | null; lastName: string | null }[];
  } | null;
};

export function MentorAtamaHucresi({
  user,
  mentors,
  isUpdating,
  gorunenAd,
  onMentorlariAyarla,
}: {
  user: SatirKullanicisi;
  mentors: MentorOzeti[];
  isUpdating: boolean;
  gorunenAd: (u: { name: string | null; lastName: string | null; email?: string }) => string;
  onMentorlariAyarla: (studentId: string, mentorIds: string[]) => void;
}) {
  return (
    <div className="lg:col-span-3 flex items-center">
      {user.role === "STUDENT" ? (
        user.accountStatus === "GRADUATED" ? (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 w-full">
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span className="font-semibold truncate">
              Staj tamamlandı &amp; mezun edildi
            </span>
          </div>
        ) : user.studentProfile ? (
          <div className="flex flex-col gap-2 w-full">
            {/* #195: Atanmış mentorlar — chip + kaldır (x) */}
            {user.studentProfile.mentors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {user.studentProfile.mentors.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {gorunenAd(m)}
                    <button
                      type="button"
                      onClick={() =>
                        onMentorlariAyarla(
                          user.id,
                          user.studentProfile!.mentors
                            .filter((x) => x.id !== m.id)
                            .map((x) => x.id),
                        )
                      }
                      disabled={isUpdating}
                      aria-label={`${gorunenAd(m)} mentörünü kaldır`}
                      className="hover:text-red-600 disabled:opacity-60"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Mentor ekle — yalnız henüz atanmamış mentorları göster */}
            <div className="flex items-center gap-2 w-full">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    onMentorlariAyarla(user.id, [
                      ...user.studentProfile!.mentors.map((x) => x.id),
                      e.target.value,
                    ]);
                  }
                }}
                disabled={isUpdating}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500 disabled:opacity-60"
              >
                <option value="">+ Mentor ekle…</option>
                {mentors
                  .filter(
                    (mentor) =>
                      !user.studentProfile!.mentors.some((x) => x.id === mentor.id),
                  )
                  .map((mentor) => {
                    /*
                     * #404: YÜK AÇILIR LİSTEDE. Admin önceden yalnız
                     * ad ve e-posta görüyor, kimin kaç stajyeri
                     * olduğunu bilmeden atama yapıyordu.
                     *
                     * ⚠️ DOLU/AŞKIN MENTÖR ENGELLENMİYOR — geçici
                     * devir ya da kısa süreli destek meşru olabilir;
                     * son söz admin'in. Sayı, kararı almasına
                     * yardım etsin diye orada.
                     *
                     * `<option>` içinde renk güvenilir değil
                     * (tarayıcılar farklı davranıyor), bu yüzden ayrım
                     * METİNLE yapılıyor.
                     */
                    const durum = kapasiteDurumu(
                      mentor.aktifOgrenci,
                      mentor.kapasite,
                    );
                    const isaret =
                      durum === "askin" ? " — KAPASİTE AŞKIN" : durum === "dolu" ? " — dolu" : "";
                    return (
                      <option key={mentor.id} value={mentor.id}>
                        {gorunenAd(mentor)} —{" "}
                        {kapasiteEtiketi(mentor.aktifOgrenci, mentor.kapasite)}
                        {isaret} ({mentor.email})
                      </option>
                    );
                  })}
              </select>
              {isUpdating && <Loader2 className="animate-spin w-3.5 h-3.5 text-blue-600" />}
            </div>

            {/* #328: AI mentör önerisi. Panel ATAMA YAPMAZ —
                "Ata" düğmesi mevcut atama akışını çağırır. */}
            <MentorOnerisiPaneli
              studentId={user.id}
              ogrenciAdi={gorunenAd(user)}
              atamaSuruyor={isUpdating}
              onAta={(mentorId) =>
                onMentorlariAyarla(user.id, [
                  ...user.studentProfile!.mentors.map((x) => x.id),
                  mentorId,
                ])
              }
            />
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Profil kurulumu bekleniyor
          </span>
        )
      ) : (
        <span className="text-slate-400 text-xs italic">
          —
        </span>
      )}
    </div>
  );
}
