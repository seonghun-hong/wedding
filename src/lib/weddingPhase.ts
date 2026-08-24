import { useEffect, useState } from "react";
import { invitation } from "../data/invitation";

type WeddingPhase = {
  weddingDayStarted: boolean;
  ceremonyStarted: boolean;
};

function getWeddingTimes() {
  const ceremonyTime = new Date(invitation.wedding.date).getTime();
  const weddingDate = invitation.wedding.date.slice(0, 10);
  const timezone = invitation.wedding.date.match(/(Z|[+-]\d{2}:\d{2})$/)?.[1] || "+09:00";
  const weddingDayTime = new Date(`${weddingDate}T00:00:00${timezone}`).getTime();

  return { weddingDayTime, ceremonyTime };
}

function getWeddingPhase(): WeddingPhase {
  const { weddingDayTime, ceremonyTime } = getWeddingTimes();
  const now = Date.now();

  return {
    weddingDayStarted: !Number.isNaN(weddingDayTime) && now >= weddingDayTime,
    ceremonyStarted: !Number.isNaN(ceremonyTime) && now >= ceremonyTime,
  };
}

export function useWeddingPhase() {
  const [phase, setPhase] = useState<WeddingPhase>(getWeddingPhase);

  useEffect(() => {
    let timerId: number | undefined;

    const updatePhase = () => {
      const nextPhase = getWeddingPhase();
      const { weddingDayTime, ceremonyTime } = getWeddingTimes();

      setPhase(nextPhase);

      const nextTransition = !nextPhase.weddingDayStarted
        ? weddingDayTime
        : !nextPhase.ceremonyStarted
          ? ceremonyTime
          : null;

      if (nextTransition !== null && !Number.isNaN(nextTransition)) {
        const maxTimerDelay = 2_147_000_000;
        const remaining = Math.max(nextTransition - Date.now(), 0);
        timerId = window.setTimeout(
          updatePhase,
          Math.min(remaining + 100, maxTimerDelay)
        );
      }
    };

    updatePhase();

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, []);

  return phase;
}
