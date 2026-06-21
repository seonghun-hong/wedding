import { TouchEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

type SlideAction = "next" | "prev" | null;

export function GallerySection() {
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [slideAction, setSlideAction] = useState<SlideAction>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  const gallery = invitation.gallery;
  const images = showAll ? gallery : gallery.slice(0, 9);
  const totalCount = gallery.length;

  const getPrevIndex = (index: number) => {
    return index === 0 ? totalCount - 1 : index - 1;
  };

  const getNextIndex = (index: number) => {
    return index === totalCount - 1 ? 0 : index + 1;
  };

  const closeModal = () => {
    setSelectedIndex(null);
    setSlideAction(null);
    setIsAnimating(false);
    animatingRef.current = false;
  };

  const openModal = (index: number) => {
    setSelectedIndex(index);
    setSlideAction(null);
    setIsAnimating(false);
    animatingRef.current = false;
  };

  const startSlide = (action: Exclude<SlideAction, null>) => {
    if (selectedIndex === null || animatingRef.current) {
      return;
    }

    animatingRef.current = true;
    setSlideAction(action);
    setIsAnimating(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });

    window.setTimeout(() => {
      setSelectedIndex((prev) => {
        if (prev === null) {
          return prev;
        }

        return action === "next" ? getNextIndex(prev) : getPrevIndex(prev);
      });

      setIsAnimating(false);
      setSlideAction(null);
      animatingRef.current = false;
    }, 300);
  };

  const slidePrev = () => {
    startSlide("prev");
  };

  const slideNext = () => {
    startSlide("next");
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

    if (!isHorizontalSwipe || Math.abs(diffX) < minSwipeDistance) {
      return;
    }

    if (diffX > 0) {
      slidePrev();
    } else {
      slideNext();
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
        slidePrev();
      }

      if (event.key === "ArrowRight") {
        slideNext();
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

  const prevIndex = selectedIndex !== null ? getPrevIndex(selectedIndex) : null;
  const nextIndex = selectedIndex !== null ? getNextIndex(selectedIndex) : null;

  return (
    <section className="section gallery-section">
      <h2 className="section-title">GALLERY</h2>

      <div className="gallery-grid">
        {images.map((src, index) => {
          const originalIndex = gallery.indexOf(src);

          return (
            <button
              className="gallery-item"
              type="button"
              key={src}
              onClick={() => openModal(originalIndex)}
            >
              <img src={asset(src)} alt={`웨딩 사진 ${index + 1}`} />
            </button>
          );
        })}
      </div>

      {!showAll && gallery.length > 9 && (
        <button
          className="primary-button gallery-more"
          type="button"
          onClick={() => setShowAll(true)}
        >
          더보기
        </button>
      )}

      {selectedIndex !== null && prevIndex !== null && nextIndex !== null && (
        <div
          className="image-modal gallery-modal-fixed"
          onClick={closeModal}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="presentation"
        >
          <button className="modal-close" type="button" onClick={closeModal}>
            ×
          </button>

          <button
            className="gallery-slide-button gallery-slide-prev"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              slidePrev();
            }}
            aria-label="이전 사진"
          >
            <ChevronLeft size={34} />
          </button>

          <div
            className="gallery-slider-window"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`gallery-slider-track ${
                slideAction === "next" && isAnimating
                  ? "move-next"
                  : slideAction === "prev" && isAnimating
                    ? "move-prev"
                    : ""
              }`}
            >
              <div className="gallery-slider-panel">
                <img
                  className="gallery-modal-image"
                  src={asset(gallery[prevIndex])}
                  alt={`이전 사진 ${prevIndex + 1}`}
                />
              </div>

              <div className="gallery-slider-panel">
                <img
                  className="gallery-modal-image"
                  src={asset(gallery[selectedIndex])}
                  alt={`확대 사진 ${selectedIndex + 1}`}
                />
              </div>

              <div className="gallery-slider-panel">
                <img
                  className="gallery-modal-image"
                  src={asset(gallery[nextIndex])}
                  alt={`다음 사진 ${nextIndex + 1}`}
                />
              </div>
            </div>
          </div>

          <button
            className="gallery-slide-button gallery-slide-next"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              slideNext();
            }}
            aria-label="다음 사진"
          >
            <ChevronRight size={34} />
          </button>

          <div
            className="gallery-modal-count"
            onClick={(event) => event.stopPropagation()}
          >
            {selectedIndex + 1} / {gallery.length}
          </div>
        </div>
      )}
    </section>
  );
}
