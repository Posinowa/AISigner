import { NextResponse } from "next/server";
import { getMentors } from "@/features/admin/server/user";

export async function GET() {
  const mentors = await getMentors();
  return NextResponse.json(mentors);
}
