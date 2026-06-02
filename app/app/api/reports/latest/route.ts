import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { serializeReport } from "@/lib/reports";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await prisma.report.findFirst({
    where: {
      user: {
        clerkId: userId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json({ report: report ? serializeReport(report) : null });
}
