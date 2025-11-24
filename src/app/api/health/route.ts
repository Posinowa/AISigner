
//Bu route, veritabanına basit bir sorgu atar (SELECT 1) ve bağlantının sağlıklı olup olmadığını JSON olarak döner.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: "ok",
        db: "connected",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error(" Healthcheck failed:", error)
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
