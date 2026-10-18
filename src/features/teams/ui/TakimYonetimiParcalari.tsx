"use client";

import { useState } from "react";
import { X, Github, UserMinus } from "lucide-react";
import { tarihBicimle } from "@/lib/tarih";

/**
 * Takım yönetimi (#332 Faz 2).
 *
 * ⚠️ AYRILAN ÜYE LİSTEDEN KAYBOLMAZ, "ayrıldı" olarak görünür. Katkı geçmişi
 * bireysel sertifikanın dayanağı olduğu için üyelik kaydı silinmiyor; admin'in
 * de kimin ne zaman ayrıldığını görebilmesi gerekiyor.
 */

export const ROL_ETIKETLERI: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full-stack",
  qa: "QA / Test",
  design: "Tasarım",
};

export const AZAMI_UYE = 4;
export const ASGARI_UYE = 2;

export type Uye = {
  id: string;
  role: string;
  leftAt: string | null;
  studentProfile: {
    id: string;
    user: { id: string; name: string | null; lastName: string | null; email: string };
  };
};

export type Takim = {
  id: string;
  name: string;
  createdAt: string;
  members: Uye[];
  mentors: { mentor: { id: string; name: string | null; lastName: string | null; email: string } }[];
  assignedProjects: {
    id: string;
    githubStatus: string;
    githubRepoUrl: string | null;
    projectTemplate: { id: string; title: string };
  }[];
};

export type Secenek = { id: string; name: string | null; lastName?: string | null; email: string };

export const ad = (u: { name: string | null; lastName?: string | null; email: string }) =>
  [u.name, u.lastName].filter(Boolean).join(" ") || u.email;

export function TakimKarti({
  takim,
  ogrenciler,
  mentorler,
  sablonlar,
  islem,
  cagir,
}: {
  takim: Takim;
  ogrenciler: Secenek[];
  mentorler: Secenek[];
  sablonlar: { id: string; title: string }[];
  islem: boolean;
  cagir: (yol: string, s: RequestInit, basari: string) => Promise<boolean>;
}) {
  const aktifler = takim.members.filter((m) => m.leftAt === null);
  const ayrilanlar = takim.members.filter((m) => m.leftAt !== null);
  const aktifIdler = new Set(aktifler.map((m) => m.studentProfile.user.id));
  const mentorIdleri = takim.mentors.map((m) => m.mentor.id);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">{takim.name}</h2>
        <span className="text-xs text-slate-500">
          {aktifler.length}/{AZAMI_UYE} aktif üye
          {aktifler.length < ASGARI_UYE && " · proje atamak için en az 2 üye gerekli"}
        </span>
      </div>

      <Bolum baslik="Üyeler">
        {aktifler.length === 0 && ayrilanlar.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz üye yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {aktifler.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/60 px-3 py-2"
              >
                <span className="text-sm text-slate-800">
                  {ad(m.studentProfile.user)}
                  <span className="ml-2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {ROL_ETIKETLERI[m.role] ?? m.role}
                  </span>
                </span>
                <button
                  onClick={() =>
                    cagir(
                      `/api/admin/teams/${takim.id}/members/${m.id}`,
                      { method: "DELETE" },
                      "Üye takımdan ayrıldı.",
                    )
                  }
                  disabled={islem}
                  aria-label={`${ad(m.studentProfile.user)} üyeliğini sonlandır`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  Ayır
                </button>
              </li>
            ))}
            {/* Ayrılanlar gizlenmiyor: katkı geçmişi duruyor, admin görebilmeli. */}
            {ayrilanlar.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400">
                <X className="h-3.5 w-3.5" />
                <span className="line-through">{ad(m.studentProfile.user)}</span>
                <span className="text-[11px]">
                  ayrıldı · {tarihBicimle(m.leftAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Ekle
          etiket="Üye ekle"
          devre={islem || aktifler.length >= AZAMI_UYE}
          secenekler={ogrenciler
            .filter((o) => !aktifIdler.has(o.id))
            .map((o) => ({ deger: o.id, metin: `${ad(o)} (${o.email})` }))}
          ikinciSecenekler={Object.entries(ROL_ETIKETLERI).map(([deger, metin]) => ({
            deger,
            metin,
          }))}
          onSec={(studentUserId, role) =>
            cagir(
              `/api/admin/teams/${takim.id}/members`,
              { method: "POST", body: JSON.stringify({ studentUserId, role }) },
              "Üye eklendi.",
            )
          }
        />
      </Bolum>

      <Bolum baslik="Mentörler">
        {takim.mentors.length === 0 ? (
          <p className="text-sm text-slate-500">Takıma mentör atanmamış.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {takim.mentors.map((m) => (
              <span
                key={m.mentor.id}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
              >
                {ad(m.mentor)}
                <button
                  onClick={() =>
                    cagir(
                      `/api/admin/teams/${takim.id}/mentors`,
                      {
                        method: "PUT",
                        body: JSON.stringify({
                          mentorIds: mentorIdleri.filter((x) => x !== m.mentor.id),
                        }),
                      },
                      "Mentör kaldırıldı.",
                    )
                  }
                  disabled={islem}
                  aria-label={`${ad(m.mentor)} mentörünü kaldır`}
                  className="hover:text-red-600 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <TekliSec
          etiket="+ Mentör ekle…"
          devre={islem}
          secenekler={mentorler
            .filter((m) => !mentorIdleri.includes(m.id))
            .map((m) => ({ deger: m.id, metin: `${ad(m)} (${m.email})` }))}
          onSec={(mentorId) =>
            cagir(
              `/api/admin/teams/${takim.id}/mentors`,
              { method: "PUT", body: JSON.stringify({ mentorIds: [...mentorIdleri, mentorId] }) },
              "Mentör eklendi.",
            )
          }
        />
      </Bolum>

      <Bolum baslik="Projeler">
        {takim.assignedProjects.length === 0 ? (
          <p className="text-sm text-slate-500">Takıma proje atanmamış.</p>
        ) : (
          <ul className="space-y-1.5">
            {takim.assignedProjects.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50/60 px-3 py-2 text-sm"
              >
                <span className="text-slate-800">{p.projectTemplate.title}</span>
                {p.githubRepoUrl ? (
                  <a
                    href={p.githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    <Github className="h-3.5 w-3.5" />
                    Repo
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">
                    Çalışma alanı kurulmadı ({p.githubStatus})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <TekliSec
          etiket="+ Proje ata…"
          // En az 2 üye şartı sunucuda; düğmeyi burada da kapatıyoruz ki
          // admin reddedilecek bir işlemi denemesin.
          devre={islem || aktifler.length < ASGARI_UYE}
          secenekler={sablonlar
            .filter((s) => !takim.assignedProjects.some((p) => p.projectTemplate.id === s.id))
            .map((s) => ({ deger: s.id, metin: s.title }))}
          onSec={(projectTemplateId) =>
            cagir(
              `/api/admin/teams/${takim.id}/project`,
              { method: "POST", body: JSON.stringify({ projectTemplateId }) },
              "Proje takıma atandı.",
            )
          }
        />
      </Bolum>
    </section>
  );
}

export function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{baslik}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export function TekliSec({
  etiket,
  secenekler,
  devre,
  onSec,
}: {
  etiket: string;
  secenekler: { deger: string; metin: string }[];
  devre: boolean;
  onSec: (deger: string) => void;
}) {
  if (secenekler.length === 0) return null;
  return (
    <select
      value=""
      disabled={devre}
      onChange={(e) => e.target.value && onSec(e.target.value)}
      aria-label={etiket}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
    >
      <option value="">{etiket}</option>
      {secenekler.map((s) => (
        <option key={s.deger} value={s.deger}>
          {s.metin}
        </option>
      ))}
    </select>
  );
}

/** İki seçimli ekleme (kişi + rol) — rol seçilmeden ekleme yapılmaz. */
export function Ekle({
  etiket,
  secenekler,
  ikinciSecenekler,
  devre,
  onSec,
}: {
  etiket: string;
  secenekler: { deger: string; metin: string }[];
  ikinciSecenekler: { deger: string; metin: string }[];
  devre: boolean;
  onSec: (birinci: string, ikinci: string) => void;
}) {
  const [kisi, setKisi] = useState("");
  const [rol, setRol] = useState(ikinciSecenekler[0]?.deger ?? "");

  if (secenekler.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={kisi}
        disabled={devre}
        onChange={(e) => setKisi(e.target.value)}
        aria-label={etiket}
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
      >
        <option value="">{etiket}…</option>
        {secenekler.map((s) => (
          <option key={s.deger} value={s.deger}>
            {s.metin}
          </option>
        ))}
      </select>
      <select
        value={rol}
        disabled={devre}
        onChange={(e) => setRol(e.target.value)}
        aria-label="Takımdaki rol"
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
      >
        {ikinciSecenekler.map((s) => (
          <option key={s.deger} value={s.deger}>
            {s.metin}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={devre || !kisi || !rol}
        onClick={() => {
          onSec(kisi, rol);
          setKisi("");
        }}
        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
      >
        Ekle
      </button>
    </div>
  );
}
