export function getNetworkLocationsTitle(networkName: string): string {
  return /\bchurch$/i.test(networkName.trim())
    ? `${networkName.trim()} Locations`
    : `${networkName.trim()} Church Locations`;
}
