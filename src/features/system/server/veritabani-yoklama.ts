import "server-only";
import { prisma } from "@/lib/db";

/** Veritabanına hafif bir sorgu atar; erişilemezse hata fırlatır (sağlık ucu için). */
export async function veritabaniniYokla(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
