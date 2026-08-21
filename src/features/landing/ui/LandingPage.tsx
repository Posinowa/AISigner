import { LandingHeader } from "./LandingHeader";
import {
  Hero,
  MapStage,
  Steps,
  Platform,
  Coverage,
  MadeByPosinowa,
  FinalCta,
  LandingFooter,
} from "./sections";

/**
 * Açılış sayfası — yalnızca oturumsuz ziyaretçiye gösterilir.
 *
 * #landing-tek-tema: kök sarmalayıcıdaki `.landing` sınıfı hem palet
 * tokenlarını hem de zemini taşır. Kullanıcının teması koyu olsa bile bu
 * sayfa açık kalır (bkz. globals.css).
 *
 * GÜVENLİK: Bu bileşen ve altındakiler oturum verisi ALMAZ. İçerik tamamen
 * statiktir; kullanıcıya özel hiçbir şey render edilmez.
 */
export function LandingPage() {
  return (
    <div className="landing min-h-screen font-[family-name:var(--font-geist-sans)] antialiased">
      <LandingHeader />
      <main id="top">
        <Hero />
        <MapStage />
        <Steps />
        <Platform />
        <Coverage />
        <MadeByPosinowa />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
