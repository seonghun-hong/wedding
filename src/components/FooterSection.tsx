import { useEffect, useState } from "react";
import { CalendarDays, Copy, Share2 } from "lucide-react";
import { invitation } from "../data/invitation";
import { downloadCalendar } from "../lib/calendar";
import { copyText } from "../lib/clipboard";

declare global {
  interface Window {
    Kakao?: any;
  }
}

const WEDDING_URL = "https://seonghun-hong.github.io/wedding/";
const KAKAO_IMAGE_URL = "https://seonghun-hong.github.io/wedding/images/og.jpg";

export function FooterSection() {
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToastMessage("");
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toastMessage]);

  const copyLink = async () => {
    try {
      await copyText(WEDDING_URL);
      showToast("링크가 복사되었습니다.");
    } catch (error) {
      console.error("링크 복사 실패:", error);
      showToast("링크 복사에 실패했습니다.");
    }
  };

  const kakaoShare = () => {
    if (!window.Kakao) {
      showToast("카카오 SDK를 불러오지 못했습니다.");
      return;
    }

    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;

    if (!kakaoKey) {
      showToast("카카오 키가 설정되지 않았습니다.");
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
    showToast("캘린더 파일이 저장되었습니다.");
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
          <span>링크복사</span>
        </button>

        <button
          className="footer-btn calendar-share"
          type="button"
          onClick={handleCalendarDownload}
        >
          <CalendarDays size={28} />
          <span>캘린더</span>
        </button>
      </div>

      <p>
        © {invitation.wedding.year} by{" "}
        {invitation.groom.name.toLowerCase()} &{" "}
        {invitation.bride.name.toLowerCase()}.
      </p>

      {toastMessage && (
        <div className="toast-message" role="status">
          {toastMessage}
        </div>
      )}
    </footer>
  );
}
