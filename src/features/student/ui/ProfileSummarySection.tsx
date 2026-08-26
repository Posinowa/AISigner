import { Suspense } from "react";
import { getProfileSummary } from "@/features/student/server/profileSummary";
import { ProfileSummaryCard } from "@/features/student/ui/ProfileSummaryCard";

/**
 * #282: AI profil analizi kartı — AKIŞ sınırı içinde.
 *
 * Önceden sayfa bu veriyi render etmeden önce bekliyordu; önbellek boşken
 * ölçülen süre 10,4 saniyeydi ve bu süre boyunca sayfanın AI ile ilgisi
 * olmayan kısımları da görünmüyordu.
 *
 * Artık sayfa hemen render ediliyor, kart hazır olunca akıyor. Sunucu
 * tarafındaki iş aynı; değişen şey kullanıcının beklediği şeyin ne olduğu.
 */

type Girdi = {
  experienceLevel: string;
  interests: string[];
  goals: string;
  availability?: string;
  userId: string;
};

async function OzetKarti({ girdi }: { girdi: Girdi }) {
  const ozet = await getProfileSummary(girdi);

  return (
    <ProfileSummaryCard
      level={ozet.level}
      tracks={ozet.tracks}
      summary={ozet.summary}
      recommendations={ozet.recommendations}
    />
  );
}

/** Kart yüklenirken yerini tutan iskelet. */
function Iskelet() {
  return (
    <div
      role="status"
      aria-label="AI profil analizi hazırlanıyor"
      className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-md"
    >
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-primary/20" />
        <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="mt-5 space-y-3 rounded-lg bg-white p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Profil analizin hazırlanıyor; sayfanın kalanını şimdiden kullanabilirsin.
      </p>
    </div>
  );
}

export function ProfileSummarySection({ girdi }: { girdi: Girdi }) {
  return (
    <Suspense fallback={<Iskelet />}>
      <OzetKarti girdi={girdi} />
    </Suspense>
  );
}
