import { DogrulanmisRozet } from "@/features/auth/ui/DogrulanmisRozet";
import { AvatarUpload } from "@/features/profile/ui/AvatarUpload";
import { RoadmapSteps } from "@/features/student/ui/RoadmapSteps";
import { revizyonGerekceleri } from "@/features/roadmap/server/revizyon";
import { ProjeOnerisi } from "@/features/proposals/ui/ProjeOnerisi";
import { TakilmaBildirimiAyari } from "@/features/radar/ui/TakilmaBildirimiAyari";
import { OfisSaatiOgrenci } from "@/features/ofis-saati/ui/OfisSaatiOgrenci";
import { IdariBolum } from "@/features/dashboard/ui/IdariBolum";
import { odaktakiAdimIndeksi } from "@/features/roadmap/odak";
import { OdakKarti } from "@/features/roadmap/ui/OdakKarti";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { Clock, Briefcase, Target, Github, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { StudentCertificateTrigger } from "@/features/student/ui/StudentCertificateTrigger";
import { PanelKarsilama } from "@/features/dashboard/ui/PanelKarsilama";
import { ProfilTamamlaSeridi } from "@/features/dashboard/ui/ProfilTamamlaSeridi";
import { stajyerDurumu, PROJELER_CAPASI } from "@/features/dashboard/models/stajyerDurumu";

/**
 * #416/#332: Adımı başkası üstlendiyse adını çözer, yoksa null.
 *
 * ⚠️ `assignee` yalnız TAKIM sorgusunda seçiliyor; bireysel atamada
 * `assigneeId` zaten hep NULL (şemada yazılı) ve alan hiç çekilmiyor. Bu
 * yüzden alanın varlığı isteğe bağlı okunuyor.
 */
function ustlenenAdiCoz(
  adim: {
    assigneeId?: string | null;
    assignee?: { name: string | null; lastName: string | null } | null;
  },
  kullaniciId: string,
): string | null {
  if (!adim.assigneeId || adim.assigneeId === kullaniciId) return null;
  const ad = [adim.assignee?.name, adim.assignee?.lastName].filter(Boolean).join(" ");
  return ad || "Bir takım arkadaşın";
}

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p>Oturum açmanız gerekiyor.</p>;

  // #38: Onaylanmamış stajyer (PENDING/REJECTED) panele erişemez.
  // GRADUATED stajyerler projelerini ve adımlarını incelemeye devam edebilir.
  const accountStatus = session.user.accountStatus;
  const isGraduated = accountStatus === "GRADUATED";
  if (accountStatus && accountStatus !== "APPROVED" && !isGraduated) {
    const rejected = accountStatus === "REJECTED";
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-10 max-w-lg w-full space-y-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              rejected ? "bg-red-50" : "bg-amber-50"
            }`}
          >
            <Clock className={`w-8 h-8 ${rejected ? "text-red-600 " : "text-amber-600 "}`} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {rejected ? "Başvurunuz reddedildi" : "Hesabınız onay bekliyor"}
          </h1>
          <p className="text-slate-600 leading-relaxed">
            {rejected
              ? "Hesabınız bir yönetici tarafından reddedildi. Sorunuz varsa lütfen ekiple iletişime geçin."
              : "Kaydınız alındı. Bir yönetici hesabınızı onayladıktan sonra panele erişebilirsiniz."}
          </p>
        </div>
      </div>
    );
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      assignedProjects: {
        include: {
          projectTemplate: true,
          roadmap: {
            include: {
              steps: {
                orderBy: { order: "asc" }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
      },
      // #195: M:N — "mentörün var mı?" kontrolü için atamalar.
      mentorAssignments: { select: { mentorId: true } },
      // #367: TAKIM ATAMALARI AYRI GELİR.
      //
      // `assignedProjects` yalnız `studentProfileId` dolu satırları getiriyor;
      // takım atamasında o alan NULL (sahiplik `teamId` üzerinden, #332).
      // Bu olmadan takım üyesi kendi panosunda projesini HİÇ göremiyordu.
      teamMemberships: {
        where: { leftAt: null },
        select: {
          team: {
            select: {
              id: true,
              name: true,
              members: {
                where: { leftAt: null },
                select: {
                  role: true,
                  studentProfile: {
                    select: { user: { select: { id: true, name: true, lastName: true, email: true } } },
                  },
                },
              },
              assignedProjects: {
                include: {
                  projectTemplate: true,
                  roadmap: {
                    include: {
                      steps: {
                        orderBy: { order: "asc" },
                        include: {
                          assignee: { select: { id: true, name: true, lastName: true, email: true } },
                        },
                      },
                    },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-10 max-w-lg w-full space-y-6">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <Briefcase className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Kariyer Yolculuğunuz Başlıyor</h1>
          <p className="text-slate-600 leading-relaxed">
            Sizi doğru mentörle eşleştirebilmemiz ve sektörel yetkinliklerinize uygun projeler atayabilmemiz için profesyonel profilinizi tamamlamanız gerekmektedir.
          </p>
          <div className="pt-4">
            <Link
              href="/profile-setup"
              className="inline-flex items-center justify-center w-full h-12 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-all"
            >
              Profilimi Oluştur
            </Link>
          </div>
        </div>
      </div>
    );
  }


  const firstName = session.user.name?.split(" ")[0] ?? "Öğrenci";

  /**
   * #367: BİREYSEL + TAKIM atamaları tek listede.
   *
   * Takım ataması `studentProfile.assignedProjects`'te GÖRÜNMEZ (o alan
   * `studentProfileId`'ye bakıyor, takımda NULL). Birleştirmeseydik takım
   * üyesi kendi panosunda hiçbir proje görmezdi.
   *
   * Her projeye ait takımı da taşıyoruz: üstlenme arayüzü yalnız takım
   * panosunda açılıyor.
   */
  const takimlar = profile.teamMemberships.map((u) => u.team);

  const tumProjeler = [
    ...profile.assignedProjects.map((p) => ({ ...p, takim: null as (typeof takimlar)[number] | null })),
    ...takimlar.flatMap((t) => t.assignedProjects.map((p) => ({ ...p, takim: t }))),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  /*
   * #379: Revizyon gerekçeleri.
   *
   * Gerekçe adımda değil GEÇMİŞTE duruyor (#324) — bir adım birden çok kez
   * revize edilebilir ve her seferin kendi gerekçesi var. TEK sorguyla
   * çekiliyor: adım başına ayrı sorgu, yol haritası uzadıkça N+1 üretirdi.
   */
  const revizyondakiAdimlar = tumProjeler.flatMap((p) =>
    (p.roadmap?.steps ?? [])
      .filter((a) => a.status === "REVISION_REQUESTED")
      .map((a) => a.id),
  );
  const gerekceler = await revizyonGerekceleri(revizyondakiAdimlar);

  /*
   * #416: BUGÜNÜN ODAĞI.
   *
   * ⚠️ Kural `roadmap/odak.ts`'te — pano, adım listesi ve odak kartı aynı
   * soruyu üç ayrı yerden yanıtlamasın (#367/#370/#376/#393'ün hata sınıfı).
   *
   * ⚠️ Öncelik "tamamlanmamış ilk adım"dan FARKLI: revizyon istenen adım
   * her şeyin önünde. Eski kural, 1. adım devam ederken 2. adım revizyona
   * düştüğünde mentörün geri gönderdiği işi hiç göstermiyordu.
   *
   * ⚠️ TASLAK yol haritasında öğrenci etkileşemez (#52/#405) — orada odak
   * kartı da çıkmıyor; göremediği adımları işaret etmek anlamsız olurdu.
   */
  const odakProjesi = tumProjeler.find(
    (p) => p.roadmap?.status === "PUBLISHED" && (p.roadmap?.steps.length ?? 0) > 0,
  );
  const odakAdimlari = odakProjesi?.roadmap?.steps ?? [];
  const odakIndeksi = odaktakiAdimIndeksi(odakAdimlari);
  const odakAdimi = odakIndeksi === null ? null : odakAdimlari[odakIndeksi];

  const odak =
    odakAdimi && odakProjesi
      ? {
          stepId: odakAdimi.id,
          baslik: odakAdimi.title,
          aciklama: odakAdimi.description,
          durum: odakAdimi.status,
          sira: odakAdimi.order,
          projeAdi: odakProjesi.projectTemplate.title,
          githubIssueUrl: odakAdimi.githubIssueUrl ?? null,
          revizyonGerekcesi: gerekceler.get(odakAdimi.id) ?? null,
          capa: `#adim-${odakAdimi.id}`,
          // #332: Takım panosunda adım başkasının üzerinde olabilir; "senin
          // sıradaki adımın" demek yanlış olurdu.
          ustlenenAdi: ustlenenAdiCoz(odakAdimi, session.user.id),
        }
      : null;

  // #290: Karşılama "sırada ne var" sorusuna cevap veriyor.
  // ⚠️ Odak kartı varken aynı adımı KARŞILAMADA DA göstermiyoruz: iki yerde
  // duran aynı bilgi, biri güncellenip diğeri unutulduğunda ayrışır.
  const { durum, siradaki } = stajyerDurumu({
    mezun: isGraduated,
    projeSayisi: tumProjeler.length,
    mentorSayisi: profile.mentorAssignments.length,
    siradakiAdim: odak ? { baslik: odak.baslik, projeAdi: odak.projeAdi } : null,
    siradakiAdimKartta: Boolean(odak),
  });

  // #265/#290: Fotoğrafın varlığı — arayüz depolama adına ihtiyaç duymuyor.
  // Bilgi oturumdan geliyor; JWT geri çağrısı her istekte kullanıcıyı zaten
  // DB'den okuduğu için burada AYRI bir sorgu atmak gereksizdi.
  const fotografVar = session.user.fotografVar === true;

  return (
    <div className="max-w-5xl mx-auto mt-8 p-6 space-y-8">
      {/* 🎓 Mezun Stajyer Tebrik & Başarı Kartı

          #323: Kart MARKA paletine çekildi. Önceden mor tonlar
          kullanıyordu; mor marka renklerinde YOK — tokenlar logo laciverti
          (--color-primary #23356c) ve logonun orta mavisi (--landing-mid
          #3e92cc). Açılış sayfasıyla panel arasındaki renk dikişini kapatan
          #237 kararının devamı. */}
      {isGraduated && (
        <div className="rounded-3xl bg-gradient-to-r from-primary via-[#1b2a55] to-slate-900 text-primary-foreground p-6 sm:p-8 shadow-xl border border-[#3e92cc]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#3e92cc]/20 rounded-full blur-3xl" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-4">
              {/* #323: Jenerik GraduationCap yerine AISigner markası — #237'de
                  AppShell için verilen kararın aynısı. Mezuniyet kartı
                  öğrencinin gördüğü en "resmi" ekran; marka orada olmalı. */}
              <div className="w-14 h-14 rounded-2xl bg-white/95 shrink-0 shadow-lg flex items-center justify-center p-2">
                <Image
                  src="/brand/aisigner-mark.png"
                  alt=""
                  width={37}
                  height={32}
                  className="h-8 w-auto"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#3e92cc]/20 text-[#9ecbee] border border-[#3e92cc]/40 mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Posinowa Staj Mezuniyeti
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Stajınız Başarıyla Tamamlandı!
                </h2>
                <p className="mt-2 text-slate-200/90 text-sm sm:text-base leading-relaxed max-w-2xl">
                  Posinowa bünyesinde yaptığınız staj başarıyla tamamlanmıştır. Çalıştığınız projeleri, tamamladığınız yol haritası adımlarını ve tüm dosya/geliştirme geçmişinizi aşağıda incelemeye devam edebilirsiniz. Gelecek kariyerinizde ve profesyonel hayatınızda başarılarınızın devamını dileriz!
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" /> Staj Tamamlandı
              </span>
              <StudentCertificateTrigger />
            </div>
          </div>
        </div>
      )}

      {/* #290: Karşılama — kimsin, nerede duruyorsun, sırada ne var.
          Fotoğraf yükleme ve e-posta doğrulama gibi idari işler buradan
          çıkarıldı; artık yalnızca EKSİK olduklarında aşağıdaki şeritte. */}
      <PanelKarsilama
        ad={isGraduated ? `${firstName} · Mezun Stajyer` : firstName}
        basHarfler={firstName.slice(0, 2).toUpperCase()}
        userId={session.user.id}
        fotografVar={fotografVar}
        durum={durum}
        siradaki={siradaki}
        rozet={
          /* #259: Yalnızca OLUMLU ibare karşılamada. Doğrulanmamış uyarısı
             ismin yanında değil, profil şeridinde duruyor. */
          <DogrulanmisRozet
            emailVerified={session.user.emailVerified}
            dogrulanmamisiGoster={false}
          />
        }
      />

      <ProfilTamamlaSeridi
        emailVerified={session.user.emailVerified}
        fotografVar={fotografVar}
      />

      {/* #416: Bugünün odağı — karşılamanın hemen altında, çalışma alanının
          üstünde. Ölçüm (#415): ilk adım kartı 1.5 ekran aşağıdaydı; GitHub'a
          gitmek ya da adımı tamamlamak için oraya kadar kaydırmak gerekiyordu.

          ⚠️ Mezun stajyerde SALT OKUNUR (#208): portfolyo görünür kalıyor
          ama yazma uçları kapalı. */}
      {odak && <OdakKarti odak={odak} saltOkunur={isGraduated} />}

      {/* #398: Mentör görüşmesi. Mezun stajyere de AÇIK — #208 ayrımında
          görüşme, mesajlaşma gibi *insan iletişimi* kanalı.

          ⚠️ #415'te KATLANMADI: rezerve edilmiş bir görüşme zamana bağlı
          bilgidir; bir tıkın arkasına saklanırsa kaçırılır. */}
      <div className="mb-8">
        <OfisSaatiOgrenci kullaniciId={session.user.id} />
      </div>

      {/* #415: Her gün kullanılmayan idari araçlar tek katlanır bölümde.
          Ölçüldü: bu üç blok birlikte 1022px yer kaplıyordu ve çalışma
          alanını 2.6 ekran aşağı itiyordu. */}
      <IdariBolum
        /* Özet, AŞAĞIDA RENDER EDİLENLERLE aynı koşullardan kuruluyor —
           mezunda form yokken başlık onu duyurmasın. */
        ozet={[
          ...(isGraduated
            ? []
            : [
                `Takılma bildirimi: ${profile.takilmaBildirimi ? "açık" : "kapalı"}`,
                "Kendi projeni öner",
              ]),
          "Profil fotoğrafı",
        ]}
        /* Fotoğraf eksikse üstteki şeridin `#profil` bağlantısı buraya
           geliyor — blok kapalıyken o bağlantı ölü kalıyordu. */
        varsayilanAcik={!fotografVar}
      >
        {/* #397: Takılma bildirimi tercihi. Ayarın ADI ve DURUMU katlanmış
            özette de yazıyor — opt-in'in fark edilmemesi bilinen bedeldi. */}
        {!isGraduated && <TakilmaBildirimiAyari baslangic={profile.takilmaBildirimi} />}

        {/* #366: Kendi projeni öner. Mezun stajyer yeni proje öneremez —
            #208'deki "sistem durumunu değiştiren uçlar kapalı" ilkesi. */}
        {!isGraduated && <ProjeOnerisi />}

        {/* #290: Fotoğraf yönetimi. Üstteki şerit fotoğraf eksikken buraya
            bağ veriyor — çapa korunuyor. */}
        <section id="profil" className="scroll-mt-24">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Profil fotoğrafı</h3>
          <AvatarUpload
            userId={session.user.id}
            basHarfler={firstName.slice(0, 2).toUpperCase()}
            fotografVar={fotografVar}
            ad={session.user.name}
          />
        </section>
      </IdariBolum>

      {/* #290: Karşılamadaki "Sırada" bağlantısının hedefi. */}
      <div id={PROJELER_CAPASI.slice(1)} className="scroll-mt-24">
        <h2 className="text-xl font-bold mb-6 flex items-center text-slate-900 border-b border-slate-200 pb-3">
          <Target className="w-5 h-5 mr-2 text-slate-700" />
          Aktif Projeler ve İş Akışı
        </h2>

        {tumProjeler.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
            <Clock className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <h3 className="text-slate-900 font-semibold text-lg">Bekleyen Görev Yok</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
              Şu anda aktif bir proje atamanız bulunmuyor. Mentörünüz teknik gelişiminize uygun bir yol haritası oluşturduğunda burada görünecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {tumProjeler.map((project) => {
              
              const steps = project.roadmap?.steps || [];
              const totalSteps = steps.length;
              const completedSteps = steps.filter(s => s.status === "COMPLETED").length;
              const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
              const isDraft = project.roadmap?.status === "DRAFT";

              return (
                <div key={project.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  
                  {/* Proje Üst Bilgi (Header) */}
                  <div className="p-6 md:p-8 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold tracking-wide">
                            {project.takim ? "TAKIM PROJESİ" : "ANA PROJE"}
                          </span>
                          {/* #367: Ortak panoda kiminle çalıştığını bilmek,
                              iş bölümü yapabilmenin ön koşulu. */}
                          {project.takim && (
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold">
                              {project.takim.name} ·{" "}
                              {project.takim.members
                                .map(
                                  (m) =>
                                    [m.studentProfile.user.name, m.studentProfile.user.lastName]
                                      .filter(Boolean)
                                      .join(" ") || m.studentProfile.user.email,
                                )
                                .join(", ")}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Atanma: {new Date(project.createdAt).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                        <h3 className="font-bold text-2xl text-slate-900 tracking-tight">
                          {project.projectTemplate.title}
                        </h3>
                        {/* #91: Açıklama markdown olarak render edilir. */}
                        <MarkdownContent className="mt-2 max-w-3xl">
                          {project.projectTemplate.description}
                        </MarkdownContent>
                        {project.projectTemplate.githubRepoUrl && (
                          <a
                            href={project.projectTemplate.githubRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 mt-2 transition-colors"
                          >
                            <Github className="w-3.5 h-3.5" />
                            {project.projectTemplate.githubRepoUrl.replace(/^https:\/\/github\.com\//, "")}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Minimal İlerleme Çubuğu */}
                    <div className="mt-6 max-w-md">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
                        <span>Tamamlanma Oranı</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2 bg-slate-100" />
                    </div>
                  </div>

                  {/* İş Akışı (Roadmap Steps) */}
                  <div className="p-6 md:p-8 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-semibold text-slate-900 flex items-center">
                        Proje Aşamaları
                        <span className="ml-3 text-sm font-normal text-slate-500">
                          ({completedSteps}/{totalSteps} tamamlandı)
                        </span>
                      </h4>
                      {isDraft && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 rounded-md">
                          Taslak (Mentör Onayı Bekliyor)
                        </span>
                      )}
                    </div>

                    {totalSteps === 0 ? (
                      <div className="text-center py-10 bg-white rounded-lg border border-dashed border-slate-300">
                        <p className="text-slate-500 text-sm">İş akışı oluşturuluyor...</p>
                      </div>
                    ) : (
                      <RoadmapSteps
                        // #379: Gerekçe adımın yanına iliştiriliyor; bileşen
                        // yalnız REVISION_REQUESTED durumunda gösteriyor.
                        steps={steps.map((a) => ({
                          ...a,
                          revizyonGerekcesi: gerekceler.get(a.id) ?? null,
                        }))}
                        isDraft={isDraft}
                        isGraduated={isGraduated}
                        currentUserId={session.user.id}
                        currentUserRole={session.user.role}
                        // #367: Üstlenme arayüzü YALNIZ takım panosunda açılır;
                        // bireysel atamada tek kişi var, "üstlenme"nin anlamı yok.
                        takimUyeleri={
                          project.takim
                            ? project.takim.members.map((m) => ({
                                userId: m.studentProfile.user.id,
                                ad:
                                  [m.studentProfile.user.name, m.studentProfile.user.lastName]
                                    .filter(Boolean)
                                    .join(" ") || m.studentProfile.user.email,
                                role: m.role,
                              }))
                            : undefined
                        }
                      />
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}