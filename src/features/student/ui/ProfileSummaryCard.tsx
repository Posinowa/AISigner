// features/student/ui/ProfileSummaryCard.tsx

type Props = {
  summary: string
  tracks: string[]
  level: string
}

export function ProfileSummaryCard({ summary, tracks, level }: Props) {
  const levelMap: Record<string, string> = {
    beginner: "Yeni Başlayan",
    intermediate: "Orta Seviye",
    advanced: "İleri Seviye",
  }

  const translatedLevel = levelMap[level] ?? level

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4 mt-6">
      <h2 className="text-xl font-semibold">Profil Özeti</h2>

      <div className="space-y-2 text-gray-700 text-sm">
        <p><strong>Seviye:</strong> {translatedLevel}</p>

        {/* summary metnini cümlelere ayırarak ayrı satırlarda göster */}
        {summary.split(". ").map((sentence, i) => (
          <p key={i}>{sentence.trim()}.</p>
        ))}
      </div>

      <div>
        <h3 className="font-medium mt-4">Önerilen Öğrenme Yolları:</h3>
        <ul className="list-disc list-inside text-gray-800">
          {tracks.map((track, i) => (
            <li key={i}>{track}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}