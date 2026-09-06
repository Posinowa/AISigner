// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { IdariBolum } from "./IdariBolum";

/**
 * #415 — idari bloğun sözleşmesi.
 *
 * Ölçüm: öğrenci panosu 3 adımlık bir yol haritasıyla 3388px'ti ve ilk adım
 * kartı 2366px aşağıdaydı (2.6 ekran). Bu blok o yığını katlıyor.
 */
describe("IdariBolum — katlama", () => {
  it("varsayılan KAPALI — çalışma alanı yukarı çıksın", () => {
    const { container } = render(
      <IdariBolum ozet={["Bir şey"]}>
        <p>içerik</p>
      </IdariBolum>,
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  /*
   * ⚠️ CANLI TESTTE BULUNDU. `ProfilTamamlaSeridi`'nin "Fotoğraf ekle"
   * bağlantısı `#profil` çapasına gidiyor ve o çapa artık bu bloğun içinde.
   * Kapalı bir <details> içindeki çapaya tıklamak Chrome 148'de ne bloğu
   * açtı ne de sayfayı kaydırdı — bağlantı sessizce ölüyordu.
   */
  it("bekleyen iş varsa AÇIK açılır — içerideki çapa ölü kalmasın", () => {
    const { container } = render(
      <IdariBolum ozet={["Bir şey"]} varsayilanAcik>
        <p>içerik</p>
      </IdariBolum>,
    );
    expect(container.querySelector("details")).toHaveAttribute("open");
  });

  it("içerik kapalıyken de DOM'da — çapa ve form kaybolmuyor", () => {
    render(
      <IdariBolum ozet={["Bir şey"]}>
        <section id="profil">fotoğraf aracı</section>
      </IdariBolum>,
    );
    expect(document.getElementById("profil")).toBeInTheDocument();
  });
});

describe("IdariBolum — özet", () => {
  it("özet maddeleri katlanmış başlıkta okunur", () => {
    render(
      <IdariBolum ozet={["Takılma bildirimi: kapalı", "Kendi projeni öner"]}>
        <p>içerik</p>
      </IdariBolum>,
    );
    const ozet = screen.getByText(/Takılma bildirimi: kapalı/);
    expect(ozet).toBeInTheDocument();
    expect(ozet).toHaveTextContent("Kendi projeni öner");
  });

  /*
   * ⚠️ #397 takılma bildirimini bilerek GÖRÜNÜR yere koymuştu: opt-in'in
   * bilinen bedeli, tam da çekingen stajyerin ayarı fark etmemesiydi. Ayarı
   * sessizce gömmek o kararı zayıflatırdı — bu yüzden DURUMU başlıkta yazılı.
   */
  it("takılma bildiriminin DURUMU kapalıyken bile okunuyor", () => {
    render(
      <IdariBolum ozet={["Takılma bildirimi: açık"]}>
        <p>içerik</p>
      </IdariBolum>,
    );
    const d = document.querySelector("details");
    expect(d).not.toHaveAttribute("open");
    expect(screen.getByText(/Takılma bildirimi: açık/)).toBeInTheDocument();
  });

  /*
   * ⚠️ CANLI TESTTE BULUNDU. İlk sürüm özeti bileşenin içinde sabitliyordu;
   * mezun stajyerde başlık "Kendi projeni öner" diyordu ama form (doğru
   * şekilde) hiç render edilmiyordu — olmayan bir şeyi duyuruyordu.
   */
  it("özette YALNIZ verilen maddeler var — olmayan içerik duyurulmaz", () => {
    render(
      <IdariBolum ozet={["Profil fotoğrafı"]}>
        <p>içerik</p>
      </IdariBolum>,
    );
    expect(screen.queryByText(/Kendi projeni öner/)).not.toBeInTheDocument();
    expect(screen.getByText("Profil fotoğrafı")).toBeInTheDocument();
  });
});
