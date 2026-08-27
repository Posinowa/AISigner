"use client";

import { PosinowaYukleniyor } from "./PosinowaYukleniyor";

/**
 * #285: Giriş başarılı olduktan sonraki geçiş perdesi.
 *
 * Giriş, `window.location.href = "/"` ile SERT yönlendirme yapıyor; ardından
 * sunucu kullanıcıyı kendi paneline yönlendiriyor. Bu iki adım boyunca
 * kullanıcı hâlâ giriş formuna bakıyor ve hiçbir şey olmuyormuş gibi
 * görünüyor — form ise `disabled` olduğu için tıklamaya da yanıt vermiyor.
 *
 * Perde o boşluğu dolduruyor: ani sıçramayı yumuşatıyor ve sistemin
 * çalıştığını gösteriyor.
 *
 * Yalnızca geçiş sırasında basılır; kalıcı bir süs değil.
 */
export function GecisPerdesi({ mesaj = "Panelinize yönlendiriliyorsunuz..." }: { mesaj?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-slate-50/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <PosinowaYukleniyor boyut={88} dekoratif />
      <p className="text-sm font-medium text-slate-600">{mesaj}</p>
    </div>
  );
}
