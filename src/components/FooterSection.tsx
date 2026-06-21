import { CalendarDays, Copy, Share2 } from "lucide-react";
import { invitation } from "../data/invitation";
import { downloadCalendar } from "../lib/calendar";
import { copyText } from "../lib/clipboard";
import { asset } from "../lib/path";

declare global {
  interface Window {
    Kakao?: any;
  }
}

export function FooterSection() {
  const copyLink = async () => {
    await copyText(window.location.href);
    alert("링크가 복사되었습니다.");
  };

  const kakaoShare = () => {
    if (!window.Kakao) {
      alert("카카오 SDK를 불러오지 못했습니다.");
      return;
    }

    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (!kakaoKey) {
      alert("VITE_KAKAO_JS_KEY를 설정해주세요.");
      return;
    }

    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(kakaoKey);
    }

    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: `${invitation.groom.name} ♥ ${invitation.bride.name} 결혼합니다`,
        description: `${invitation.wedding.displayDate}\n${invitation.wedding.hallName}`,
        imageUrl: `${window.location.origin}${asset("/images/og.jpg")}`,
        link: {
          mobileWebUrl: window.location.href,
          webUrl: window.location.href,
        },
      },
      buttons: [
        {
          title: "청첩장 보기",
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
      ],
    });
  };

  return (
    <footer className="footer-section">
      <div className="footer-buttons">
        <button className="footer-btn kakao-share" type="button" onClick={kakaoShare}>
          <Share2 size={28} />
          <span>카카오톡</span>
        </button>
        <button className="footer-btn" type="button" onClick={copyLink}>
          <Copy size={28} />
          <span>링크복사</span>
        </button>
        <button className="footer-btn calendar-share" type="button" onClick={downloadCalendar}>
          <CalendarDays size={28} />
          <span>캘린더</span>
        </button>
      </div>
      <p>© {invitation.wedding.year} by {invitation.groom.name.toLowerCase()} & {invitation.bride.name.toLowerCase()}.</p>
    </footer>
  );
}
