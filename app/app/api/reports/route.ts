import { currentUser } from "@clerk/nextjs/server";
import { upsertAppUser } from "@/lib/auth-db";
import {
  createReport,
  isReportPayload,
  listReportsForClerkUser,
  serializeReport,
} from "@/lib/reports";

export async function GET() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await listReportsForClerkUser(clerkUser.id);

  return Response.json({ reports });
}

export async function POST(request: Request) {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!isReportPayload(payload)) {
    return Response.json({ error: "Invalid report payload." }, { status: 400 });
  }

  const dbUser = await upsertAppUser({
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    name: clerkUser.fullName,
    imageUrl: clerkUser.imageUrl,
  });

  const report = await createReport(dbUser.id, payload);

  return Response.json({ report: serializeReport(report) }, { status: 201 });
}
