// src/features/projects/server/templates.ts
import { prisma } from "@/lib/db";
import { projeYukleriniGetir } from "./yuk";

export type CreateTemplateData = {
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
  githubRepoUrl?: string | null;
  /** #253: Şablonu oluşturan kişi. Sahiplik kontrolü buna dayanıyor. */
  createdById?: string | null;
  /** #503: Aynı stajyere birden çok kez atanabilir mi? Varsayılan false. */
  tekrarlanabilir?: boolean;
};

// #253: Sahip güncellemeyle DEĞİŞTİRİLEMEZ — aksi halde mentör bir şablonun
// sahipliğini kendine geçirebilirdi.
export type UpdateTemplateData = Partial<Omit<CreateTemplateData, "createdById">>;

// #112: Prisma unique ihlalini (P2002) route'un 409'a çevirebileceği
// ayırt edilebilir bir hataya dönüştürür (unassignProject'teki code kalıbı).
function throwIfDuplicateTitle(error: unknown): void {
  if ((error as { code?: string })?.code === "P2002") {
    const err = new Error("Bu başlıkta bir proje şablonu zaten var.") as Error & {
      code?: string;
    };
    err.code = "DUPLICATE_TITLE";
    throw err;
  }
}

/**
 * Şablon listesi + her şablonda ŞU AN kaç stajyerin çalıştığı (#499).
 *
 * ⚠️ YÜK LİSTE SORGUSUNDAN GELİR, şablon başına ayrı istek DEĞİL. Şablon
 * başına sayım N+1 üretirdi; `projeYukleriniGetir` tek toplama sorgusu
 * çalıştırıyor ve dönen satır sayısı ŞABLON kadar (#313 dersi).
 */
export async function listTemplates() {
  try {
    const [sablonlar, yukler] = await Promise.all([
      prisma.projectTemplate.findMany({
        // #366: Stajyer önerisinden türeyen şablonlar ORTAK HAVUZDA görünmez.
        // Aksi halde her onaylanan öneri, tüm mentörlerin gördüğü listeyi
        // şişirirdi ve o şablon aslında tek bir stajyere özel.
        where: { fromProposal: false },
        orderBy: {
          createdAt: "desc",
        },
      }),
      projeYukleriniGetir(),
    ]);

    return sablonlar.map((s) => ({
      ...s,
      /** #499: Şu an bu projede çalışan stajyer sayısı (0 olabilir). */
      calisanSayisi: yukler.get(s.id) ?? 0,
    }));
  } catch (error) {
    console.error("Error listing templates:", error);
    return [];
  }
}

export async function createTemplate(data: CreateTemplateData) {
  try {
    return await prisma.projectTemplate.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        track: data.track,
        githubRepoUrl: data.githubRepoUrl ?? null,
        createdById: data.createdById ?? null,
        // #503: Varsayılan false — tekrar edilebilirlik istisna.
        tekrarlanabilir: data.tekrarlanabilir ?? false,
      },
    });
  } catch (error) {
    console.error("Error creating template:", error);
    throwIfDuplicateTitle(error);
    throw new Error("Failed to create template");
  }
}

export async function updateTemplate(id: string, data: UpdateTemplateData) {
  try {
    return await prisma.projectTemplate.update({
      where: { id },
      data,
    });
  } catch (error) {
    console.error("Error updating template:", error);
    throwIfDuplicateTitle(error);
    throw new Error("Failed to update template");
  }
}

export async function deleteTemplate(id: string) {
  try {
    await prisma.projectTemplate.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    throw new Error("Failed to delete template");
  }
}

export async function getTemplateById(id: string) {
  try {
    return await prisma.projectTemplate.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error("Error getting template:", error);
    return null;
  }
}