import type { CertificateData } from "@/features/certificate/server/certificate";
/**
 * #235: Sayfadaki tum stil kurallarini METIN olarak toplar.
 *
 * Neden `<link rel="stylesheet">` etiketini kopyalamiyoruz: indirilen dosya
 * diske kaydedilip acildiginda `/_next/static/css/...` yolu `file:///_next/...`
 * olarak cozulur, hicbir stil yuklenmez ve sertifika ciplak HTML olarak gorunur.
 * Ayni sekilde yazdirma cercevesinde de ag beklemesi gerekmez.
 *
 * Ayni kaynakli stil sayfalarinin `cssRules` erisimi acik; farkli kaynakli
 * olanlar (varsa) sessizce atlanir.
 */
export function stilKurallariniTopla(): string {
  let css = "";
  for (const sayfa of Array.from(document.styleSheets)) {
    try {
      for (const kural of Array.from(sayfa.cssRules)) {
        css += kural.cssText + "\n";
      }
    } catch {
      // farkli kaynakli stil sayfasi — okunamaz, atla
    }
  }
  return css;
}

/** Sertifikanın tek dosyalık HTML belgesi (indirme için). */
export function sertifikaBelgeHtml(studentName: string, stylesHtml: string, govdeHtml: string): string {
  return `      <!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Posinowa Staj Başarı Sertifikası - ${studentName}</title>
  ${stylesHtml}
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      background: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 24px 12px;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    .cert-wrapper {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border-radius: 24px;
      overflow: hidden;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .cert-wrapper {
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="cert-wrapper">
    ${govdeHtml}
  </div>
</body>
</html>`;
}

export function sertifikaYazdir(certificate: CertificateData): void {
  // İzole yazdırma: ana sayfa layout'undan tamamen bağımsız A4 iframe oluştur
  const printArea = document.getElementById("certificate-print-area");
  if (!printArea) {
    window.print();
    return;
  }

  try {
    const iframe = document.createElement("iframe");
    // #235: 0x0 iframe kullanma. Tarayicilarin bir kismi sifir boyutlu
    // iframe'in icerigine layout uygulamaz ve print() bos sayfa uretir.
    // Gercek A4 olcusu verip cerceveyi ekranin disina aliyoruz.
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Ana sayfadaki tüm Tailwind ve font stillerini iframe'e kopyala
    const stylesHtml = `<style>${stilKurallariniTopla()}</style>`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8" />
          <title>Sertifika - ${certificate.studentName}</title>
          ${stylesHtml}
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            }
            #certificate-print-area {
              padding: 4px !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              display: block !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          ${printArea.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      window.print();
      return;
    }

    const temizle = () => iframe.remove();

    const yazdir = async () => {
      // #235: Temizligi EN BASTA kaydet. Asagidaki bekleme ne olursa olsun
      // (fonts API takilsa, hata atsa) cerceve DOM'da unutulmaz.
      // iframe 1sn sonra degil, yazdirma bitince kaldirilir — diyalog
      // acikken DOM'dan cikarilirsa cikti bozulur.
      win.addEventListener("afterprint", temizle, { once: true });
      // afterprint her tarayicida tetiklenmiyor → guvenlik agi
      setTimeout(temizle, 120_000);

      // #235: Sabit 250ms gecikme yerine gercek hazir olma sinyali.
      // Kopyalanan <link rel=stylesheet> ve yazi tipleri inmeden print()
      // cagrilirsa cikti bicimsiz ya da bos olur. Bekleme SINIRLI: yazi
      // tipleri hic gelmezse yazdirmayi sonsuza kadar engellemesin.
      try {
        await Promise.race([
          doc.fonts?.ready ?? Promise.resolve(),
          new Promise((r) => setTimeout(r, 2_000)),
        ]);
      } catch {
        // fonts API yoksa/basarisizsa yazdirmaya yine de devam et
      }

      win.focus();
      win.print();
    };

    if (doc.readyState === "complete") {
      void yazdir();
    } else {
      win.addEventListener("load", () => void yazdir(), { once: true });
    }
  } catch (e) {
    console.error("Print error:", e);
    window.print();
  }
}
