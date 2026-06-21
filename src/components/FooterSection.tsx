import { useEffect, useState } from "react";
import { CalendarDays, Copy, Share2 } from "lucide-react";
import { invitation } from "../data/invitation";
import { downloadCalendar } from "../lib/calendar";

declare global {
  interface Window {
    Kakao?: any;
  }
}

const WEDDING_URL = "https://seonghun-hong.github.io/wedding/";
const KAKAO_IMAGE_URL = "https://seonghun-hong.github.io/wedding/images/og.jpg";

export function FooterSection() {
  const [copied, setCopied] = useState(false);
  const [calendarSaved, setCalendarSaved] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  useEffect(() => {
    if (!calendarSaved) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCalendarSaved(false);
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [calendarSaved]);

  const copyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(WEDDING_URL);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = WEDDING_URL;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
    } catch (error) {
      console.error("링크 복사 실패:", error);
      setCopied(false);
    }
  };

  const kakaoShare = () => {
    if (!window.Kakao) {
      console.warn("카카오 SDK를 불러오지 못했습니다.");
      return;
    }

    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;

    if (!kakaoKey) {
      console.warn("VITE_KAKAO_JS_KEY가 설정되지 않았습니다.");
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
        imageUrl: KAKAO_IMAGE_URL,
        link: {
          mobileWebUrl: WEDDING_URL,
          webUrl: WEDDING_URL,
        },
      },
      buttons: [
        {
          title: "청첩장 보기",
          link: {
            mobileWebUrl: WEDDING_URL,
            webUrl: WEDDING_URL,
          },
        },
      ],
    });
  };

  const handleCalendarDownload = () => {
    downloadCalendar();
    setCalendarSaved(true);
  };

  return (
    <footer className="footer-section">
      <div className="footer-buttons">
        <button
          className="footer-btn kakao-share"
          type="button"
          onClick={kakaoShare}
        >
          <Share2 size={28} />
          <span>카카오톡</span>
        </button>

        <button className="footer-btn" type="button" onClick={copyLink}>
          <Copy size={28} />
          <span>{copied ? "복사완료" : "링크복사"}</span>
        </button>

        <button
          className="footer-btn calendar-share"
          type="button"
          onClick={handleCalendarDownload}
        >
          <CalendarDays size={28} />
          <span>{calendarSaved ? "저장완료" : "캘린더"}</span>
        </button>
      </div>

      <p>
        © {invitation.wedding.year} by{" "}
        {invitation.groom.name.toLowerCase()} &{" "}
        {invitation.bride.name.toLowerCase()}.
      </p>
    </footer>
  );
}
