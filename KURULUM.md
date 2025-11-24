## Database Kurulumu
 
 ### 1. Docker ile PostgreSQL'i Ayağa Kaldır
PostgreSQL veritabanını Docker üzerinden ayağa kaldırmak için:
```
docker compose up -d
```
Veri tabanı çalışıyor mu test etmek için:
```
 docker compose ps 
```

 Başarılı çıktı:
 ```
NAME          COMMAND                  SERVICE    STATUS      PORTS
aisigner_db   "docker-entrypoint.s…"   postgres   Up 5 seconds   0.0.0.0:5432->5432/tcp
```
### 2. Prisma Kurulumu
 Bağımlılıkları yükle
```
npm install prisma --save-dev

npm install @prisma/client
```

Prisma'yı başlat
```
npx prisma init
```

### .env dosyasını düzenle (DATABASE_URL'i ayarla)

``` 
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aisigner?schema=public" 

NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=change_me

```

 ### Schema dosyasını düzenle (models ekle)
 **Mevcut Modeller**

* **User Modeli**
```
 model User {

  id        Int      @id @default(autoincrement())  
  email     String   @unique                        
  name      String?                                 
  password  String  //hashed password
  phone     String?                                 
  role      Role     @default(STUDENT)                 
  createdAt DateTime @default(now())                
  updatedAt DateTime @updatedAt                     
}

enum Role {
  ADMIN
  MENTOR  
  STUDENT
}

```

### 3. Migration Çalıştır

İlk migration'ı oluştur ve uygula ve Prisma Client'i generate et 
```
npx prisma migrate dev --name init

npx prisma generate

```
### 4. Veritabanını Kontrol Et


* Tablolar oluştu mu?
```
docker exec -it aisigner_db psql -U postgres -d aisigner -c "\dt"
```
 * User tablosu yapısı doğru mu?
```
docker exec -it aisigner_db psql -U postgres -d aisigner -c "\d users"
```
 **Prisma Studio ile Görsel Test**

 * http://localhost:5555 adresinde web arayüzü açılacak, users tablosunu görebiliyor musun?
 ```
 npx prisma studio
 ```

**Prisma Client dosyalarının oluştuğunu kontrol et**
```
ls node_modules/.prisma/client/
```
**TypeScript tip dosyalarını kontrol et**
```
ls node_modules/@prisma/client/
``` 
### 5. Test Verisi Ekleme

**Prisma Studio ile görsel olarak**
```
npx prisma studio
```
* +Add record butonuna bas
* verileri gir
* save e bas

**Veya terminalden**
```
docker exec -it aisigner_db psql -U postgres -d aisigner -c "
INSERT INTO \"User\" (email, password, role) 
VALUES ('test@example.com', 'geçici_şifre', 'STUDENT') 
"
``` 
NOT: gerçek projede şifre hashlenmeli

### 6. Eğer Hata Alırsan

1) Docker container'ının çalıştığından emin ol: 
```
docker ps
```
2) .env dosyasındaki DATABASE_URL'i kontrol et
 
3) Önceki migration'ları resetle:
```
 npx prisma migrate reset

```

## Seed Nasıl Çalıştırılır?
🔹 Seed (Örnek Kullanıcıları Ekleme)

- Bu adımlar, Lokal geliştirme sırasında veritabanına hızlıca test edilebilecek 3 örnek kullanıcı eklemek için kullanılır.Seed script’i idempotent çalışır, yani aynı script tekrar tekrar çalıştırıldığında kullanıcılar çoğalmaz.

- Şifreler güvenli şekilde **argon2** ile hashlenir.
- Prisma Client kullanılarak veritabanına bağlantı sağlanır.


**Adım 1 – Gerekli Paketler**

Önce proje bağımlılıklarını yükleyin:

```bash
npm install @prisma/client @node-rs/argon2 tsx

```
Not: Canlı ortamda NODE_ENV=production ve doğru DATABASE_URL kullanılmalı.

**Adım 2 - package.json Script**
`package.json` dosyanızın `"scripts"` bölümüne aşağıdaki satırı ekleyin:

```json
"scripts": {
  "seed": "tsx scripts/seed.ts"
}

```

**Adım 3 - Seed Script Çalıştırma**

Seed’i çalıştırmak için terminalden proje klasöründe şu komutu çalıştır:
```
npm run seed
```

Script çalıştığında terminalde şöyle bir çıktı görürsün:
```
✅ ADMIN user created: admin@example.com
✅ MENTOR user created: mentor@example.com
✅ STUDENT user created: student@example.com
Seed process completed! 3 users added!
```

Eğer script daha önce çalıştırıldıysa ve kullanıcılar zaten varsa, tekrar ekleme yapılmaz (idempotent davranış).

