import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { invitation } from "../data/invitation";

declare global {
  interface Window {
    kakao?: any;
  }
}

const KAKAO_MAP_SCRIPT_ID = "kakao-map-sdk";

const WEDDING_ADDRESS = "서울특별시 광진구 능동로 81, 지하1층 B106호";

// 하우스오브더라움 / 더 라움 펜트하우스 인근 좌표
// 실제 지도 검색 결과와 아주 약간 다르면 아래 lat/lng만 조정하면 됩니다.
const WEDDING_LAT = 37.5382236;
const WEDDING_LNG = 127.0693185;

function loadKakaoMapSdk(appKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve());
      return;
    }

    const existingScript = document.getElementById(KAKAO_MAP_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        window.kakao.maps.load(() => resolve());
      });
      existingScript.addEventListener("error", () => {
        reject(new Error("카카오맵 SDK 로드 실패"));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = KAKAO_MAP_SCRIPT_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;

    script.onload = () => {
      window.kakao.maps.load(() => resolve());
    };

    script.onerror = () => {
      reject(new Error("카카오맵 SDK 로드 실패"));
    };

    document.head.appendChild(script);
  });
}

export function LocationSection() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;

    if (!kakaoKey) {
      console.warn("VITE_KAKAO_JS_KEY가 설정되지 않았습니다.");
      return;
    }

    let isMounted = true;

    loadKakaoMapSdk(kakaoKey)
      .then(() => {
        if (!isMounted || !mapRef.current || !window.kakao?.maps) {
          return;
        }

        const position = new window.kakao.maps.LatLng(WEDDING_LAT, WEDDING_LNG);

        const map = new window.kakao.maps.Map(mapRef.current, {
          center: position,
          level: 4,
        });

        const marker = new window.kakao.maps.Marker({
          position,
        });

        marker.setMap(map);

        const infoWindow = new window.kakao.maps.InfoWindow({
          content: `
            <div style="
              padding:8px 12px;
              font-size:13px;
              color:#1f2937;
              white-space:nowrap;
              text-align:center;
            ">
              ${WEDDING_PLACE_NAME}
            </div>
          `,
        });

        infoWindow.open(map, marker);

        setTimeout(() => {
          map.relayout();
          map.setCenter(position);
        }, 100);
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const open = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="section location-section">
      <div className="section-label">LOCATION</div>

      <h2 className="section-title">오시는 길</h2>

      <div className="location-card">
        <div className="location-pin">
          <MapPin size={28} />
        </div>

        <h3 className="location-place">{invitation.wedding.venueName}</h3>

        <p className="location-hall">{invitation.wedding.hallName}</p>

        <p className="location-address">{WEDDING_ADDRESS}</p>
      </div>

      <div ref={mapRef} className="kakao-map-box">
        <div className="kakao-map-loading">지도를 불러오는 중입니다</div>
      </div>

      <div className="map-buttons">
        <button
          className="map-button kakao"
          type="button"
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
          type="button"
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
          type="button"
          onClick={() => open(invitation.links.googleMap)}
        >
          <img
            className="map-logo"
            src={`${import.meta.env.BASE_URL}images/icon-google-map.png`}
            alt=""
          />
          <span>구글지도</span>
        </button>
      </div>

      <div className="location-info-list">
        <div className="location-info-item">
          <strong>지하철</strong>
          <p>2호선, 7호선 건대입구역 5번 출구</p>
        </div>

        <div className="location-info-item">
          <strong>주차</strong>
          <p>건물 내 주차 가능</p>
        </div>
      </div>
    </section>
  );
}
