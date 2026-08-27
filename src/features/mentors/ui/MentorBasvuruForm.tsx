"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { saveMentorBasvuru } from "@/features/mentors/server/basvuru";
import { mentorBasvuruSchema, type MentorBasvuru } from "@/features/mentors/models/basvuru";
import {
  MENTOR_KIDEMLERI,
  MENTOR_UZMANLIKLARI,
  MENTOR_KAPASITE_EN_AZ,
  MENTOR_KAPASITE_EN_COK,
  MENTOR_DENEYIM_EN_AZ,
  MENTOR_DENEYIM_EN_COK,
  HAFTALIK_SAAT_EN_AZ,
  HAFTALIK_SAAT_EN_COK,
} from "@/features/student/models/secenekler";

/**
 * #287: Mentör başvuru formu.
 *
 * Stajyer formu gibi çok adımlı DEĞİL, bilerek: 11 alan için adım makinesi
 * (adım doğrulama, hata gösterme bayrakları, ileri/geri durumu) kazancından
 * fazla iş çıkarırdı. Mentör bunu bir kez dolduruyor ve alanlar birbiriyle
 * ilişkili — bölmek bağlamı kopartırdı.
 *
 * Form hesap PENDING iken doldurulur; onay bu adımdan SONRA gelir.
 */

function Bolum({
  baslik,
  aciklama,
  children,
}: {
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-bold text-slate-900">{baslik}</h2>
        {aciklama ? <p className="mt-1 text-xs text-slate-500">{aciklama}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Hata({ mesaj }: { mesaj?: string }) {
  return mesaj ? <p className="text-xs text-red-500">{mesaj}</p> : null;
}

export function MentorBasvuruForm({ initial }: { initial?: Partial<MentorBasvuru> }) {
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MentorBasvuru>({
    resolver: zodResolver(mentorBasvuruSchema),
    mode: "onSubmit",
    defaultValues: {
      title: initial?.title ?? "",
      company: initial?.company ?? "",
      yearsExperience: initial?.yearsExperience,
      seniority: initial?.seniority,
      expertise: initial?.expertise ?? [],
      capacity: initial?.capacity ?? 1,
      weeklyHours: initial?.weeklyHours,
      motivation: initial?.motivation ?? "",
      mentoringStyle: initial?.mentoringStyle ?? "",
      githubUrl: initial?.githubUrl ?? "",
      linkedinUrl: initial?.linkedinUrl ?? "",
      city: initial?.city ?? "",
    },
  });

  const gonder = async (veri: MentorBasvuru) => {
    setGonderiliyor(true);
    setHata(null);
    try {
      await saveMentorBasvuru(veri);
      // Server action'dan redirect() çağrılmıyor: stajyer akışında bu,
      // istemci catch'inde "aborted" hatasına dönüşüp yanlış uyarı gösteriyordu.
      window.location.href = "/account-status";
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Başvuru kaydedilemedi.");
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(gonder)} className="space-y-5">
      <Bolum baslik="Profesyonel geçmişin" aciklama="Onay değerlendirmesinde ilk bakılan yer.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="mb-title" className="block text-sm font-semibold text-slate-700">
              Ünvanın
            </label>
            <Input
              id="mb-title"
              {...register("title")}
              placeholder="Örn: Senior Backend Developer"
              className="h-12 bg-slate-50"
            />
            <Hata mesaj={errors.title?.message} />
          </div>
          <div className="space-y-2">
            <label htmlFor="mb-company" className="block text-sm font-semibold text-slate-700">
              Kurum <span className="font-normal text-slate-400">(opsiyonel)</span>
            </label>
            <Input
              id="mb-company"
              {...register("company")}
              placeholder="Örn: Posinowa"
              className="h-12 bg-slate-50"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="mb-years" className="block text-sm font-semibold text-slate-700">
              Kaç yıldır yazılım geliştiriyorsun?
            </label>
            <Input
              id="mb-years"
              type="number"
              min={MENTOR_DENEYIM_EN_AZ}
              max={MENTOR_DENEYIM_EN_COK}
              {...register("yearsExperience", { valueAsNumber: true })}
              placeholder="Örn: 7"
              className="h-12 bg-slate-50"
            />
            <Hata mesaj={errors.yearsExperience?.message} />
          </div>
          <div className="space-y-2">
            <label htmlFor="mb-city" className="block text-sm font-semibold text-slate-700">
              Yaşadığın il <span className="font-normal text-slate-400">(opsiyonel)</span>
            </label>
            <Input
              id="mb-city"
              {...register("city")}
              placeholder="Örn: Samsun"
              className="h-12 bg-slate-50"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Kıdemin</label>
          <div className="grid gap-3 md:grid-cols-2">
            {MENTOR_KIDEMLERI.map((k) => (
              <label key={k.deger} className="relative">
                <input
                  type="radio"
                  value={k.deger}
                  {...register("seniority")}
                  className="peer sr-only"
                />
                <div className="h-full cursor-pointer rounded-xl border-2 border-slate-100 p-4 transition-all hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50">
                  <h3 className="text-sm font-semibold text-slate-900">{k.etiket}</h3>
                  <p className="mt-1 text-xs text-slate-500">{k.aciklama}</p>
                </div>
              </label>
            ))}
          </div>
          <Hata mesaj={errors.seniority?.message} />
        </div>
      </Bolum>

      <Bolum
        baslik="Ne öğretebilirsin?"
        aciklama="Stajyerin ilgi alanlarıyla AYNI liste — eşleştirme buradan yapılıyor."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {MENTOR_UZMANLIKLARI.map((u) => (
            <label key={u.deger} className="relative">
              <input
                type="checkbox"
                value={u.deger}
                {...register("expertise")}
                className="peer sr-only"
              />
              <div className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-slate-100 p-3 transition-all hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50">
                <span className="text-xl">{u.emoji}</span>
                <span className="text-sm font-medium text-slate-800">{u.etiket}</span>
              </div>
            </label>
          ))}
        </div>
        <Hata mesaj={errors.expertise?.message} />
      </Bolum>

      <Bolum baslik="Ne kadar vaktin var?" aciklama="Atama planlaması bu iki sayıya göre yapılıyor.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="mb-capacity" className="block text-sm font-semibold text-slate-700">
              Aynı anda kaç stajyer alabilirsin?
            </label>
            <Input
              id="mb-capacity"
              type="number"
              min={MENTOR_KAPASITE_EN_AZ}
              max={MENTOR_KAPASITE_EN_COK}
              {...register("capacity", { valueAsNumber: true })}
              className="h-12 max-w-[160px] bg-slate-50"
            />
            <Hata mesaj={errors.capacity?.message} />
          </div>
          <div className="space-y-2">
            <label htmlFor="mb-hours" className="block text-sm font-semibold text-slate-700">
              Haftada kaç saat ayırabilirsin?
            </label>
            <Input
              id="mb-hours"
              type="number"
              min={HAFTALIK_SAAT_EN_AZ}
              max={HAFTALIK_SAAT_EN_COK}
              {...register("weeklyHours", { valueAsNumber: true })}
              placeholder="Örn: 6"
              className="h-12 max-w-[160px] bg-slate-50"
            />
            <Hata mesaj={errors.weeklyHours?.message} />
          </div>
        </div>
      </Bolum>

      <Bolum baslik="Mentörlük yaklaşımın" aciklama="Eşleştirmenin en zengin girdisi burası.">
        <div className="space-y-2">
          <label htmlFor="mb-motivation" className="block text-sm font-semibold text-slate-700">
            Neden mentörlük yapmak istiyorsun?
          </label>
          <textarea
            id="mb-motivation"
            {...register("motivation")}
            rows={4}
            placeholder="Örn: Kendi başlangıcımda yol gösterecek biri yoktu; o boşluğu doldurmak istiyorum."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
          />
          <Hata mesaj={errors.motivation?.message} />
        </div>

        <div className="space-y-2">
          <label htmlFor="mb-style" className="block text-sm font-semibold text-slate-700">
            Nasıl bir mentörsün?
          </label>
          <p className="text-xs text-slate-500">
            Stajyer takıldığında ne yaparsın? Hazır cevap mı verirsin, birlikte mi ararsınız?
          </p>
          <textarea
            id="mb-style"
            {...register("mentoringStyle")}
            rows={4}
            placeholder="Örn: Önce kendi denemesini isterim, takıldığı yerde birlikte dokümanı okuruz."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
          />
          <Hata mesaj={errors.mentoringStyle?.message} />
        </div>
      </Bolum>

      <Bolum baslik="Bağlantılar" aciklama="Opsiyonel ama onay değerlendirmesini hızlandırır.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="mb-github" className="block text-sm font-semibold text-slate-700">
              GitHub
            </label>
            <Input
              id="mb-github"
              {...register("githubUrl")}
              placeholder="https://github.com/kullanici"
              className="h-12 bg-slate-50"
            />
            <Hata mesaj={errors.githubUrl?.message} />
          </div>
          <div className="space-y-2">
            <label htmlFor="mb-linkedin" className="block text-sm font-semibold text-slate-700">
              LinkedIn
            </label>
            <Input
              id="mb-linkedin"
              {...register("linkedinUrl")}
              placeholder="https://linkedin.com/in/kullanici"
              className="h-12 bg-slate-50"
            />
            <Hata mesaj={errors.linkedinUrl?.message} />
          </div>
        </div>
      </Bolum>

      {hata ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {hata}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={gonderiliyor}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {gonderiliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {gonderiliyor ? "Gönderiliyor..." : "Başvurumu tamamla"}
      </button>
    </form>
  );
}
