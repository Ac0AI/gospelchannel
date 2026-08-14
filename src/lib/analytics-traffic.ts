type AnalyticsClientFingerprint = {
  userAgent: string;
  referrer: string;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
};

const STALE_AUTOMATION_USER_AGENT =
  /(?:Chrome\/(?:118|119|120)\.|Firefox\/(?:120|121)\.|Edg\/(?:119|120)\.)/;

export function isKnownSyntheticAnalyticsClient({
  userAgent,
  referrer,
  viewportWidth,
  viewportHeight,
  screenWidth,
  screenHeight,
}: AnalyticsClientFingerprint) {
  return (
    referrer === "" &&
    viewportWidth === 1280 &&
    viewportHeight === 720 &&
    screenWidth === 1920 &&
    screenHeight === 1080 &&
    STALE_AUTOMATION_USER_AGENT.test(userAgent)
  );
}

export function isKnownSyntheticBrowserSession() {
  if (typeof window === "undefined") return false;

  return isKnownSyntheticAnalyticsClient({
    userAgent: window.navigator.userAgent,
    referrer: window.document.referrer,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  });
}
