// src/features/projects/server/templates.ts
import { prisma } from "@/lib/db";

export type CreateTemplateData = {
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
  githubRepoUrl?: string | null;
};

export type UpdateTemplateData = Partial<CreateTemplateData>;

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

export async function listTemplates() {
  try {
    return await prisma.projectTemplate.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
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