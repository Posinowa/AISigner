# Dağıtım

Üretime çıkarken tanımlanması gereken ortam değişkenleri ve entegrasyon
ayarları.

## Zorunlu değişkenler

| Değişken | Ne işe yarar | Eksikse ne olur |
|---|---|---|
| `DATABASE_URL` | PostgreSQL bağlantısı | Uygulama açılmaz |
| `AUTH_SECRET` | NextAuth oturum imzası | **Üretimde açılışta hata fırlatır** (`lib/auth/nextauth.ts`) |
| `NEXTAUTH_URL` | Oturum geri dönüş adresi | Giriş sonrası yönlendirme kırılır |

## GitHub entegrasyonu

Öğrenciye proje atandığında sistem, organizasyon altında bir repo açar; yol
haritasının fazlarını **milestone**, AI'ın ürettiği görevleri **issue** olarak
oluşturur.

| Değişken | Zorunlu mu | Varsayılan |
|---|---|---|
| `GITHUB_TOKEN` | Üretimde **evet** | — |
| `GITHUB_ORG` | Hayır | `Posinowa` |

### Token izinleri

Token'ın hedef organizasyonda şunları yapabilmesi gerekir:

- repo oluşturma (`repo` kapsamı)
- milestone ve issue oluşturma

Token hiçbir zaman loglanmaz (`features/github/server/client.ts`).

### `GITHUB_ORG` hakkında

Tanımlı **değilse** varsayılana (`Posinowa`) düşer. Tanımlı ama **boşsa**
yapılandırma hatalı sayılır ve entegrasyon devre dışı kalır — sessizce
varsayılana düşmek, repoların yanlış hesapta açılmasına yol açabilirdi.

### Önizleme (simülasyon) modu

`GITHUB_TOKEN` tanımlı değilken sistem **önizleme moduna** düşer: GitHub'da
fiziksel bir şey oluşturulmaz, repo/issue bağlantıları yalnızca türetilir.
Admin panelinde bunu belirten sarı bir uyarı görünür.

**Önizleme modu yalnızca geliştirme içindir.** Üretimde (`NODE_ENV=production`)
token eksikse çalışma alanı oluşturma **hata verir**, sessizce simüle etmez.

Sebebi: simülasyon veritabanına sahte URL yazıyor (`RoadmapStep.githubIssueUrl`,
`StepIssue.githubIssueUrl`) ve atamayı `PROVISIONED` damgalıyor. Üretimde bu
sessizce olsaydı admin "oluşturuldu" görür, öğrenci 404 veren bağlantılara
tıklar ve kayıt sonradan gerçek kurulumdan ayırt edilemezdi.

## AI (Gemini)

| Değişken | Ne işe yarar |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | Vertex AI proje kimliği |
| `GOOGLE_CLOUD_LOCATION` | Bölge |
| `GOOGLE_APPLICATION_CREDENTIALS` | Servis hesabı anahtarının yolu |

AI özelliklerinin hepsinde yedek davranış var: model yanıt vermezse profil
analizi, mentör analizi ve proje önerisi hata fırlatmaz, beyan edilen veriden
türetilmiş bir sonuç döner. Yani AI erişimi olmayan bir ortamda uygulama
çalışmayı sürdürür — yalnızca öneriler zayıflar.

## Veritabanı göçleri

Göç güvenliği için `docs/MIGRATIONS.md`'e bakın. Dağıtımdan önce:

```bash
npm run check:migrations
```

Yıkıcı bir ifade (`DROP COLUMN`, `SET NOT NULL`, …) onay yorumu taşımıyorsa CI
başarısız olur.
