import { redirect } from "next/navigation";

// /student-onboarding eski isimdi; tek doğru sayfa /profile-setup.
// Eski URL'lere gelen kullanıcıları kalıcı olarak yönlendir.
export default function StudentOnboardingRedirect() {
  redirect("/profile-setup");
}
