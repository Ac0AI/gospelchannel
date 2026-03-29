export function isOfflinePublicBuild(): boolean {
  return process.env.GOSPEL_BUILD_OFFLINE === "1";
}
