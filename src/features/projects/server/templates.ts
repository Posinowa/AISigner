// src/features/projects/server/templates.ts
import { prisma } from "@/lib/db";

export type CreateTemplateData = {
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
};

export type UpdateTemplateData = Partial<CreateTemplateData>;

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
      },
    });
  } catch (error) {
    console.error("Error creating template:", error);
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