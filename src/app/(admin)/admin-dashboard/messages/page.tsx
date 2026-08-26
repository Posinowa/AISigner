import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { MessagingPanel } from "@/features/messaging/ui/MessagingPanel";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p>Oturum açmanız gerekiyor.</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="max-w-5xl mx-auto p-6">
        <Link
          href="/admin-dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Yönetici Paneline Dön
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mesajlar</h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              Tüm mentor ve öğrencilerle doğrudan iletişim
            </p>
          </div>
        </div>

        <MessagingPanel currentUserId={session.user.id} />
      </div>
    </div>
  );
}
