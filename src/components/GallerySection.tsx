import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

type SlideTarget = "prev" | "next" | "center" | null;

const SLIDE_DURATION = 260;
const PREVIEW_COUNT = 9;

/*
  원본:
  /images/gallery/01.jpg

  썸네일:
  /images/gallery/thumbs/01.webp
*/
function getThumbnailSrc(src: string) {
  const lastSlashIndex = src.lastIndexOf("/");
  const folder = src.slice(0, lastSlashIndex);
  const fileName = src.slice(lastSlashIndex + 1);
  const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

  return `${folder}/thumbs/${fileNameWithoutExt}.webp`;
}

function LazyRender({
  children,
  placeholderClassName,
}: {
  children: ReactNode;
  placeholderClassName: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: "600px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={placeholderClassName}>
      {shouldRender ? children : null}
    </div>
  );
}

export function GallerySection() {
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  const selectedIndexRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const latestOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const pendingTargetRef = useRef<SlideTarget>(null);
  const animationTimerRef = useRef<number | null>(null);
  const hasDraggedRef = useRef(false);

  const gallery = invitation.gallery;
  const totalCount = gallery.length;
  const hasMoreImages = totalCount > PREVIEW_COUNT;
  const images = showAll ? gallery : gallery.slice(0, PREVIEW_COUNT);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const getPrevIndex = (index: number) => {
    return index === 0 ? totalCount - 1 : index - 1;
  };

  const getNextIndex = (index: number) => {
    return index === totalCount - 1 ? 0 : index + 1;
  };

  const clearAnimationTimer = () => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  };

  const resetPointer = () => {
    pointerIdRef.current = null;
    startXRef.current = null;
    startYRef.current = null;
    latestOffsetRef.current = 0;
  };

  const resetDraggedState = () => {
    hasDraggedRef.current = false;
    setHasDragged(false);
  };

  const resetAnimation = () => {
    clearAnimationTimer();
    animatingRef.current = false;
    pendingTargetRef.current = null;
    setIsAnimating(false);
    setDragOffset(0);
    latestOffsetRef.current = 0;
  };

  const openModal = (index: number) => {
    selectedIndexRef.current = index;
    setSelectedIndex(index);
    resetPointer();
    resetAnimation();
    resetDraggedState();
  };

  const closeModal = () => {
    selectedIndexRef.current = null;
    setSelectedIndex(null);
    resetPointer();
    resetAnimation();
    resetDraggedState();
  };

  const completeSlide = () => {
    const currentIndex = selectedIndexRef.current;
    const target = pendingTargetRef.current;

    if (currentIndex === null || !target) {
      resetAnimation();
      return;
    }

    let nextSelectedIndex = currentIndex;

    if (target === "next") {
      nextSelectedIndex = getNextIndex(currentIndex);
    }

    if (target === "prev") {
      nextSelectedIndex = getPrevIndex(currentIndex);
    }

    clearAnimationTimer();

    selectedIndexRef.current = nextSelectedIndex;
    pendingTargetRef.current = null;
    animatingRef.current = false;
    latestOffsetRef.current = 0;

    setIsAnimating(false);
    setSelectedIndex(nextSelectedIndex);
    setDragOffset(0);

    window.setTimeout(() => {
      resetDraggedState();
    }, 0);
  };

  const finishSlide = (target: Exclude<SlideTarget, null>) => {
    const currentIndex = selectedIndexRef.current;

    if (currentIndex === null || animatingRef.current) {
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

    if (target === "center") {
      finalOffset = 0;
    }

    pendingTargetRef.current = target;
    animatingRef.current = true;

    setIsAnimating(true);
    setDragOffset(finalOffset);
    latestOffsetRef.current = finalOffset;

    clearAnimationTimer();

    animationTimerRef.current = window.setTimeout(() => {
      completeSlide();
    }, SLIDE_DURATION + 40);
  };

  const slidePrev = () => {
    finishSlide("prev");
  };

  const slideNext = () => {
    finishSlide("next");
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (animatingRef.current) {
      return;
    }

    const target = event.target as HTMLElement;

    /*
      닫기 버튼, 좌우 버튼, 카운트 영역은 스와이프 시작 대상에서 제외.
      버튼은 버튼대로 클릭되게 둔다.
    */
    if (
      target.closest(".gallery-slide-button") ||
      target.closest(".modal-close") ||
      target.closest(".gallery-modal-count")
    ) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    latestOffsetRef.current = 0;
    hasDraggedRef.current = false;
    setHasDragged(false);

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
      animatingRef.current
    ) {
      return;
    }

    const diffX = event.clientX - startXRef.current;
    const diffY = event.clientY - startYRef.current;

    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    /*
      세로 스크롤 의도가 더 크면 스와이프 취소.
      모달 안에서는 body overflow hidden이라 실제 스크롤은 안 되지만,
      사용자가 세로로 움직였을 때 사진이 흔들리지 않게 하기 위함.
    */
    if (absY > absX && absY > 12) {
      resetPointer();
      setDragOffset(0);
      latestOffsetRef.current = 0;
      resetDraggedState();

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // 이미 해제된 경우 무시
      }

      return;
    }

    if (absX < 8) {
      return;
    }

    event.preventDefault();

    hasDraggedRef.current = true;
    setHasDragged(true);

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

    if (Math.abs(offset) < 8) {
      resetAnimation();

      window.setTimeout(() => {
        resetDraggedState();
      }, 0);

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

    resetAnimation();

    window.setTimeout(() => {
      resetDraggedState();
    }, 0);
  };

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    const clearPointerState = () => {
      if (pointerIdRef.current === null) {
        return;
      }

      resetPointer();
      resetAnimation();
      resetDraggedState();
    };

    window.addEventListener("pointerup", clearPointerState);
    window.addEventListener("pointercancel", clearPointerState);
    window.addEventListener("blur", clearPointerState);

    return () => {
      window.removeEventListener("pointerup", clearPointerState);
      window.removeEventListener("pointercancel", clearPointerState);
      window.removeEventListener("blur", clearPointerState);
    };
  }, [selectedIndex]);

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

  useEffect(() => {
    return () => {
      clearAnimationTimer();
    };
  }, []);

  const prevIndex = selectedIndex !== null ? getPrevIndex(selectedIndex) : null;
  const nextIndex = selectedIndex !== null ? getNextIndex(selectedIndex) : null;

  return (
    <section className="section gallery-section" id="gallery">
      <div className="gallery-heading">
        <p className="gallery-script">Gallery</p>
        <h2 className="gallery-title">갤러리</h2>
      </div>

      <div className={`gallery-preview-wrap ${showAll ? "open" : ""}`}>
        <div className="gallery-grid">
          {images.map((src, index) => {
            const originalIndex = gallery.indexOf(src);
            const thumbnailSrc = getThumbnailSrc(src);

            return (
              <LazyRender
                key={src}
                placeholderClassName="gallery-lazy-placeholder"
              >
                <button
                  className="gallery-item"
                  type="button"
                  onClick={() => openModal(originalIndex)}
                  aria-label={`웨딩 사진 ${index + 1} 크게 보기`}
                >
                  <img
                    src={asset(thumbnailSrc)}
                    alt={`웨딩 사진 ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = asset(src);
                    }}
                  />
                </button>
              </LazyRender>
            );
          })}
        </div>

        {!showAll && hasMoreImages && <div className="gallery-bottom-fade" />}
      </div>

      {!showAll && hasMoreImages && (
        <button
          className="gallery-more-button"
          type="button"
          onClick={() => setShowAll(true)}
        >
          <span className="gallery-plus">＋</span>
          <span>사진 더 보기</span>
        </button>
      )}

      {selectedIndex !== null && prevIndex !== null && nextIndex !== null && (
        <div
          className="image-modal photo-viewer-modal"
          onClick={(event) => {
            /*
              스와이프 직후 click 이벤트가 이어서 발생하면서
              모달이 닫히는 걸 방지.
            */
            if (hasDragged || hasDraggedRef.current) {
              event.stopPropagation();
              return;
            }

            closeModal();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          role="presentation"
        >
          <button
            className="modal-close"
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              closeModal();
            }}
            aria-label="사진 닫기"
          >
            ×
          </button>

          <button
            className="gallery-slide-button gallery-slide-prev"
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
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
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div
              className="photo-viewer-track"
              style={{
                transform: `translate3d(calc(-100vw + ${dragOffset}px), 0, 0)`,
                transition: isAnimating
                  ? `transform ${SLIDE_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
              }}
            >
              <div className="photo-viewer-panel">
                <img
                  src={asset(gallery[prevIndex])}
                  alt={`이전 사진 ${prevIndex + 1}`}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="photo-viewer-panel">
                <img
                  src={asset(gallery[selectedIndex])}
                  alt={`확대 사진 ${selectedIndex + 1}`}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="photo-viewer-panel">
                <img
                  src={asset(gallery[nextIndex])}
                  alt={`다음 사진 ${nextIndex + 1}`}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          <button
            className="gallery-slide-button gallery-slide-next"
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
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
            onClick={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            {selectedIndex + 1} / {gallery.length}
          </div>
        </div>
      )}
    </section>
  );
}
