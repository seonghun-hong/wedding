import { useState } from "react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

export function GallerySection() {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const images = showAll ? invitation.gallery : invitation.gallery.slice(0, 9);

  return (
    <section className="section gallery-section">
      <h2 className="section-title">GALLERY</h2>

      <div className="gallery-grid">
        {images.map((src, index) => (
          <button className="gallery-item" type="button" key={src} onClick={() => setSelected(src)}>
            <img src={asset(src)} alt={`웨딩 사진 ${index + 1}`} />
          </button>
        ))}
      </div>

      {!showAll && invitation.gallery.length > 9 && (
        <button className="primary-button gallery-more" type="button" onClick={() => setShowAll(true)}>
          더보기
        </button>
      )}

      {selected && (
        <div className="image-modal" onClick={() => setSelected(null)} role="presentation">
          <button className="modal-close" type="button" onClick={() => setSelected(null)}>×</button>
          <img src={asset(selected)} alt="확대 사진" />
        </div>
      )}
    </section>
  );
}
