import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { localVisitorStats } from "../../../lib/local-store";

export const dynamic = "force-dynamic";
const ONLINE_WINDOW = 45 * 1000;

async function collection() {
  const client = await clientPromise;
  const visits = client.db("amit_salon").collection("visits");
  await visits.createIndex({ sessionId: 1 }, { unique: true });
  await visits.createIndex({ lastSeen: 1 });
  return visits;
}

async function getStats(visits) {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW);
  const [online, total] = await Promise.all([
    visits.countDocuments({ lastSeen: { $gte: cutoff } }),
    visits.countDocuments(),
  ]);
  return { online, total, visited: total };
}

export async function GET() {
  try {
    return NextResponse.json(await getStats(await collection()), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Visitor stats error:", error);
    if (process.env.NODE_ENV === "development") return NextResponse.json(localVisitorStats());
    return NextResponse.json({ error: "Stats unavailable" }, { status: 500 });
  }
}

export async function POST(request) {
  let submitted;
  try {
    submitted = await request.json();
    const { sessionId, visitorId, deviceName, browser, platform } = submitted;
    if (!sessionId || !visitorId || sessionId.length > 100 || visitorId.length > 100) {
      return NextResponse.json({ error: "Invalid visitor session" }, { status: 400 });
    }

    const visits = await collection();
    const now = new Date();
    await visits.updateOne(
      { sessionId },
      {
        $set: { lastSeen: now },
        $setOnInsert: {
          sessionId,
          visitorId,
          firstSeen: now,
          deviceName: String(deviceName || "Unknown Device").slice(0, 80),
          browser: String(browser || "Unknown Browser").slice(0, 50),
          platform: String(platform || "Unknown Platform").slice(0, 50),
        },
      },
      { upsert: true },
    );

    return NextResponse.json(await getStats(visits), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Visitor heartbeat error:", error);
    if (process.env.NODE_ENV === "development") return NextResponse.json(localVisitorStats(submitted?.sessionId, submitted?.visitorId));
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
