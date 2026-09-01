import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { createWorkspaceRequestSchema } from "@/lib/validations/api";
import {
  talepOlustur,
  atamaninSonTalebi,
  atamayaErisebilirMi,
  type TalepHatasi,
} from "@/features/workspace-requests/server/talep";

/**
 * Mentörün GitHub çalışma alanı talebi (#349).
 *
 * Bu uç KURULUM YAPMAZ, yalnızca talep kaydeder. Repoyu açan hâlâ admin —
 * yetki bilerek mentöre açılmadı (gerekçe #349'da).
 */

/** Her neden için doğru HTTP durumu: istemci geçici/kalıcı ayrımını yapabilsin. */
const DURUM: Record<TalepHatasi, number> = {
  "atama-yok": 404,
  // Başkasının öğrencisi: 403. Atamanın varlığını doğrulamak sızıntı değil,
  // mentör zaten atama kimliğini bir yerden bulmuş olmalı.
  "yetki-yok": 403,
  "yol-haritasi-yok": 400,
  "zaten-kurulu": 409,
  "zaten-bekliyor": 409,
};

const MESAJ: Record<TalepHatasi, string> = {
  "atama-yok": "Proje ataması bulunamadı.",
  "yetki-yok": "Bu öğrenci üzerinde işlem yapma yetkiniz yok.",
  "yol-haritasi-yok":
    "Çalışma alanı kurulabilmesi için önce en az bir adımı olan bir yol haritası yayınlanmalı.",
  "zaten-kurulu": "Bu proje için çalışma alanı zaten kurulu ya da kurulum sürüyor.",
  "zaten-bekliyor": "Bu proje için zaten bekleyen bir talep var.",
};

export async function POST(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createWorkspaceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sonuc = await talepOlustur({
    assignedProjectId: parsed.data.assignedProjectId,
    mentorUserId: auth.session.user.id!,
    mentorNote: parsed.data.mentorNote ?? null,
  });

  if (!sonuc.ok) {
    return NextResponse.json(
      { error: MESAJ[sonuc.neden] },
      { status: DURUM[sonuc.neden] },
    );
  }

  return NextResponse.json({ requestId: sonuc.requestId }, { status: 201 });
}

/** Mentör ekranının talep rozetini beslemek için: bu atamanın son talebi. */
export async function GET(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const assignedProjectId = new URL(req.url).searchParams.get("assignedProjectId");
  if (!assignedProjectId) {
    return NextResponse.json({ error: "assignedProjectId gerekli." }, { status: 400 });
  }

  // Yetki kontrolü ZORUNLU: aksi halde herhangi bir mentör, atama kimliğini
  // bilerek başka bir mentörün öğrencisinin talep geçmişini okuyabilirdi.
  if (!(await atamayaErisebilirMi(assignedProjectId, auth.session.user.id!))) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  return NextResponse.json({ talep: await atamaninSonTalebi(assignedProjectId) });
}
