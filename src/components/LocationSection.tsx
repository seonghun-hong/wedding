import { useEffect, useRef, useState } from "react";
import {
  Bus,
  Copy,
  Flower2,
  Lock,
  MapPin,
  Maximize2,
  ParkingCircle,
  TrainFront,
} from "lucide-react";
import { invitation } from "../data/invitation";
import { copyText } from "../lib/clipboard";

declare global {
  interface Window {
    kakao?: any;
  }
}

const KAKAO_MAP_SCRIPT_ID = "kakao-map-sdk";

const WEDDING_PLACE_NAME = "하우스 오브 더 라움";
const WEDDING_ADDRESS = "서울특별시 광진구 능동로 81, B1";
const WEDDING_HALL = "벨루스홀";

// 하우스오브더라움 좌표
const WEDDING_LAT = 37.5382236;
const WEDDING_LNG = 127.0693185;

// 숫자가 작을수록 확대됩니다.
// 1: 약 30m 느낌 / 2: 조금 넓게 / 3: 기본
const INITIAL_MAP_LEVEL = 4;

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
  const mapInstanceRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);
  const [usesMapLock] = useState(() =>
    window.matchMedia("(pointer: coarse), (max-width: 768px)").matches
  );
  const [toast, setToast] = useState("");
  const hasKakaoKey = Boolean(import.meta.env.VITE_KAKAO_JS_KEY);

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

        const position = new window.kakao.maps.LatLng(
          WEDDING_LAT,
          WEDDING_LNG
        );

        const map = new window.kakao.maps.Map(mapRef.current, {
          center: position,
          level: INITIAL_MAP_LEVEL,
        });

        mapInstanceRef.current = map;

        if (usesMapLock) {
          map.setDraggable(false);
          map.setZoomable(false);
        }

        const marker = new window.kakao.maps.Marker({
          position,
        });

        marker.setMap(map);
        setMapReady(true);

        setTimeout(() => {
          map.relayout();
          map.setCenter(position);
          map.setLevel(INITIAL_MAP_LEVEL);
        }, 100);
      })
      .catch((error) => {
        console.error(error);
        setMapFailed(true);
      });

    return () => {
      isMounted = false;
      mapInstanceRef.current = null;
    };
  }, [usesMapLock]);

  const toggleMapInteraction = () => {
    if (!mapInstanceRef.current) {
      return;
    }

    const nextInteractive = !mapInteractive;
    mapInstanceRef.current.setDraggable(nextInteractive);
    mapInstanceRef.current.setZoomable(nextInteractive);
    setMapInteractive(nextInteractive);
  };

  const open = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyShuttlePlace = async (place: string, address: string) => {
    await copyText(`${place}\n${address}`);
    setToast("탑승 장소를 복사했습니다.");
    window.setTimeout(() => setToast(""), 1500);
  };

  return (
    <section className="section location-section" id="location">
      <div className="location-heading">
        <p className="location-script">Location</p>
        <h2 className="location-title">오시는 길</h2>
      </div>

      <div className="location-text-box">
        <h3 className="location-place">
          {WEDDING_PLACE_NAME} {WEDDING_HALL}
        </h3>
        <p className="location-address">{WEDDING_ADDRESS}</p>
      </div>

      <div className="flower-notice" aria-label="축하 화환 안내">
        <div className="flower-notice-title">
          <Flower2 size={18} aria-hidden="true" />
          <strong>축하 화환 안내</strong>
        </div>
        <p>
          웨딩홀 사정으로 축하 화환은 정중히 사양합니다.
          <br />
          축하해 주시는 따뜻한 마음만 감사히 받겠습니다.
        </p>
      </div>

      <div
        className={`kakao-map-shell${mapInteractive ? " is-interactive" : ""}`}
      >
        <div ref={mapRef} className="kakao-map-box">
          {hasKakaoKey && !mapReady && !mapFailed && (
            <div className="kakao-map-loading">지도를 불러오는 중입니다</div>
          )}

          {(!hasKakaoKey || mapFailed) && (
            <div className="map-fallback-card">
              <strong>{WEDDING_PLACE_NAME}</strong>
              <span>{WEDDING_ADDRESS}</span>
              <p>지도 앱 버튼을 눌러 위치를 확인해 주세요.</p>
            </div>
          )}
        </div>

        {usesMapLock && mapReady && (
          <button
            className="map-interaction-toggle"
            type="button"
            aria-pressed={mapInteractive}
            onClick={toggleMapInteraction}
          >
            {mapInteractive ? <Lock size={15} /> : <Maximize2 size={15} />}
            <span>{mapInteractive ? "지도 고정" : "지도 확대·이동"}</span>
          </button>
        )}
      </div>

      <div className="map-buttons">
        <button
          className="map-button kakao"
          type="button"
          onClick={() => open(invitation.links.kakaoMap)}
        >
          <img
            className="map-logo"
            src={`${import.meta.env.BASE_URL}images/map/icon-kakao-map.png`}
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
            src={`${import.meta.env.BASE_URL}images/map/icon-naver-map.png`}
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
            src={`${import.meta.env.BASE_URL}images/map/icon-google-map.png`}
            alt=""
          />
          <span>구글지도</span>
        </button>
      </div>

      <div className="location-info-list">
        <div className="location-info-item">
          <div className="location-info-title">
            <TrainFront size={20} />
            <strong>지하철</strong>
          </div>
          <p>건대입구역 5번 출구에서 도보 3분</p>
        </div>

        <div className="location-info-item">
          <div className="location-info-title">
            <ParkingCircle size={21} />
            <strong>주차</strong>
          </div>
          <p>웨딩홀 지하 주차 가능 / 2시간 무료</p>
        </div>

        <div className="location-info-item">
          <div className="location-info-title">
            <Bus size={20} />
            <strong>대절버스</strong>
          </div>
          <p>
            하객 여러분의 편안한 이동을 위해
            <br />
            아래 노선으로 대절버스를 왕복 운행합니다.
          </p>
          <div className="bus-routes" aria-label="대절버스 왕복 노선">
            <div className="bus-route">
              <div className="bus-route-heading">
                <span>예식장행</span>
              </div>
              <strong>세종 → 서울 예식장</strong>
            </div>
            <div className="bus-route">
              <div className="bus-route-heading">
                <span>귀가행</span>
                <time>오후 1:00 출발</time>
              </div>
              <strong>서울 예식장 → 세종</strong>
            </div>
          </div>

          <div className="shuttle-details">
            <div className="shuttle-details-heading">
              <strong>탑승 안내</strong>
              {invitation.transport.shuttle.temporary && (
                <span>임시 안내</span>
              )}
            </div>

            {invitation.transport.shuttle.stops.map((stop) => (
              <div className="shuttle-stop" key={stop.id}>
                <div className="shuttle-stop-main">
                  <span>{stop.label}</span>
                  <strong>{stop.time}</strong>
                </div>
                <p>{stop.place}</p>
                <small>{stop.address}</small>
                <div className="shuttle-stop-actions">
                  <button
                    type="button"
                    onClick={() => copyShuttlePlace(stop.place, stop.address)}
                  >
                    <Copy size={15} />
                    <span>장소 복사</span>
                  </button>
                  <button type="button" onClick={() => open(stop.mapUrl)}>
                    <MapPin size={15} />
                    <span>지도 열기</span>
                  </button>
                </div>
              </div>
            ))}

            <div className="shuttle-contact">{invitation.transport.shuttle.contact}</div>
            {invitation.transport.shuttle.temporary && (
              <p className="shuttle-temporary-note">
                정확한 시간과 탑승 위치는 확정 후 다시 안내드리겠습니다.
              </p>
            )}
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </section>
  );
}
