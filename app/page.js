"use client";

import { useEffect, useRef, useState } from "react";

const formatTime = (seconds) => {
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(Math.floor(safeSeconds % 60)).padStart(2, "0")}`;
};

export default function Home() {
  const [tracks, setTracks] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState("");
  const [visitors, setVisitors] = useState({ online: 0, visited: 0 });
  const audioRef = useRef(null);
  const shouldAutoplayRef = useRef(false);
  const track = tracks[trackIndex];

  useEffect(() => {
    fetch("/api/songs", { cache: "no-store" })
      .then((response) => response.json())
      .then((songs) => { setTracks(songs); setTrackIndex(0); })
      .catch(() => setTracks([]));
  }, []);

  useEffect(() => {
    const savedVolume = Number(localStorage.getItem("amit-salon-volume"));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) setVolume(savedVolume);
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
    localStorage.setItem("amit-salon-volume", String(volume));
  }, [volume, muted]);

  useEffect(() => {
    const update = () => setNow(new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date()));
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const getId = (storage, key) => {
      let id = storage.getItem(key);
      if (!id) { id = crypto.randomUUID(); storage.setItem(key, id); }
      return id;
    };
    const visitorId = getId(localStorage, "amit-salon-visitor");
    const sessionId = getId(sessionStorage, "amit-salon-session");

    const heartbeat = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/visitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, sessionId }),
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setVisitors({ online: data.online, visited: data.visited });
        }
      } catch { /* Keep the last visible values during a temporary network issue. */ }
    };

    heartbeat();
    const timer = setInterval(heartbeat, 15000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", heartbeat); };
  }, []);

  const changeTrack = (direction) => {
    if (!tracks.length) return;
    shouldAutoplayRef.current = true;
    setTrackIndex((trackIndex + direction + tracks.length) % tracks.length);
    setElapsed(0); setPlaying(true);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    audio.load();
    if (shouldAutoplayRef.current) {
      audio.play()
        .then(() => { setPlaying(true); shouldAutoplayRef.current = false; })
        .catch(() => setPlaying(false));
    }
  }, [trackIndex, track]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) {
      try { await audio.play(); setPlaying(true); } catch { setPlaying(false); }
    } else {
      audio.pause(); setPlaying(false);
    }
  };

  const seek = (event) => {
    const nextTime = Number(event.target.value);
    audioRef.current.currentTime = nextTime;
    setElapsed(nextTime);
  };

  return (
    <main className="scene">
      <audio
        ref={audioRef}
        src={track?.src || undefined}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => changeTrack(1)}
      />
      <div className="salon-photo" aria-hidden="true" />
      <div className="wash" />
      <header className="topbar">
        <div className="visitor-stats">
          <div className="online"><span />{visitors.online} online</div>
          <div className="visited">{visitors.visited.toLocaleString("en-IN")} visited</div>
        </div>
        <time>{now}</time>
      </header>

      <section className="salon-brand" aria-label="दिल्ली हेयर कटिंग सैलून">
        <span>दिल्ली हेयर</span>
        <span>कटिंग सैलून</span>
      </section>

      <section className="player" aria-label="Music player">
        <div className={`album ${playing ? "spinning" : ""}`}><span /></div>
        <div className="track-info">
          <div className="track-title" title={track?.title || "Playlist empty"}>
            <div className="track-title-runner">
              <strong>{track?.title || "Playlist empty"}</strong>
              <strong aria-hidden="true">{track?.title || "Playlist empty"}</strong>
            </div>
          </div>
          <span>{track?.artist || "Add audio files to song-list"}</span>
        </div>
        <div className="controls">
          <div className="transport">
            <button disabled={!tracks.length} onClick={() => changeTrack(-1)} aria-label="Previous song"><img src="/icons/previous.svg" alt="" /></button>
            <button disabled={!tracks.length} className="play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}><img src={playing ? "/icons/pause.svg" : "/icons/play.svg"} alt="" /></button>
            <button disabled={!tracks.length} onClick={() => changeTrack(1)} aria-label="Next song"><img src="/icons/next.svg" alt="" /></button>
          </div>
          <div className="volume-control">
            <button onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute" : "Mute"}>
              <img src={muted || volume === 0 ? "/icons/mute.svg" : "/icons/volume.svg"} alt="" />
            </button>
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }}
              style={{ "--volume": `${(muted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>
        <div className="progress-wrap">
          <input aria-label="Song progress" type="range" min="0" max={duration || 0} value={Math.min(elapsed, duration || 0)} onChange={seek} style={{"--progress": `${duration ? (elapsed / duration) * 100 : 0}%`}} />
          <div><span>{formatTime(elapsed)}</span><span>{formatTime(duration)}</span></div>
        </div>
      </section>
      <p className="hint">बाल छोटे हों या बड़े — आपकी पसंद, हमारी कला</p>
    </main>
  );
}
