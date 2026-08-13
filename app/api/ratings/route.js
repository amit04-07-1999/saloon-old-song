import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { localRatingSummary } from "../../../lib/local-store";

export const dynamic = "force-dynamic";

async function collection() {
  const client = await clientPromise;
  const ratings = client.db("amit_salon").collection("ratings");
  await ratings.createIndex({ visitorId: 1 }, { unique: true });
  return ratings;
}

async function getSummary(ratings) {
  const [summary] = await ratings.aggregate([
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]).toArray();
  return {
    average: summary ? Number(summary.average.toFixed(1)) : 0,
    count: summary?.count || 0,
  };
}

export async function GET(request) {
  try {
    const ratings = await collection();
    const visitorId = new URL(request.url).searchParams.get("visitorId");
    const [summary, ownRating] = await Promise.all([
      getSummary(ratings),
      visitorId ? ratings.findOne({ visitorId }, { projection: { rating: 1 } }) : null,
    ]);
    return NextResponse.json({ ...summary, userRating: ownRating?.rating || 0 }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Rating summary error:", error);
    if (process.env.NODE_ENV === "development") {
      const visitorId = new URL(request.url).searchParams.get("visitorId");
      return NextResponse.json(localRatingSummary(visitorId));
    }
    return NextResponse.json({ error: "Ratings unavailable" }, { status: 500 });
  }
}

export async function POST(request) {
  let submitted;
  try {
    submitted = await request.json();
    const { visitorId, rating, deviceName, browser, platform } = submitted;
    const value = Number(rating);
    if (!visitorId || visitorId.length > 100 || !Number.isInteger(value) || value < 1 || value > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    const ratings = await collection();
    const now = new Date();
    await ratings.updateOne(
      { visitorId },
      {
        $set: {
          rating: value,
          updatedAt: now,
          deviceName: String(deviceName || "Unknown Device").slice(0, 80),
          browser: String(browser || "Unknown Browser").slice(0, 50),
          platform: String(platform || "Unknown Platform").slice(0, 50),
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    return NextResponse.json({ ...(await getSummary(ratings)), userRating: value });
  } catch (error) {
    console.error("Rating submit error:", error);
    if (process.env.NODE_ENV === "development" && submitted?.visitorId) {
      return NextResponse.json(localRatingSummary(submitted.visitorId, Number(submitted.rating)));
    }
    return NextResponse.json({ error: "Rating could not be saved" }, { status: 500 });
  }
}
