import { prisma } from "@/lib/db";
import type { SuggestionStatus, SuggestionType } from "@prisma/client";

/**
 * #147: Öneri & İstek modülünün veri katmanı.
 *
 * Kural: öğrenci yalnızca **kendi** kayıtlarını görür (author scope'u sorguya
 * gömülüdür, route seviyesinde filtre unutulamaz). Admin tümünü görür.
 */

/** Öğrenciye de gösterilen alanlar — yazar bilgisi hariç. */
const ownSelect = {
  id: true,
  type: true,
  title: true,
  content: true,
  status: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Admin listesi — yazarın kimliği de gerekir (hash asla seçilmez). */
const adminSelect = {
  ...ownSelect,
  reviewedAt: true,
  author: {
    select: { id: true, name: true, lastName: true, email: true },
  },
  reviewedBy: {
    select: { id: true, name: true, lastName: true },
  },
} as const;

export async function createSuggestion(input: {
  authorId: string;
  type: SuggestionType;
  title: string;
  content: string;
}) {
  return prisma.suggestion.create({
    data: input,
    select: ownSelect,
  });
}

/** Bir kullanıcının kendi gönderdiği öneri/istekler (en yeni önce). */
export async function listOwnSuggestions(authorId: string) {
  return prisma.suggestion.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    select: ownSelect,
  });
}

/** Tüm kayıtlar (admin). Açık olanlar önce gelsin diye status'e göre de sıralanır. */
export async function listAllSuggestions(status?: SuggestionStatus) {
  return prisma.suggestion.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: adminSelect,
  });
}

/**
 * Admin durum/not günceller. `status` verildiyse inceleme bilgisi de damgalanır.
 * Kayıt yoksa `null` döner (route 404'e çevirir).
 */
export async function updateSuggestion(
  id: string,
  data: { status?: SuggestionStatus; adminNote?: string },
  reviewedById: string,
) {
  const exists = await prisma.suggestion.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return null;

  return prisma.suggestion.update({
    where: { id },
    data: {
      ...data,
      reviewedById,
      reviewedAt: new Date(),
    },
    select: adminSelect,
  });
}
