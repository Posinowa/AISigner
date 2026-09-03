import type { MetadataRoute } from "next";
import { uygulamaUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = uygulamaUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/signin",
          "/signup",
          "/terms",
          "/privacy",
          "/forgot-password",
        ],
        disallow: [
          "/admin-dashboard",
          "/admin-dashboard/",
          "/mentor-dashboard",
          "/mentor-dashboard/",
          "/student-dashboard",
          "/student-dashboard/",
          "/student-onboarding",
          "/student-onboarding/",
          "/profile-setup",
          "/profile-setup/",
          "/account-status",
          "/account-status/",
          "/api/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
