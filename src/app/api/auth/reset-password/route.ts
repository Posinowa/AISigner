import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createRateLimiter } from "@/lib/rate-limit";
import { passwordSchema } from "@/features/auth/models/user";
import {
  sendPasswordResetEmail,
  resetPassword,
} from "@/features/auth/server/password-reset";

/**
 * #262: E-postayla şifre sıfırlama.
 *
 * İki işlem tek uçta:
 * - `{ email }`        → sıfırlama bağlantısı gönder
 * - `{ token, password }` → yeni şifreyi belirle
 *
 * ENUMERATION: Talep adımı, e-posta kayıtlı olsun ya da olmasın AYNI yanıtı
 * döner. `sendPasswordResetEmail` de hesabın varlığını çağırana söylemiyor.
 */

// IP bazlı: aynı makineden toplu deneme.
const ipLimiter = createRateLimiter("reset-password-ip", {
  maxRequests: 10,
  windowSeconds: 300,
});

// Hesap bazlı: IP değiştirilerek tek hesabın e-posta bombardımanına
// tutulmasını engeller.
const hesapLimiter = createRateLimiter("reset-password-account", {
  maxRequests: 5,
  windowSeconds: 3600,
});

function istemciIp(h: Headers): string {
  return (
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

const AYNI_YANIT = {
  message:
    "Bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.",
};

export async function POST(req: Request) {
  const ip = istemciIp(await headers());

  const rl = ipLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yaptınız. Lütfen bir süre bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { email, token, password } = (body ?? {}) as {
    email?: unknown;
    token?: unknown;
    password?: unknown;
  };

  // --- 2. adım: yeni şifreyi belirle -------------------------------------
  if (typeof token === "string" && token.length > 0) {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      // Şifre kuralları kayıt akışıyla AYNI; sıfırlama zayıf şifreye kapı olmasın.
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Şifre geçersiz." },
        { status: 400 },
      );
    }

    const sonuc = await resetPassword(token, parsed.data);
    if (!sonuc.ok) {
      return NextResponse.json(
        {
          error:
            sonuc.reason === "expired"
              ? "Bağlantının süresi doldu. Lütfen yeni bir sıfırlama bağlantısı isteyin."
              : "Bağlantı geçersiz veya daha önce kullanılmış. Lütfen yeni bir bağlantı isteyin.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "Şifreniz güncellendi. Giriş yapabilirsiniz." });
  }

  // --- 1. adım: sıfırlama bağlantısı iste --------------------------------
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Geçerli bir e-posta adresi girin." },
      { status: 400 },
    );
  }

  const normalize = email.toLowerCase().trim();

  const hesapRl = hesapLimiter.check(normalize);
  if (!hesapRl.allowed) {
    // Sınır aşıldığında da AYNI yanıt: 429 dönmek hesabın varlığını ele verirdi.
    return NextResponse.json(AYNI_YANIT);
  }

  await sendPasswordResetEmail(normalize);

  return NextResponse.json(AYNI_YANIT);
}
