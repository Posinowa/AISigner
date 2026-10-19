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
