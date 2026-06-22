import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { asset } from "../lib/path";

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  const toggleMute = async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setMuted(video.muted);

    try {
      await video.play();
    } catch {
      // 모바일 자동재생 제한 대응
    }
  };

  const scrollToNextSection = () => {
    const introSection = document.querySelector(".intro-section");

    if (introSection) {
      introSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      return;
    }

    const heroSection = document.querySelector(".hero");
    const nextSection = heroSection?.nextElementSibling;

    if (nextSection) {
      nextSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
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

      <button
        className="hero-scroll-guide"
        type="button"
        onClick={scrollToNextSection}
      >
        <span>우리의 이야기 보기</span>
        <em>⌄</em>
      </button>
    </section>
  );
}
