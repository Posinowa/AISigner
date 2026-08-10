import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AISigner - AI Destekli Stajyer & Mentörlük Platformu",
    short_name: "AISigner",
    description:
      "Stajyer ve öğrencilerin AI destekli profil analizi, mentör eşleştirmesi ve kişiselleştirilmiş öğrenme yol haritası platformu.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#4338ca",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
