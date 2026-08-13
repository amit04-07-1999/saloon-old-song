import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseFile } from "music-metadata";

export const dynamic = "force-dynamic";

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);

function cleanName(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/\s*\(\d+k\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function artistFromFilename(filename) {
  const name = cleanName(filename);
  const knownArtists = [
    "Kumar Sanu", "Lata Mangeshkar", "Udit Narayan", "Sadhana Sargam",
    "Alka Yagnik", "Asha Bhosle", "Kishore Kumar", "Mohammed Rafi",
    "Arijit Singh", "Shreya Ghoshal", "Sonu Nigam", "Neha Kakkar",
  ];
  const matches = knownArtists.filter((artist) => name.toLowerCase().includes(artist.toLowerCase()));
  return matches.length ? [...new Set(matches)].join(" · ") : null;
}

export async function GET() {
  try {
    const songDirectory = path.join(process.cwd(), "public", "song-list");
    const files = await readdir(songDirectory, { withFileTypes: true });
    const audioFiles = files.filter((file) => file.isFile() && AUDIO_EXTENSIONS.has(path.extname(file.name).toLowerCase()));
    const songs = (await Promise.all(audioFiles.map(async (file) => {
      const filePath = path.join(songDirectory, file.name);
      let metadata;
      try { metadata = await parseFile(filePath, { duration: false }); } catch { metadata = null; }
      return {
        title: metadata?.common?.title?.trim() || cleanName(file.name),
        artist: artistFromFilename(file.name) || metadata?.common?.artist?.trim() || "Unknown Artist",
        src: `/song-list/${encodeURIComponent(file.name)}`,
      };
    })))
      .sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true }));

    return NextResponse.json(songs, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Playlist error:", error);
    return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
