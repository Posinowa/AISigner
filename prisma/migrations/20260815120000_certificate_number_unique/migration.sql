-- #208 review: Sertifika seri numarası belgeyi tekil tanımlar (public doğrulama
-- `findFirst` ile arar). Çakışma yanlış belgenin "geçerli" sayılmasına yol açabilir.
-- Additive: yalnız UNIQUE index eklenir; kolon/veri değişmez (NULL'lar etkilenmez —
-- Postgres'te birden çok NULL unique index'i ihlal etmez).
CREATE UNIQUE INDEX "StudentProfile_certificateNumber_key" ON "StudentProfile"("certificateNumber");
