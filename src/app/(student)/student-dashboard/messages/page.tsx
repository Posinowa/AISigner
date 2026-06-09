import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { MessagingPanel } from "@/features/messaging/ui/MessagingPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p>Oturum açmanız gerekiyor.</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/student-dashboard" className="mr-4 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mesajlar</h1>
          <p className="text-gray-600 text-sm">Mentörünüzle iletişim kurun</p>
        </div>
      </div>
      <MessagingPanel currentUserId={session.user.id} />
    </div>
  );
}
