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

/**
 * #163: Cursor tabanlı sayfalama sonucu. `nextCursor` null ise son sayfadayız.
 * `take: limit + 1` hilesiyle "daha fazlası var mı" fazladan sorgu atmadan bulunur.
 */
export type SuggestionPage<T> = { items: T[]; nextCursor: string | null };

type PageParams = { cursor?: string; limit?: number };

function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
): SuggestionPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

/** Bir kullanıcının kendi gönderdiği öneri/istekler (en yeni önce), sayfalanmış. */
export async function listOwnSuggestions(
  authorId: string,
  { cursor, limit = 20 }: PageParams = {},
) {
  const rows = await prisma.suggestion.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    // cursor verilmişse "o kayıttan sonrasını getir".
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: ownSelect,
  });
  return paginate(rows, limit);
}

/** Tüm kayıtlar (admin), sayfalanmış. Açık olanlar önce gelsin diye status'e göre de sıralanır. */
export async function listAllSuggestions(
  { status, cursor, limit = 20 }: PageParams & { status?: SuggestionStatus } = {},
) {
  const rows = await prisma.suggestion.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: adminSelect,
  });
  return paginate(rows, limit);
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
