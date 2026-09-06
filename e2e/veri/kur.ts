import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";

import { E2E_HESAPLARI, E2E_PAROLA, KIMLIK_DOSYASI, SEED_ADMIN } from "./hesaplar";

/**
 * Playwright `globalSetup` (#510): testlerin ihtiyaç duyduğu hesap
 * DURUMLARINI kurar.
 *
 * ⚠️ `@prisma/client` DOĞRUDAN import ediliyor, `@/lib/db` DEĞİL: o modül
 * `server-only` zincirine bağlı ve Playwright'ın Node bağlamında
 * çözülemiyor. Buradaki tek iş satır yazmak, uygulama kodu değil.
 *
 * ⚠️ TAMAMEN UPSERT — hiçbir satır silinmiyor, var olan hesaplara
 * dokunulmuyor. Kurulum geliştirme veritabanında da koşabiliyor ve bir
 * test kurulumunun kimsenin verisini düşürmemesi gerekiyor.
 */
/**
 * ⚠️ SOĞUK BAŞLANGIÇ ISITMASI — ölçülmüş bir kararsızlık kaynağı.
 *
 * `next start` ayağa kalktığında ilk istekler belirgin biçimde yavaş
 * (Prisma havuzu, JIT, ilk sorgular). Ölçüldü: build sonrası ilk koşuda
 * giriş testleri 20 sn sınırına dayanıp düştü, hemen ardından gelen üç
 * koşu temiz geçti. Tekrar deneme (`retries`) bilerek KAPALI olduğu için
 * bu gürültü testin kendisinde çözülmeli.
 *
 * ⚠️ Isıtma bir ŞEY GİZLEMİYOR: yalnız iki public yolu bir kez çağırıyor,
 * hiçbir iddiası yok. Uygulama gerçekten kırıksa testler yine düşer.
 */
async function sunucuyuIsit() {
  const taban = process.env.E2E_TABAN_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`;

  for (const yol of ["/api/health", "/signin"]) {
    try {
      await fetch(`${taban}${yol}`);
    } catch {
      // Sunucu henüz hazır değilse Playwright'ın kendi bekleyişi devrede.
    }
  }
}

export default async function kur() {
  await sunucuyuIsit();

  const prisma = new PrismaClient();
  const password = await hash(E2E_PAROLA);

  try {
    /*
     * ⚠️ GİRİŞ SAYAÇLARI SIFIRLANIR — testin kendi kurduğu tuzak.
     *
     * `nextauth.ts` başarısız girişleri IP başına 10 dakikada 15 ile
     * sınırlıyor ve sayaç VERİTABANINDA (#322), yani koşular arasında
     * YAŞIYOR. "Yanlış şifre geçmez" testi her koşuda bütçeden bir tane
     * yiyor; art arda birkaç koşu (ya da hata ayıklama turu) limiti
     * doldurunca sonraki koşuda GİRİŞLER düşüyor ve kırmızı, ürün hatası
     * gibi görünüyor. Ölçüldü: testler tek tek yeşil, birlikte kırmızıydı.
     *
     * ⚠️ Silinen şey yalnız GİRİŞ sayaçları — diğer limitlere (AI, ofis
     * saati) dokunulmuyor; onları temizlemek testin kapsamı dışında.
     */
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "login-" } } });

    for (const hesap of E2E_HESAPLARI) {
      const kullanici = await prisma.user.upsert({
        where: { email: hesap.email },
        /*
         * ⚠️ GÜNCELLEMEDE DE DURUM YAZILIYOR. Testler durumu değiştiren
         * uçlara dokunmuyor ama bir önceki koşu ya da elle yapılan bir
         * deneme hesabı başka bir duruma taşımış olabilir; kurulumun
         * bıraktığı durum HER KOŞUDA aynı olmalı.
         */
        update: {
          password,
          role: "STUDENT",
          accountStatus: hesap.accountStatus,
          emailVerified: new Date(),
        },
        create: {
          email: hesap.email,
          name: hesap.ad,
          password,
          role: "STUDENT",
          accountStatus: hesap.accountStatus,
          emailVerified: new Date(),
        },
        select: { id: true },
      });

      if (hesap.profil) {
        await prisma.studentProfile.upsert({
          where: { userId: kullanici.id },
          update: {},
          create: {
            userId: kullanici.id,
            experienceLevel: "BEGINNER",
            interests: ["backend"],
            goals: "E2E testi için oluşturulmuş profil.",
          },
        });
      }
    }
    /*
     * ⚠️ ADMIN KİMLİĞİ TESTLERE AKTARILIYOR. Mezunun mesajlaşmasını test
     * etmek için GEÇERLİ bir alıcı gerekiyor: uydurma bir kimlik 403
     * döndürüyor (`erisim.ts` — öğrenci yalnız mentörüne ve admin'e
     * yazabilir) ve o 403, "mezun olduğu için reddedildi" ile AYIRT
     * EDİLEMEZ. Testin ölçmek istediği tam da bu ayrım.
     */
    const admin = await prisma.user.findUnique({
      where: { email: SEED_ADMIN },
      select: { id: true },
    });
    if (!admin) {
      throw new Error(
        `E2E kurulumu: ${SEED_ADMIN} bulunamadı. Önce \`npm run seed\` çalıştırın.`,
      );
    }
    mkdirSync(".oturum", { recursive: true });
    writeFileSync(KIMLIK_DOSYASI, JSON.stringify({ adminId: admin.id }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
