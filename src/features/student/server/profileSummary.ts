// features/student/server/profileSummary.ts

export type ProfileSummaryResponse = {
  level: string
  tracks: string[]
  summary: string
}

// Sahte (mock) AI fonksiyonu
export async function getMockProfileSummary(input: {
  experienceLevel: string
  interests: string[]
  goals: string
}): Promise<ProfileSummaryResponse> {
  // İlgi alanlarına göre sahte öğrenme yolları
  const tracks = input.interests.map((interest) => {
    if (interest.toLowerCase().includes("ai")) return "AI Başlangıç Yolu"
    if (interest.toLowerCase().includes("web")) return "Frontend Geliştirme"
    if (interest.toLowerCase().includes("data")) return "Veri Bilimi Temelleri"
    return `${interest} için Genel Öğrenme Yolu`
  })

  // Özet açıklama metni
  const summary = `Bu kullanıcı ${input.experienceLevel} seviyesinde. İlgi alanları: ${input.interests.join(", ")}. Hedefi: ${input.goals}.`

  return {
    level: input.experienceLevel,
    tracks,
    summary,
  }
}
