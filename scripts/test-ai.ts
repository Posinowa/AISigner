/**
 * Vertex AI bağlantı testi.
 * Çalıştır: npx tsx scripts/test-ai.ts
 * (GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS env'leri gerekir)
 */
import { getTextModel, getModel } from "../src/lib/ai/gemini-client";

async function main() {
  console.log("🔌 Vertex AI bağlantısı test ediliyor...");
  console.log("   Proje :", process.env.GOOGLE_CLOUD_PROJECT);
  console.log("   Konum :", process.env.GOOGLE_CLOUD_LOCATION || "us-central1");
  console.log("   Anahtar:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

  // 1) Düz metin (chat) yolu — getTextModel
  const textModel = getTextModel();
  const r1 = await textModel.generateContent("Tek kısa cümleyle kendini Türkçe tanıt.");
  const text = r1.response.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("\n✅ [1/2] Düz metin (chat) yanıt verdi:");
  console.log("   " + (text ?? "(boş yanıt)"));

  // 2) JSON yolu — getModel (profil analizi / proje önerileri bunu kullanır)
  const jsonModel = getModel();
  const r2 = await jsonModel.generateContent(
    'Sadece şu JSON\'u döndür: {"durum":"ok","mesaj":"<tek kelime selam>"}'
  );
  const raw = r2.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  console.log("\n✅ [2/2] JSON modu geçerli JSON döndürdü:");
  console.log("   ", parsed);
}

main().catch((e) => {
  console.error("\n❌ BAŞARISIZ:", e?.message || e);
  if (e?.message?.includes("PERMISSION_DENIED") || e?.message?.includes("403")) {
    console.error("   → Servis hesabına 'Vertex AI User' rolü verilmemiş olabilir.");
  }
  if (e?.message?.includes("has not been used") || e?.message?.includes("SERVICE_DISABLED")) {
    console.error("   → Vertex AI API (aiplatform.googleapis.com) projede etkin değil.");
  }
  if (e?.message?.includes("billing")) {
    console.error("   → Projede faturalandırma (billing) etkin değil.");
  }
  process.exit(1);
});
