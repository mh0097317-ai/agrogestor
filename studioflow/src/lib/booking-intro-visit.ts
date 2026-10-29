/** The platform signature plays once per browser visit, across the public flow. */
export const openingSessionKey = "studioflow:opening";
const businessKey = (slug: string) => `studioflow:intro:${slug}`;

export function shouldPlayIntro(slug: string) {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  try {
    return (
      !sessionStorage.getItem(openingSessionKey) &&
      !sessionStorage.getItem(businessKey(slug))
    );
  } catch {
    return true;
  }
}

export function markIntroSeen(slug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(businessKey(slug), "1");
    sessionStorage.setItem(openingSessionKey, "1");
  } catch {
    // Browsing and booking remain usable when storage is unavailable.
  }
}
