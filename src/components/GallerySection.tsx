import { TouchEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

export function GallerySection() {
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const images = showAll ? invitation.gallery : invitation.gallery.slice(0, 9);

  const selectedImage =
    selectedIndex !== null ? invitation.gallery[selectedIndex] : null;

  const closeModal = () => {
    setSelectedIndex(null);
  };

  const showPrev = () => {
    setSelectedIndex((prev) => {
      if (prev === null) {
        return prev;
      }

      return prev === 0 ? invitation.gallery.length - 1 : prev - 1;
    });
  };

  const showNext = () => {
    setSelectedIndex((prev) => {
      if (prev === null) {
        return prev;
      }

      return prev === invitation.gallery.length - 1 ? 0 : prev + 1;
    });
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }

    const touch = event.changedTouches[0];

    const diffX = touch.clientX - touchStartXRef.current;
    const diffY = touch.clientY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    const minSwipeDistance = 50;
    const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);

    if (!isHorizontalSwipe) {
      return;
    }

    if (Math.abs(diffX) < minSwipeDistance) {
      return;
    }

    if (diffX > 0) {
      showPrev();
    } else {
      showNext();
    }
  };

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }

      if (event.key === "ArrowLeft") {
        showPrev();
      }

      if (event.key === "ArrowRight") {
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedIndex]);

  return (
    <section className="section gallery-section">
      <h2 className="section-title">GALLERY</h2>

      <div className="gallery-grid">
        {images.map((src, index) => {
          const originalIndex = invitation.gallery.indexOf(src);

          return (
            <button
              className="gallery-item"
              type="button"
              key={src}
              onClick={() => setSelectedIndex(originalIndex)}
            >
              <img src={asset(src)} alt={`웨딩 사진 ${index + 1}`} />
            </button>
          );
        })}
      </div>

      {!showAll && invitation.gallery.length > 9 && (
        <button
          className="primary-button gallery-more"
          type="button"
          onClick={() => setShowAll(true)}
        >
          더보기
        </button>
      )}

      {selectedImage && selectedIndex !== null && (
        <div
          className="image-modal"
          onClick={closeModal}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="presentation"
        >
          <button
            className="modal-close"
            type="button"
            onClick={closeModal}
          >
            ×
          </button>

          <button
            className="gallery-slide-button gallery-slide-prev"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPrev();
            }}
            aria-label="이전 사진"
          >
            <ChevronLeft size={34} />
          </button>

          <img
            className="gallery-modal-image"
            src={asset(selectedImage)}
            alt={`확대 사진 ${selectedIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
          />

          <button
            className="gallery-slide-button gallery-slide-next"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            aria-label="다음 사진"
          >
            <ChevronRight size={34} />
          </button>

          <div
            className="gallery-modal-count"
            onClick={(event) => event.stopPropagation()}
          >
            {selectedIndex + 1} / {invitation.gallery.length}
          </div>
        </div>
      )}
    </section>
  );
}
