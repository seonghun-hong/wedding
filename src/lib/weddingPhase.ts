import { invitation } from "../data/invitation";

const POST_WEDDING_DELAY_MS = 6 * 60 * 60 * 1000;

export function isPostWedding() {
  const weddingTime = new Date(invitation.wedding.date).getTime();

  if (Number.isNaN(weddingTime)) {
    return false;
  }

  return Date.now() >= weddingTime + POST_WEDDING_DELAY_MS;
}
