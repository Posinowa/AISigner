import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { readGitHubConfig } from "@/features/github/server/client";

/**
 * #218: GitHub entegrasyonu gerçek mi, simülasyon mu.
 *
 * Admin, çalışma alanı oluşturmadan ÖNCE hangi modda olduğunu bilmeli.
 * Aksi halde "Oluşturuldu" mesajını görüp GitHub'da gerçek bir repo
 * beklerken 404 ile karşılaşıyor.
 *
 * GİZLİLİK: Yalnızca boolean döner. Token, hesap adı veya yapılandırmanın
 * herhangi bir parçası sızmaz — bu uç yalnızca "yapılandırılmış mı" sorusunu
 * yanıtlar.
 */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  return NextResponse.json({ gercek: readGitHubConfig() !== null });
}
