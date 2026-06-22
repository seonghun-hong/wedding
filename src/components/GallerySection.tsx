import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

type SlideTarget = "prev" | "next" | "center" | null;

export function GallerySection() {
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const selectedIndexRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const latestOffsetRef = useRef(0);
  const pendingTargetRef = useRef<SlideTarget>(null);
  const pointerIdRef = useRef<number | null>(null);

  const gallery = invitation.gallery;
  const images = showAll ? gallery : gallery.slice(0, 9);
  const totalCount = gallery.length;

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const getPrevIndex = (index: number) => {
    return index === 0 ? totalCount - 1 : index - 1;
  };

  const getNextIndex = (index: number) => {
    return index === totalCount - 1 ? 0 : index + 1;
  };

  const resetPointer = () => {
    pointerIdRef.current = null;
    startXRef.current = null;
    startYRef.current = null;
    latestOffsetRef.current = 0;
  };

  const openModal = (index: number) => {
    selectedIndexRef.current = index;
    setSelectedIndex(index);
    setDragOffset(0);
    latestOffsetRef.current = 0;
    setIsAnimating(false);
    pendingTargetRef.current = null;
  };

  const closeModal = () => {
    selectedIndexRef.current = null;
    setSelectedIndex(null);
    setDragOffset(0);
    latestOffsetRef.current = 0;
    setIsAnimating(false);
    pendingTargetRef.current = null;
    resetPointer();
  };

  const finishSlide = (target: Exclude<SlideTarget, null>) => {
    const currentIndex = selectedIndexRef.current;

    if (currentIndex === null || isAnimating) {
      return;
    }

    const width = window.innerWidth;
    let finalOffset = 0;

    if (target === "next") {
      finalOffset = -width;
    }

    if (target === "prev") {
      finalOffset = width;
    }

    pendingTargetRef.current = target;
    setIsAnimating(true);
    setDragOffset(finalOffset);
    latestOffsetRef.current = finalOffset;
  };

  const slidePrev = () => {
    finishSlide("prev");
  };

  const slideNext = () => {
    finishSlide("next");
  };

  const handleTransitionEnd = () => {
    const currentIndex = selectedIndexRef.current;
    const target = pendingTargetRef.current;

    if (currentIndex === null || !target) {
      return;
    }

    let nextSelectedIndex = currentIndex;

    if (target === "next") {
      nextSelectedIndex = getNextIndex(currentIndex);
    }

    if (target === "prev") {
      nextSelectedIndex = getPrevIndex(currentIndex);
    }

    pendingTargetRef.current = null;
    selectedIndexRef.current = nextSelectedIndex;
    latestOffsetRef.current = 0;

    setIsAnimating(false);
    setSelectedIndex(nextSelectedIndex);
    setDragOffset(0);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isAnimating) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    latestOffsetRef.current = 0;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture 실패 시 무시
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      pointerIdRef.current !== event.pointerId ||
      startXRef.current === null ||
      startYRef.current === null ||
      isAnimating
    ) {
      return;
    }

    const diffX = event.clientX - startXRef.current;
    const diffY = event.clientY - startYRef.current;

    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    /*
      세로 움직임이 더 크면 갤러리 슬라이드로 처리하지 않고 초기화.
      위아래로 움직였을 때 멈추는 현상 방지.
    */
    if (absY > absX && absY > 8) {
      resetPointer();
      setDragOffset(0);

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // 이미 해제된 경우 무시
      }

      return;
    }

    /*
      좌우 움직임이 확실하지 않으면 아직 슬라이드 처리하지 않음.
    */
    if (absX < 8) {
      return;
    }

    event.preventDefault();

    setDragOffset(diffX);
    latestOffsetRef.current = diffX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    const offset = latestOffsetRef.current;

    resetPointer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 release 된 경우 무시
    }

    const width = window.innerWidth;
    const threshold = Math.min(110, width * 0.25);

    if (offset <= -threshold) {
      finishSlide("next");
      return;
    }

    if (offset >= threshold) {
      finishSlide("prev");
      return;
    }

    finishSlide("center");
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    resetPointer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 release 된 경우 무시
    }

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
  }, [selectedIndex, isAnimating]);

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
          className="image-modal photo-viewer-modal"
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
            className="photo-viewer-window"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
          >
            <div
              className="photo-viewer-track"
              onTransitionEnd={handleTransitionEnd}
              style={{
                transform: `translate3d(calc(-100vw + ${dragOffset}px), 0, 0)`,
                transition: isAnimating
                  ? "transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1)"
                  : "none",
              }}
            >
              <div className="photo-viewer-panel">
                <img
                  src={asset(gallery[prevIndex])}
                  alt={`이전 사진 ${prevIndex + 1}`}
                  draggable={false}
                />
              </div>

              <div className="photo-viewer-panel">
                <img
                  src={asset(gallery[selectedIndex])}
                  alt={`확대 사진 ${selectedIndex + 1}`}
                  draggable={false}
                />
              </div>

              <div className="photo-viewer-panel">
                <img
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
