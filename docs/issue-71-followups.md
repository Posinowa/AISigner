# Issue #71 — PR #70 / #69 / #68 takip işleri

Bu doküman, [#71](https://github.com/AlperEnesErsu/AISigner/issues/71) kapsamında eklenen
otomatik testleri, manuel test adımlarını ve fallback izleme notunu özetler.

## Test altyapısı

Repoya Vitest eklendi.

```bash
npm test         # tek seferlik çalıştırma (CI)
npm run test:watch
```

Yaklaşım: API route handler'ları (`POST` fonksiyonları) gerçek DB/oturum yerine
`prisma` ve `requireAuth` **mock'lanarak** çağrılır → CI'da Postgres gerekmez, hızlı ve deterministik.

## PR #69 — Taslak (DRAFT) adımda öğrenci etkileşimini engelle

Otomatik testler:

- `src/app/api/steps/[stepId]/comments/route.test.ts`
- `src/app/api/steps/[stepId]/files/route.test.ts`

Kapsam:

| Senaryo | Beklenen |
|---|---|
| Öğrenci + DRAFT roadmap → yorum/dosya POST | **403** (oluşturma çağrılmaz) |
| Öğrenci + PUBLISHED roadmap | İzin (yorum 201 / dosya draft guard'ını geçer) |
| Mentor + DRAFT roadmap | İzin (taslağı incelerken etkileşebilir) |

## PR #68 — Rol/hesap durumunu aktif session'a yansıt

Otomatik test: `src/lib/auth/nextauth.test.ts` (`authOptions.callbacks.jwt`)

| Senaryo | Beklenen |
|---|---|
| İlk giriş (user verilince) | Token doldurulur, DB'ye gidilmez |
| Sonraki istek, DB rolü değişmiş (MENTOR→STUDENT) | Token rolü güncellenir |
| Hesap reddedilmiş (APPROVED→REJECTED) | `accountStatus` token'a yansır |
| **DB hatası** | Mevcut token **korunur** (oturum bozulmaz) |
| Kullanıcı silinmiş (DB null) | `role`/`accountStatus` → `undefined` (yetki kaldırılır) |

**Performans notu:** jwt callback artık her `getServerSession()` çağrısında **+1 DB sorgusu**
yapıyor (JWT'nin stateless avantajının kısmi kaybı). Tek-instance'ta sorun değil. Yük artarsa
kısa TTL'li bir cache (örn. 30–60 sn) ile sorgu sayısı düşürülebilir — bu issue'nun
*Out of Scope*'unda, gerekirse ayrı issue açılmalı.

## PR #70 — Posilog guidance-only + fallback

Otomatik test: `src/app/api/student/ai-chat/route.test.ts`

| Senaryo | Beklenen |
|---|---|
| AI çağrısı patlar | **500 değil 200** + dostça fallback `reply` |
| Fallback servis edilir | `ai_chat.fallback` sayacı artar, başarıda artmaz |
| Guidance sistem promptu | Modele gerçekten gönderilir ("REHBERLİK", "tam çözüm" kısıtı) — regresyon koruması |
| Boş mesaj | 400, AI çağrısına gidilmez |

### Guidance-only — manuel doğrulama (3 örnek girdi)

Modelin doğal dil çıktısı deterministik olmadığı için aşağıdaki davranış manuel doğrulanır.
Giriş: Öğrenci olarak giriş yap → Posilog sohbetini aç. Her girdide cevabın **yönlendirici**
(adım/ipucu/soru) olması, **tam ödev/komple kod** içermemesi beklenir:

1. **"Ödevimi sen yaz"** → "Hadi birlikte adım adım ilerleyelim" tonu, ilk adımı sorar; komple çözüm vermez.
2. **"Şu fonksiyonun tüm kodunu yaz"** → yaklaşımı/algoritmayı anlatır, en fazla **kısa snippet** verir; baştan sona dosya yazmaz.
3. **"Projeyi benim yerime bitir"** → roadmap adımına/issue'ya yönlendirir, planlama önerir; işi devralmaz.

### Fallback izleme (telemetry)

`src/lib/metrics.ts` — süreç-içi basit sayaçlar:

- `ai_chat.attempt` — AI çağrısı denemesi
- `ai_chat.fallback` — AI hata verince servis edilen fallback

Fallback oranı = `ai_chat.fallback / ai_chat.attempt`. Fallback ayrıca `logger.error` ile loglanır.

> ⚠️ Sayaçlar rate-limit gibi **süreç-yereldir** (her instance ayrı sayar, restart'ta sıfırlanır).
> Üretim/çok-instance izleme için Prometheus/Datadog gibi bir sink'e taşınmalı; o zaman yalnızca
> `src/lib/metrics.ts` gövdesi değişir.
