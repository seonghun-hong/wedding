import { useEffect, useState } from "react";
import { invitation } from "../data/invitation";

export function isPostWedding() {
  const weddingTime = new Date(invitation.wedding.date).getTime();

  if (Number.isNaN(weddingTime)) {
    return false;
  }

  return Date.now() >= weddingTime;
}

export function usePostWeddingPhase() {
  const [postWedding, setPostWedding] = useState(isPostWedding);

  useEffect(() => {
    let timerId: number | undefined;

    const updatePhase = () => {
      const weddingTime = new Date(invitation.wedding.date).getTime();
      const nextPostWedding = isPostWedding();

      setPostWedding(nextPostWedding);

      if (!nextPostWedding && !Number.isNaN(weddingTime)) {
        const maxTimerDelay = 2_147_000_000;
        const remaining = Math.max(weddingTime - Date.now(), 0);
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

  return postWedding;
}
