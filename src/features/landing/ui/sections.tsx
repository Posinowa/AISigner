import Image from "next/image";
import Link from "next/link";
import { CizimBaglantisi } from "@/features/brand/ui/CizimBaglantisi";
import { Reveal } from "./Reveal";
import { TurkeyMap } from "./TurkeyMap";

/* Ortak parçalar ------------------------------------------------------- */

const KAP = "mx-auto w-[min(100%-2*clamp(20px,5vw,56px),1180px)]";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-[var(--landing-muted)]">
      {children}
    </p>
  );
}

function BolumBasligi({
  eyebrow,
  baslik,
  alt,
}: {
  eyebrow: string;
  baslik: string;
  alt?: string;
}) {
  return (
    <Reveal className="max-w-[68ch]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3.5 text-pretty text-[clamp(28px,4.2vw,42px)] font-extrabold leading-[1.05] tracking-[-0.035em]">
        {baslik}
      </h2>
      {alt ? (
        <p className="mt-4 max-w-[54ch] text-[var(--landing-muted)]">{alt}</p>
      ) : null}
    </Reveal>
  );
}

function BirincilCta({ children }: { children: React.ReactNode }) {
  return (
    <CizimBaglantisi
      href="/signup"
      mesaj="Kayıt sayfası açılıyor..."
      className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--landing-navy)] px-[18px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--landing-navy)_86%,#000)] active:translate-y-px"
    >
      {children}
    </CizimBaglantisi>
  );
}

function IkincilCta({ children }: { children: React.ReactNode }) {
  return (
    <CizimBaglantisi
      // #250: Önceden mailto: idi — başvuru sisteme hiç girmiyordu. Artık
      // kayıt akışına gidiyor; başvuru MENTOR+PENDING olarak kaydediliyor ve
      // admin panelinde görünüyor.
      href="/signup?rol=mentor"
      mesaj="Mentör başvurusu açılıyor..."
      className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--landing-line)] px-[18px] text-[14.5px] font-semibold transition-colors hover:border-[var(--landing-muted)] active:translate-y-px"
    >
      {children}
    </CizimBaglantisi>
  );
}

/* Bölümler -------------------------------------------------------------- */

export function Hero() {
  return (
    <div className={`${KAP} pb-[clamp(16px,2.2vw,24px)] pt-[clamp(30px,4.4vw,46px)]`}>
      <div className="landing-rise [animation-delay:0.04s]">
        <Eyebrow>
          Bir <b className="font-medium text-[var(--landing-navy)]">Posinowa</b>{" "}
          ürünü · Yapay zeka destekli staj programı
        </Eyebrow>
      </div>
      <h1 className="landing-rise mt-3.5 text-pretty text-[clamp(32px,4.6vw,54px)] font-extrabold leading-[1.05] tracking-[-0.035em] [animation-delay:0.10s]">
        Türkiye&apos;nin Her Yerinde,
        <br />
        <span className="text-[var(--landing-navy)]">Bir Hayalin Peşinde.</span>
      </h1>
      <p className="landing-rise mt-4 max-w-[62ch] text-[clamp(16px,1.7vw,18px)] text-[var(--landing-muted)] [animation-delay:0.16s]">
        Kayıt ol, profilini oluştur; yapay zeka analiz eder, ekibimiz inceler ve
        sana bir mentör atar. Büyükşehirde de, küçük ilçede de aynı staj.
      </p>
      <div className="landing-rise mt-[22px] flex flex-wrap gap-3 [animation-delay:0.22s]">
        <BirincilCta>Kayıt ol ve profilini oluştur</BirincilCta>
        <IkincilCta>Mentör olmak istiyorum</IkincilCta>
      </div>
    </div>
  );
}

export function MapStage() {
  return (
    <div className={`${KAP} pb-[clamp(56px,8vw,96px)]`}>
      <div className="landing-rise [animation-delay:0.28s]">
        <TurkeyMap />
      </div>
    </div>
  );
}

const ADIMLAR = [
  {
    n: "01",
    baslik: "Kayıt ol",
    metin:
      "E-posta ve şifreyle hesabını aç. Hesabın bu noktada onay bekliyor — ama beklerken boş durmuyorsun.",
  },
  {
    n: "02",
    baslik: "Profilini oluştur",
    metin:
      "Deneyim seviyeni, ilgi alanlarını, hedefini ve haftalık uygunluğunu gir. Yapay zeka bu profili okuyup analizini çıkarır.",
  },
  {
    n: "03",
    baslik: "Onaydan geç, mentörüne kavuş",
    metin:
      "Ekibimiz profilini inceler. Onaylandığında sana bir ya da birden fazla mentör atanır; hepsi eşit yetkili.",
  },
  {
    n: "04",
    baslik: "Yol haritanı takip et",
    metin:
      "Mentörün sana özel bir yol haritası yayınlar. Her adımın kendi görevi, GitHub issue'su, dosyaları ve yorumları var.",
  },
];

export function Steps() {
  return (
    <section
      id="nasil"
      className="scroll-mt-[76px] border-t border-[var(--landing-line-soft)] py-[clamp(56px,8vw,96px)]"
    >
      <div className={KAP}>
        <div className="mb-[clamp(32px,5vw,52px)]">
          <BolumBasligi
            eyebrow="Akış"
            baslik="Kayıttan ilk commit'e dört adım."
            alt="Her adımın sahibi belli: sen, seni inceleyen ekip ve sana atanan mentör."
          />
        </div>
        <ol className="grid gap-px overflow-hidden rounded-[10px] border border-[var(--landing-line-soft)] bg-[var(--landing-line-soft)] sm:grid-cols-2 xl:grid-cols-4">
          {ADIMLAR.map((a, i) => (
            <Reveal
              as="li"
              key={a.n}
              delay={i * 60}
              className="flex flex-col gap-2.5 bg-[var(--landing-paper)] p-[clamp(22px,3vw,32px)]"
            >
              <span className="font-mono text-xs tracking-[0.14em] text-[var(--landing-navy)]">
                {a.n}
              </span>
              <h3 className="text-[19px] font-extrabold tracking-[-0.02em]">
                {a.baslik}
              </h3>
              <p className="text-[15.5px] text-[var(--landing-muted)]">
                {a.metin}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const OZELLIKLER = [
  {
    etiket: "Yapay zeka",
    baslik: "Profil analizi ve 7/24 asistan",
    metin:
      "Gemini destekli analiz profilini okuyup sana uygun proje ve öğrenme adımlarını önerir. Takıldığın yerde asistan panelin içinde, mesai saati beklemiyor.",
  },
  {
    etiket: "Yol haritası",
    baslik: "Adım adım ilerleme",
    metin:
      "Taslak halindeyken sana görünmez; mentörün yayınladığı anda başlarsın. Tamamlanan her adım kayıt altında.",
  },
  {
    etiket: "Projeler",
    baslik: "Gerçek işler, gerçek repo",
    metin:
      "Proje şablonları GitHub deposuna bağlı. Ürettiğin şey staj bitince kaybolmuyor, portföyünde kalıyor.",
  },
  {
    etiket: "İletişim",
    baslik: "Mentörünle doğrudan",
    metin:
      "Mesajlaşma, adım yorumları, dosya paylaşımı ve öneri kutusu. Soru sormak için haftalık toplantı beklemiyorsun.",
  },
];

export function Platform() {
  return (
    <section
      id="platform"
      className="scroll-mt-[76px] border-t border-[var(--landing-line-soft)] py-[clamp(56px,8vw,96px)]"
    >
      <div className={KAP}>
        <div className="mb-[clamp(32px,5vw,52px)]">
          <BolumBasligi
            eyebrow="Platform"
            baslik="Staj sürecinin tamamı tek yerde."
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {OZELLIKLER.map((o, i) => (
            <Reveal
              as="article"
              key={o.etiket}
              delay={i * 60}
              className="flex flex-col gap-2.5 rounded-lg border border-[var(--landing-line-soft)] bg-[var(--landing-paper)] p-[clamp(20px,2.6vw,28px)] transition-[border-color,transform] hover:border-[var(--landing-line)] md:hover:-translate-y-0.5"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-[var(--landing-navy)]">
                {o.etiket}
              </span>
              <h3 className="text-[18.5px] font-extrabold tracking-[-0.02em]">
                {o.baslik}
              </h3>
              <p className="text-[15.5px] text-[var(--landing-muted)]">
                {o.metin}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Coverage() {
  return (
    <section
      id="kapsam"
      className="scroll-mt-[76px] border-t border-[var(--landing-line-soft)] py-[clamp(56px,8vw,96px)]"
    >
      <div className={KAP}>
        <BolumBasligi
          eyebrow="Kapsam"
          baslik="Sınırları kaldırıyor, haritalara değil yeteneğe odaklanıyoruz!"
          alt="Staj programımız artık sadece üç büyük şehrin sınırlarında kalmıyor; potansiyelin parladığı her yere ulaşıyoruz."
        />
      </div>
    </section>
  );
}

export function MadeByPosinowa() {
  return (
    <section
      id="posinowa"
      className="scroll-mt-[76px] border-t border-[var(--landing-line-soft)] bg-[var(--landing-paper-2)] py-[clamp(56px,8vw,96px)]"
    >
      <div className={`${KAP} grid items-start gap-[clamp(28px,4vw,56px)] lg:grid-cols-[1.1fr_1fr]`}>
        <Reveal>
          <Image
            src="/brand/posinowa-logo.webp"
            alt="Posinowa"
            width={36}
            height={34}
            className="mb-[22px] h-[34px] w-auto"
          />
          <Eyebrow>Arkasındaki ekip</Eyebrow>
          <h2 className="mt-3.5 text-pretty text-[clamp(26px,3.6vw,38px)] font-extrabold leading-[1.05] tracking-[-0.035em]">
            AISigner&apos;ı Posinowa geliştiriyor.
          </h2>
          <p className="mt-4 text-[var(--landing-muted)]">
            Posinowa Yazılım, Ankara Çukurambar&apos;da kurulu bir yazılım
            stüdyosu. Sürdürülebilir dijital ürünler geliştiriyoruz: işletmelere
            özel web platformları, mobil uygulamalar ve uzun vadede baktığımız
            sistemler.
          </p>
          <p className="mt-4 text-[var(--landing-muted)]">
            AISigner, kendi işe alma ve yetiştirme deneyimimizden çıktı. Stajyer
            ararken gördük ki yetenek her ilde var, fırsat değil. Bu yüzden kendi
            ekibimizi kurarken kullandığımız süreci bir ürüne dönüştürdük.
          </p>
        </Reveal>

        <Reveal delay={60}>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-[var(--landing-line)] bg-[var(--landing-line)]">
            {[
              ["Konum", "Çukurambar, Ankara", null],
              ["E-posta", "info@posinowa.com", "mailto:info@posinowa.com"],
              ["Telefon", "0545 304 26 18", "tel:+905453042618"],
              ["GitHub", "github.com/Posinowa", "https://github.com/Posinowa"],
            ].map(([k, v, href]) => (
              <li
                key={k as string}
                className="flex items-baseline gap-3.5 bg-[var(--landing-paper)] px-4 py-[13px] text-[15px]"
              >
                <span className="min-w-[88px] shrink-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--landing-muted)]">
                  {k}
                </span>
                {href ? (
                  <a
                    href={href as string}
                    target={
                      (href as string).startsWith("http") ? "_blank" : undefined
                    }
                    rel={
                      (href as string).startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="transition-colors hover:text-[var(--landing-navy)]"
                  >
                    {v}
                  </a>
                ) : (
                  <span>{v}</span>
                )}
              </li>
            ))}
          </ul>
          <a
            href="https://posinowa.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-[22px] inline-flex h-10 items-center justify-center rounded-md border border-[var(--landing-line)] px-[18px] text-[14.5px] font-semibold transition-colors hover:border-[var(--landing-muted)]"
          >
            posinowa.com&apos;u ziyaret et
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section
      id="kayit"
      className="scroll-mt-[76px] border-t border-[var(--landing-line-soft)] py-[clamp(56px,8vw,96px)] text-center"
    >
      <div className={`${KAP} max-w-[68ch]`}>
        <Reveal>
          <Eyebrow>Kayıt</Eyebrow>
          <h2 className="mt-3.5 text-pretty text-[clamp(28px,4.6vw,46px)] font-extrabold leading-[1.05] tracking-[-0.035em]">
            Bulunduğun il bir engel değil.
          </h2>
          <p className="mx-auto mt-4 max-w-[54ch] text-[var(--landing-muted)]">
            Hesabını aç ve profilini oluştur. İncelendikten sonra sana bir mentör
            ve bir yol haritası atanır.
          </p>
          <div className="mt-[30px] flex flex-wrap justify-center gap-3">
            <BirincilCta>Kayıt ol ve profilini oluştur</BirincilCta>
            <IkincilCta>Mentör olmak istiyorum</IkincilCta>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--landing-line-soft)] py-[34px]">
      <div className={`${KAP} flex flex-wrap items-center gap-x-[26px] gap-y-3.5`}>
        <Link
          href="/"
          className="flex items-center gap-[11px] text-[17px] font-extrabold tracking-[-0.03em]"
        >
          <Image
            src="/brand/aisigner-mark.png"
            alt="AISigner"
            width={30}
            height={26}
            className="h-[26px] w-auto"
          />
          <span className="h-5 w-px bg-[var(--landing-line)]" />
          AISigner
        </Link>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.17em] text-[var(--landing-muted)]">
          Posinowa Yazılım · Ankara
        </span>
        <nav aria-label="Alt menü" className="ml-auto flex gap-5">
          <a
            href="#nasil"
            className="text-[13.5px] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            Nasıl işliyor
          </a>
          <Link
            href="/terms"
            className="text-[13.5px] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            Koşullar
          </Link>
          <Link
            href="/privacy"
            className="text-[13.5px] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            Gizlilik
          </Link>
          <a
            href="mailto:info@posinowa.com"
            className="text-[13.5px] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            İletişim
          </a>
        </nav>
      </div>
    </footer>
  );
}
