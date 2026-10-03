/** Short vibration on supporting phones; silently ignored elsewhere. */
export function haptic(ms = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate(ms);
  } catch {
    // Vibration is a nicety; never break the flow over it.
  }
}
