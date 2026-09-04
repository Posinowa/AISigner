import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { decideProposalSchema } from "@/lib/validations/api";
import {
  oneriyiKararaBagla,
  devirTamamlandiMi,
  type OneriHatasi,
} from "@/features/proposals/server/oneri";
import { prisma } from "@/lib/db";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * Öneriyi karara bağlar (#366).
 *
 * ⚠️ DEVRET kaynağında onay, devir TAMAMLANMADAN geçmez. Transferi biz
 * başlatamıyoruz (GitHub'ın ucu yalnız depo sahibine açık); yalnızca deponun
 * organizasyon altında görünüp görünmediğine bakabiliyoruz.
 */
const DURUM: Partial<Record<OneriHatasi, number>> = {
  "oneri-yok": 404,
  "zaten-karara-baglanmis": 409,
  "gerekce-gerekli": 400,
  "repo-gerekli": 400,
  "devir-tamamlanmamis": 409,
  "baslik-cakismasi": 409,
};

const MESAJ: Partial<Record<OneriHatasi, string>> = {
  "oneri-yok": "Öneri bulunamadı.",
  "zaten-karara-baglanmis": "Bu öneri zaten karara bağlanmış.",
  "gerekce-gerekli": "Reddederken gerekçe yazmanız gerekiyor.",
  "repo-gerekli": "Bu kaynak için geçerli bir GitHub adresi gerekli.",
  "devir-tamamlanmamis":
    "Depo henüz organizasyona devredilmemiş görünüyor. Stajyer transferi tamamladıktan sonra tekrar deneyin.",
  "baslik-cakismasi": "Bu başlıkla bir şablon zaten var; öneri başlığını değiştirin.",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { proposalId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = decideProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const sonuc = await oneriyiKararaBagla({
      proposalId,
      adminUserId: auth.session.user.id!,
      onay: parsed.data.onay,
      adminNote: parsed.data.adminNote ?? null,
      kaynak: parsed.data.kaynak,
    });

    if (!sonuc.ok) {
      return NextResponse.json(
        { error: MESAJ[sonuc.neden] ?? "Öneri işlenemedi." },
        { status: DURUM[sonuc.neden] ?? 400 },
      );
    }
    return NextResponse.json(sonuc, { status: 200 });
  } catch (error) {
    rotaHatasi("POST /api/admin/proposals/[proposalId] error:", error);
    return NextResponse.json({ error: "Öneri işlenemedi." }, { status: 500 });
  }
}

/**
 * Devir tamamlandı mı? (#366)
 *
 * Admin, onaylamadan önce transferin gerçekleşip gerçekleşmediğini buradan
 * kontrol eder — tahmin etmek yerine GitHub'a sorar.
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { proposalId } = await params;
  const oneri = await prisma.projectProposal.findUnique({
    where: { id: proposalId },
    select: { repoUrl: true },
  });
  if (!oneri?.repoUrl) {
    return NextResponse.json({ error: "Bu öneride depo adresi yok." }, { status: 400 });
  }

  return NextResponse.json(await devirTamamlandiMi(oneri.repoUrl));
}
