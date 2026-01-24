import { NextResponse } from "next/server";
import { getAllUsers, updateUserRole, assignMentor } from "@/features/admin/server/user";

export async function GET() {
  const users = await getAllUsers();
  return NextResponse.json(users);
}

export async function PATCH(req: Request) {
  const { userId, role } = await req.json();
  const updated = await updateUserRole(userId, role);
  return NextResponse.json(updated);
}

export async function POST(req: Request) {
  const { studentId, mentorId } = await req.json();
  const updated = await assignMentor(studentId, mentorId);
  return NextResponse.json(updated);
}
