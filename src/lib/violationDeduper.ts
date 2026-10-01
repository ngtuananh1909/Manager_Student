export type ViolationSignal = 'visibilitychange' | 'blur';

export function createViolationDeduper(windowMs = 750, now: () => number = Date.now) {
  let lastRecordedAt = Number.NEGATIVE_INFINITY;
  return {
    shouldRecord(_signal: ViolationSignal): boolean {
      const current = now();
      if (current - lastRecordedAt < windowMs) return false;
      lastRecordedAt = current;
      return true;
    }
  };
}
