import { toast } from "sonner";

/**
 * Öğrencinin adım durumunu değiştirmesi (#416).
 *
 * ⚠️ ÇAĞRI TEK YERDE. Odak kartı ile yol haritası listesi aynı işi yapıyor;
 * `fetch` + hata mesajı iki bileşene kopyalansaydı biri güncellenip diğeri
 * unutulduğunda iki yüzey farklı davranırdı. Bu kod tabanında tekrarlanmış
 * bir hata sınıfı (#367/#370/#376/#393).
 *
 * Mezuniyet kapısı burada: sunucu da 403 döndürüyor (#208), ama kullanıcıya
 * ağ turu beklettikten sonra değil hemen söylemek daha dürüst.
 */
export async function adimDurumunuGuncelle(params: {
  stepId: string;
  yeniDurum: "IN_PROGRESS" | "COMPLETED";
  mezunMu: boolean;
}): Promise<boolean> {
  if (params.mezunMu) {
    toast.info("Mezuniyet sonrası staj adımları salt-okunur durumdadır.");
    return false;
  }

  try {
    const res = await fetch(`/api/student/steps/${params.stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: params.yeniDurum }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(typeof err.error === "string" ? err.error : "Bir hata oluştu.");
      return false;
    }
    return true;
  } catch {
    toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    return false;
  }
}
