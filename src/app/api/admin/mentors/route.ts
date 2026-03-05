import { NextResponse } from "next/server";
import { getMentors } from "@/features/admin/server/user";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const mentors = await getMentors();
  return NextResponse.json(mentors);
}
