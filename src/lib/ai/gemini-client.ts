import { VertexAI } from "@google-cloud/vertexai";
import path from "path";

const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const CREDENTIALS_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "gcp-credentials.json";

let vertexAIInstance: VertexAI | null = null;

export function getVertexAI(): VertexAI {
  if (vertexAIInstance) return vertexAIInstance;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT ortam değişkeni tanımlı değil. .env dosyanızı kontrol edin."
    );
  }

  const keyFilename = path.resolve(process.cwd(), CREDENTIALS_PATH);

  vertexAIInstance = new VertexAI({
    project: projectId,
    location: LOCATION,
    googleAuthOptions: {
      keyFilename,
    },
  });

  return vertexAIInstance;
}

export function getModel(modelName: string = "gemini-2.0-flash-001") {
  const vertexAI = getVertexAI();
  return vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });
}
