import { MapPin, Train, Bus, Car } from "lucide-react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

export function LocationSection() {
  const open = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="section location-section">
      <h2 className="section-title">LOCATION</h2>

      <img className="map-image" src={asset("/images/map.jpg")} alt="예식장 위치 지도" />

      <h3>{invitation.wedding.hallName}</h3>
      <p>{invitation.wedding.address}</p>
      <p>{invitation.wedding.hallDetail}</p>

<div className="map-buttons">
  <button
    className="map-button kakao"
    onClick={() => open(invitation.links.kakaoMap)}
  >
    <img
      className="map-logo"
      src={`${import.meta.env.BASE_URL}images/icon-kakao-map.png`}
      alt=""
    />
    <span>카카오맵</span>
  </button>

  <button
    className="map-button naver"
    onClick={() => open(invitation.links.naverMap)}
  >
    <img
      className="map-logo"
      src={`${import.meta.env.BASE_URL}images/icon-naver-map.png`}
      alt=""
    />
    <span>네이버지도</span>
  </button>

  <button
    className="map-button google"
    onClick={() => open(invitation.links.googleMap)}
  >
    <img
      className="map-logo"
      src={`${import.meta.env.BASE_URL}images/icon-google-map.png`}
      alt=""
    />
    <span>구글맵</span>
  </button>
</div>
    </section>
  );
}

function Transport({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="transport-row">
      <div className="transport-icon">{icon}</div>
      <strong>{title}</strong>
      <div className="transport-text">
        {items.map((item) => <p key={item}>{item}</p>)}
      </div>
    </div>
  );
}
