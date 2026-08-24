import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";

const PHOTO_SHARE_DISMISS_KEY = "wedding_photo_share_dismissed_in_session";

export function PhotoSharePrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;

    try {
      dismissed = sessionStorage.getItem(PHOTO_SHARE_DISMISS_KEY) === "1";
    } catch {
      // Strict privacy settings may block session storage.
    }

    if (!dismissed) {
      setOpen(true);
    }
  }, []);

  const closeForNow = () => {
    try {
      sessionStorage.setItem(PHOTO_SHARE_DISMISS_KEY, "1");
    } catch {
      // Closing the prompt should still work when storage is unavailable.
    }
    setOpen(false);
  };

  const goUploadPage = () => {
    closeForNow();
    window.location.hash = "upload";
  };

  if (!open) return null;

  return (
    <div className="rsvp-prompt-overlay" role="dialog" aria-modal="true">
      <div className="rsvp-prompt-sheet photo-share-prompt-sheet">
        <button
          className="rsvp-close"
          type="button"
          onClick={closeForNow}
          aria-label="사진 공유 안내 닫기"
        >
          <X size={18} />
        </button>

        <div className="photo-share-prompt-icon" aria-hidden="true">
          <Camera size={30} />
        </div>
        <div className="rsvp-heading">
          <p className="rsvp-script">Wedding Album</p>
          <h2>오늘의 순간을 나눠주세요</h2>
          <p>
            예식에서 담아주신 사진과 동영상을
            <br />
            신랑신부에게 공유해주세요.
          </p>
        </div>

        <div className="photo-share-prompt-actions">
          <button type="button" className="later" onClick={closeForNow}>
            나중에
          </button>
          <button type="button" className="submit" onClick={goUploadPage}>
            <Camera size={18} />
            사진·동영상 올리기
          </button>
        </div>
      </div>
    </div>
  );
}
