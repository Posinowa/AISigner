/**
 * #325: `act(...)` uyarılarını HATAYA çevirir.
 *
 * NEDEN: Bu uyarılar 23'e kadar birikmişti ve hepsinin tek bir kaynağı vardı —
 * `vi.waitFor` kullanımı. RTL'in `waitFor`'ı beklediği içeriği `act()` ile sarar,
 * vitest'in `vi.waitFor`'ı sarmaz; arada gerçekleşen state güncellemeleri React
 * tarafından "act dışında" sayılır.
 *
 * Uyarı olarak kaldıkları sürece iki zarar veriyorlardı:
 *  - testler asenkron re-render'ları doğru beklemiyordu (yanlış güven),
 *  - gürültü, GERÇEK bir uyarının fark edilmesini engelliyordu.
 *
 * Bu yüzden uyarı değil hata: bir daha sessizce birikemesin.
 *
 * KAPSAM DAR: yalnızca act uyarısı yakalanır. Diğer `console.error` çağrıları
 * dokunulmadan geçer — kod tabanında hata yollarını bilerek loglayan ve bunu
 * doğrulayan testler var (ör. `sendMail` başarısızlığı), onları kırmamalı.
 */
const gercekConsoleError = console.error;

console.error = (...args: unknown[]) => {
  const ilk = args[0];
  if (typeof ilk === "string" && ilk.includes("not wrapped in act")) {
    throw new Error(
      "React act(...) uyarısı hataya çevrildi (#325).\n\n" +
        "En yaygın sebep: `vi.waitFor` kullanmak. Bunun yerine\n" +
        "`@testing-library/react`'ten gelen `waitFor`'ı kullanın — o, beklediği\n" +
        "içeriği act() ile sarar.\n\n" +
        "Orijinal uyarı: " +
        ilk,
    );
  }
  gercekConsoleError(...args);
};
