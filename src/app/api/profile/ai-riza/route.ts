import { NextResponse, after } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { aiRizasiniAyarla, aiRizasiVar } from "@/features/kvkk/riza";
import { rizaGeriAlindiginda, rizaVerildiginde } from "@/features/kvkk/riza-etkileri";

/**
 * #321: KVKK açık rızasının okunması ve değiştirilmesi.
 *
 * Rıza GERİ ALINABİLİR olmak zorunda (KVKK m.11). Kullanıcı kendi rızasını
 * yönetir — başkasınınkini değil; bu yüzden hedef her zaman oturumdaki
 * kullanıcıdır, gövdeden kullanıcı kimliği ALINMAZ.
 */
export async function GET() {
  // PENDING öğrenci de profilini yönetebilmeli (#143 sözleşmesi).
  const auth = await requireAuth(undefined, { allowUnapprovedStudent: true });
  if (!auth.authorized) return auth.response;

  return NextResponse.json({ rizaVar: await aiRizasiVar(auth.session.user.id!) });
}

export async function POST(req: Request) {
  const auth = await requireAuth(undefined, { allowUnapprovedStudent: true });
  if (!auth.authorized) return auth.response;

  let govde: unknown;
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const istenen = (govde as { rizaVar?: unknown })?.rizaVar;
  // Kesin boolean: "true" gibi bir string'i rıza saymıyoruz.
  if (typeof istenen !== "boolean") {
    return NextResponse.json(
      { error: "`rizaVar` alanı boolean olmalı." },
      { status: 400 },
    );
  }

  const userId = auth.session.user.id!;
  await aiRizasiniAyarla(userId, istenen);

  // #352: Rıza değişikliği TÜREV VERİYİ de etkiliyor.
  //
  // Geri alma SENKRON: kullanıcı "sil" dediğinde yanıt döndüğünde silinmiş
  // olmalı. Arka plana atılsaydı, kullanıcı ekranda "rıza kaldırıldı"
  // görürken analizi hâlâ duruyor olabilirdi.
  //
  // Verme ARKA PLANDA: analiz üretimi bir AI çağrısı, saniyeler sürebilir.
  // Kullanıcıyı bir onay kutusu için bekletmenin anlamı yok ve hata rıza
  // kaydını geri almamalı.
  if (istenen) {
    after(() => rizaVerildiginde(userId));
  } else {
    await rizaGeriAlindiginda(userId);
  }

  return NextResponse.json({ rizaVar: istenen });
}
