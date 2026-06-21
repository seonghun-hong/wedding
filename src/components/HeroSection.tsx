import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { asset } from "../lib/path";

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  const toggleMute = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    try {
      await video.play();
    } catch {
      // 모바일 자동재생 제한 대응
    }
  };

  return (
    <section className="hero">
      <video
        ref={videoRef}
        className="hero-video"
        src={asset("/videos/hero.mp4")}
        poster={asset("/images/hero.jpg")}
        autoPlay
        muted
        loop
        playsInline
      />

      <button className="mute-button" onClick={toggleMute} type="button">
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <span>{muted ? "음소거 해제" : "음소거"}</span>
      </button>

    </section>
  );
}
