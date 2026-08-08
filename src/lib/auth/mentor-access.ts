// #195: Öğrenci ↔ mentör ilişkisi artık M:N (MentorAssignment join tablosu).
// Bir mentörün bir öğrenciye erişim yetkisi, o öğrencinin mentor atamalarında
// yer alıp almamasıyla belirlenir. Eski `studentProfile.mentorId === userId`
// tek-eşleşme kontrolünün yerine bu yardımcı kullanılır.
//
// Kullanım: sorguya `mentorAssignments: { select: { mentorId: true } }` ekleyip
// dönen listeyi buraya geçir.
export function isAssignedMentor(
  mentorAssignments: { mentorId: string }[] | null | undefined,
  mentorUserId: string | null | undefined,
): boolean {
  if (!mentorUserId || !mentorAssignments) return false;
  return mentorAssignments.some((a) => a.mentorId === mentorUserId);
}
