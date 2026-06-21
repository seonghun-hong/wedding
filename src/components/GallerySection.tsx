import { TouchEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

type SlideDirection = "next" | "prev" | null;

export function GallerySection() {
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [displayIndex, setDisplayIndex] = useState<number | null>(null);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>(null);
  const [isSliding, setIsSliding] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  const images = showAll ? invitation.gallery : invitation.gallery.slice(0, 9);
  const totalCount = invitation.gallery.length;

  const closeModal = () => {
    setSelectedIndex(null);
    setDisplayIndex(null);
    setNextIndex(null);
    setSlideDirection(null);
    setIsSliding(false);
    animatingRef.current = false;
  };

  const getPrevIndex = (index: number) => {
    return index === 0 ? totalCount - 1 : index - 1;
  };

  const getNextIndex = (index: number) => {
    return index === totalCount - 1 ? 0 : index + 1;
  };

  const openModal = (index: number) => {
    setSelectedIndex(index);
    setDisplayIndex(index);
    setNextIndex(null);
    setSlideDirection(null);
    setIsSliding(false);
  };

const startSlide = (direction: Exclude<SlideDirection, null>) => {
  if (animatingRef.current || displayIndex === null) {
    return;
  }

  const targetIndex =
    direction === "next" ? getNextIndex(displayIndex) : getPrevIndex(displayIndex);

  animatingRef.current = true;

  // 1단계: 다음 사진을 화면 밖에 먼저 배치
  setNextIndex(targetIndex);
  setSlideDirection(direction);
  setIsSliding(false);

  // 2단계: 브라우저가 화면 밖 배치를 먼저 그리게 한 뒤
  // 다음 프레임에서 sliding 클래스를 붙여야 애니메이션이 보임
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setIsSliding(true);
    });
  });

  window.setTimeout(() => {
    setDisplayIndex(targetIndex);
    setSelectedIndex(targetIndex);
    setNextIndex(null);
    setSlideDirection(null);
    setIsSliding(false);
    animatingRef.current = false;
  }, 320);
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

    if (!isHorizontalSwipe) {
      return;
    }

    if (Math.abs(diffX) < minSwipeDistance) {
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
  }, [selectedIndex, displayIndex]);

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

  const currentImage =
    displayIndex !== null ? invitation.gallery[displayIndex] : null;

  const incomingImage =
    nextIndex !== null ? invitation.gallery[nextIndex] : null;

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
              onClick={() => openModal(originalIndex)}
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

      {currentImage && selectedIndex !== null && displayIndex !== null && (
        <div
          className="image-modal"
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
            className={`gallery-slider ${
              slideDirection === "next" && isSliding
                ? "sliding-next"
                : slideDirection === "prev" && isSliding
                  ? "sliding-prev"
                  : ""
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="gallery-slide current-slide">
              <img
                className="gallery-modal-image"
                src={asset(currentImage)}
                alt={`확대 사진 ${displayIndex + 1}`}
              />
            </div>

            {incomingImage && nextIndex !== null && slideDirection && (
              <div
                className={`gallery-slide incoming-slide ${
                  slideDirection === "next" ? "from-right" : "from-left"
                }`}
              >
                <img
                  className="gallery-modal-image"
                  src={asset(incomingImage)}
                  alt={`확대 사진 ${nextIndex + 1}`}
                />
              </div>
            )}
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
            {displayIndex + 1} / {invitation.gallery.length}
          </div>
        </div>
      )}
    </section>
  );
}
