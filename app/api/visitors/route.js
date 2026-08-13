import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

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
  return { online, total, visited: Math.max(total - online, 0) };
}

export async function GET() {
  try {
    return NextResponse.json(await getStats(await collection()), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Visitor stats error:", error);
    return NextResponse.json({ error: "Stats unavailable" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { sessionId, visitorId } = await request.json();
    if (!sessionId || !visitorId || sessionId.length > 100 || visitorId.length > 100) {
      return NextResponse.json({ error: "Invalid visitor session" }, { status: 400 });
    }

    const visits = await collection();
    const now = new Date();
    await visits.updateOne(
      { sessionId },
      {
        $set: { lastSeen: now },
        $setOnInsert: { sessionId, visitorId, firstSeen: now },
      },
      { upsert: true },
    );

    return NextResponse.json(await getStats(visits), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Visitor heartbeat error:", error);
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
