"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { sablonuYonetebilir } from "@/features/projects/yetki";

/**
 * #253: Mentörün proje şablonlarını gördüğü ve kendi şablonunu yönettiği ekran.
 *
 * Yetki kararı SUNUCUDA veriliyor; buradaki `sablonuYonetebilir` yalnızca
 * kullanıcıya işe yaramayacak buton göstermemek için. Butonu gizlemek koruma
 * DEĞİLDİR — uçlar sahipliği kendisi doğruluyor.
 */

type Sablon = {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
  githubRepoUrl: string | null;
  createdById: string | null;
};

const ZORLUK: Record<Sablon["difficulty"], { etiket: string; sinif: string }> = {
  EASY: { etiket: "Kolay", sinif: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MEDIUM: { etiket: "Orta", sinif: "bg-amber-50 text-amber-700 border-amber-200" },
  HARD: { etiket: "Zor", sinif: "bg-rose-50 text-rose-700 border-rose-200" },
};

const BOS_FORM = {
  title: "",
  description: "",
  difficulty: "MEDIUM" as Sablon["difficulty"],
  track: "",
  githubRepoUrl: "",
};

const GIRDI_SINIFI =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-3 focus:ring-ring";

export function MentorProjeler({ kullaniciId }: { kullaniciId: string }) {
  const [sablonlar, setSablonlar] = useState<Sablon[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Sablon | null>(null);
  const [form, setForm] = useState(BOS_FORM);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [formHatasi, setFormHatasi] = useState<string | null>(null);

  const kullanici = { id: kullaniciId, role: "MENTOR" };

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await fetch("/api/admin/project-templates");
      if (!res.ok) throw new Error("liste alinamadi");
      setSablonlar(await res.json());
    } catch {
      setHata("Proje şablonları yüklenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  function formuAc(sablon?: Sablon) {
    setFormHatasi(null);
    if (sablon) {
      setDuzenlenen(sablon);
      setForm({
        title: sablon.title,
        description: sablon.description,
        difficulty: sablon.difficulty,
        track: sablon.track.join(", "),
        githubRepoUrl: sablon.githubRepoUrl ?? "",
      });
    } else {
      setDuzenlenen(null);
      setForm(BOS_FORM);
    }
    setFormAcik(true);
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setGonderiliyor(true);
    setFormHatasi(null);

    const govde = {
      title: form.title.trim(),
      description: form.description.trim(),
      difficulty: form.difficulty,
      track: form.track
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      githubRepoUrl: form.githubRepoUrl.trim() || null,
    };

    try {
      const res = await fetch(
        duzenlenen
          ? `/api/admin/project-templates/${duzenlenen.id}`
          : "/api/admin/project-templates",
        {
          method: duzenlenen ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(govde),
        },
      );

      if (!res.ok) {
        const yanit = await res.json().catch(() => ({}));
        setFormHatasi(
          typeof yanit?.error === "string"
            ? yanit.error
            : "Kaydedilemedi. Alanları kontrol edin.",
        );
        return;
      }

      setFormAcik(false);
      await yukle();
    } catch {
      setFormHatasi("Kaydedilemedi. Bağlantınızı kontrol edin.");
    } finally {
      setGonderiliyor(false);
    }
  }

  async function sil(sablon: Sablon) {
    const onay = window.confirm(
      `"${sablon.title}" şablonunu silmek istediğinize emin misiniz?`,
    );
    if (!onay) return;

    const res = await fetch(`/api/admin/project-templates/${sablon.id}`, {
      method: "DELETE",
    });
    if (res.ok) await yukle();
    else setHata("Şablon silinemedi.");
  }

  if (yukleniyor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="mr-3 h-7 w-7 animate-spin text-primary" />
        <span className="text-slate-600">Proje şablonları yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-8 flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Proje Şablonları
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Öğrencilerine atayabileceğin projeleri gör; kendi şablonunu oluştur.
            </p>
          </div>
          <button
            onClick={() => formuAc()}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Yeni Proje Şablonu
          </button>
        </div>

        {hata && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {hata}
          </div>
        )}

        {sablonlar.length === 0 ? (
          <p className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500">
            Henüz proje şablonu yok. İlkini sen oluşturabilirsin.
          </p>
        ) : (
          <ul className="space-y-3">
            {sablonlar.map((s) => {
              const benim = sablonuYonetebilir(kullanici, s);
              const zorluk = ZORLUK[s.difficulty];
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{s.title}</h2>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${zorluk.sinif}`}
                        >
                          {zorluk.etiket}
                        </span>
                        {benim && (
                          <span className="rounded-full border border-primary/20 bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                            Senin şablonun
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {s.description}
                      </p>
                      {s.track.length > 0 && (
                        <p className="mt-2 text-xs text-slate-400">{s.track.join(" • ")}</p>
                      )}
                    </div>

                    {benim && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => formuAc(s)}
                          title="Düzenle"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Düzenle
                        </button>
                        <button
                          onClick={() => void sil(s)}
                          title="Sil"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-300 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Sil
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formAcik && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-label={duzenlenen ? "Şablonu düzenle" : "Yeni proje şablonu"}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {duzenlenen ? "Şablonu Düzenle" : "Yeni Proje Şablonu"}
              </h2>
              <button
                onClick={() => setFormAcik(false)}
                aria-label="Kapat"
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={gonder} className="space-y-4 px-6 py-5">
              <div>
                <label
                  htmlFor="proje-baslik"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Başlık
                </label>
                <input
                  id="proje-baslik"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className={GIRDI_SINIFI}
                />
              </div>

              <div>
                <label
                  htmlFor="proje-aciklama"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Açıklama
                </label>
                <textarea
                  id="proje-aciklama"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  rows={4}
                  className={GIRDI_SINIFI}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="proje-zorluk"
                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                  >
                    Zorluk
                  </label>
                  <select
                    id="proje-zorluk"
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        difficulty: e.target.value as Sablon["difficulty"],
                      })
                    }
                    className={GIRDI_SINIFI}
                  >
                    <option value="EASY">Kolay</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="HARD">Zor</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="proje-track"
                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                  >
                    Alanlar
                  </label>
                  <input
                    id="proje-track"
                    value={form.track}
                    onChange={(e) => setForm({ ...form, track: e.target.value })}
                    placeholder="Frontend, Backend"
                    className={GIRDI_SINIFI}
                  />
                  <p className="mt-1 text-xs text-slate-400">Virgülle ayır.</p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="proje-repo"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  GitHub Repo URL (opsiyonel)
                </label>
                <input
                  id="proje-repo"
                  value={form.githubRepoUrl}
                  onChange={(e) => setForm({ ...form, githubRepoUrl: e.target.value })}
                  placeholder="https://github.com/..."
                  className={GIRDI_SINIFI}
                />
              </div>

              {formHatasi && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {formHatasi}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormAcik(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={gonderiliyor}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {gonderiliyor && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {duzenlenen ? "Kaydet" : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
