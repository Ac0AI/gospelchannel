// The directory-backed PlaceLookup (D1, or the local snapshot in offline builds).
import { getSearchCitiesByInitial, getSearchCountries } from "@/lib/church";
import type { PlaceLookup } from "./resolve-place";

export const directoryPlaceLookup: PlaceLookup = {
  citiesByInitial: (initial) => getSearchCitiesByInitial(initial),
  countries: () => getSearchCountries(),
};
