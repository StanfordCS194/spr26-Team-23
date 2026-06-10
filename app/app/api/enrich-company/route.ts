import { NextResponse } from "next/server";

interface DDGResponse {
  Abstract?: string;
  Infobox?: {
    content?: Array<{ label: string; value: string }>;
  };
}

export async function POST(req: Request) {
  let domain: string;
  let name: string;
  try {
    const body = (await req.json()) as { domain?: string; name?: string };
    domain = (body.domain ?? "").trim();
    name = (body.name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!domain && !name) {
    return NextResponse.json({ error: "domain or name is required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent((name || domain) + " company")}&format=json&no_redirect=1&no_html=1`,
      { headers: { "User-Agent": "TunnelApp/1.0" } },
    );
    if (!res.ok) return NextResponse.json({ ok: false });

    const data = (await res.json()) as DDGResponse;
    const description = data.Abstract ?? "";
    const industryItem = data.Infobox?.content?.find((c) => c.label === "Industry");
    const category = typeof industryItem?.value === "string" ? industryItem.value : "";

    if (!description && !category) return NextResponse.json({ ok: false });

    return NextResponse.json({ ok: true, description, category, competitors: [] });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
