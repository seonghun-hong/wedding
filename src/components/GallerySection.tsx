import { TouchEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

type SlideTarget = "prev" | "next" | "center";

export function GallerySection() {
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const latestDragOffsetRef = useRef(0);
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

  const resetDrag = () => {
    setDragOffset(0);
    latestDragOffsetRef.current = 0;
    setIsDragging(false);
    setIsAnimating(false);
    animatingRef.current = false;
  };

  const closeModal = () => {
    setSelectedIndex(null);
    resetDrag();
  };

  const openModal = (index: number) => {
    setSelectedIndex(index);
    resetDrag();
  };

  const finishSlide = (target: SlideTarget) => {
    if (selectedIndex === null || animatingRef.current) {
      return;
    }

    animatingRef.current = true;
    setIsDragging(false);
    setIsAnimating(true);

    const viewportWidth = window.innerWidth;

    if (target === "next") {
      setDragOffset(-viewportWidth);
      latestDragOffsetRef.current = -viewportWidth;

      window.setTimeout(() => {
        setSelectedIndex((prev) => {
          if (prev === null) {
            return prev;
          }

          return getNextIndex(prev);
        });

        setDragOffset(0);
        latestDragOffsetRef.current = 0;
        setIsAnimating(false);
        animatingRef.current = false;
      }, 260);

      return;
    }

    if (target === "prev") {
      setDragOffset(viewportWidth);
      latestDragOffsetRef.current = viewportWidth;

      window.setTimeout(() => {
        setSelectedIndex((prev) => {
          if (prev === null) {
            return prev;
          }

          return getPrevIndex(prev);
        });

        setDragOffset(0);
        latestDragOffsetRef.current = 0;
        setIsAnimating(false);
        animatingRef.current = false;
      }, 260);

      return;
    }

    setDragOffset(0);
    latestDragOffsetRef.current = 0;

    window.setTimeout(() => {
      setIsAnimating(false);
      animatingRef.current = false;
    }, 220);
  };

  const slidePrev = () => {
    finishSlide("prev");
  };

  const slideNext = () => {
    finishSlide("next");
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (animatingRef.current) {
      return;
    }

    const touch = event.touches[0];

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    setIsDragging(true);
    setIsAnimating(false);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (
      touchStartXRef.current === null ||
      touchStartYRef.current === null ||
      animatingRef.current
    ) {
      return;
    }

    const touch = event.touches[0];

    const diffX = touch.clientX - touchStartXRef.current;
    const diffY = touch.clientY - touchStartYRef.current;

    const isHorizontalMove = Math.abs(diffX) > Math.abs(diffY);

    if (!isHorizontalMove) {
      return;
    }

    event.preventDefault();

    setDragOffset(diffX);
    latestDragOffsetRef.current = diffX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) {
      setIsDragging(false);
      return;
    }

    const diffX = latestDragOffsetRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    const viewportWidth = window.innerWidth;
    const swipeThreshold = Math.min(110, viewportWidth * 0.25);

    if (diffX <= -swipeThreshold) {
      finishSlide("next");
      return;
    }

    if (diffX >= swipeThreshold) {
      finishSlide("prev");
      return;
    }

    finishSlide("center");
  };

  const handleTouchCancel = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    finishSlide("center");
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

  const trackStyle =
    selectedIndex !== null
      ? {
          transform: `translate3d(calc(-100vw + ${dragOffset}px), 0, 0)`,
        }
      : undefined;

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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
          >
            <div
              className={`gallery-slider-track ${
                isDragging ? "dragging" : ""
              } ${isAnimating ? "animating" : ""}`}
              style={trackStyle}
            >
              <div className="gallery-slider-panel">
                <img
                  className="gallery-modal-image"
                  src={asset(gallery[prevIndex])}
                  alt={`이전 사진 ${prevIndex + 1}`}
                  draggable={false}
                />
              </div>

              <div className="gallery-slider-panel">
                <img
                  className="gallery-modal-image"
                  src={asset(gallery[selectedIndex])}
                  alt={`확대 사진 ${selectedIndex + 1}`}
                  draggable={false}
                />
              </div>

              <div className="gallery-slider-panel">
                <img
                  className="gallery-modal-image"
                  src={asset(gallery[nextIndex])}
                  alt={`다음 사진 ${nextIndex + 1}`}
                  draggable={false}
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
