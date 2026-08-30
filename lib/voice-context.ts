import type { LiveRoute, LiveTrip } from "@/lib/maps";

export const VOICE_TRIP_CONTEXT_KEY = "madinah-shade-trip-context-v1";

export type VoiceRouteSummary = {
  id: LiveRoute["id"];
  name: string;
  durationMinutes: number;
  distanceMeters: number;
  comfortScore: number;
  wheelchairAware: boolean;
  profileReason: string;
};

export type VoiceTripContext = {
  updatedAt: number;
  originLabel: string;
  destinationLabel: string;
  selectedRouteId: LiveRoute["id"];
  selectedRoute: VoiceRouteSummary;
  alternatives: VoiceRouteSummary[];
};

function summarizeRoute(route: LiveRoute): VoiceRouteSummary {
  return {
    id: route.id,
    name: route.name,
    durationMinutes: route.durationMinutes,
    distanceMeters: route.distanceMeters,
    comfortScore: route.comfortScore,
    wheelchairAware: route.wheelchairAware,
    profileReason: route.profileReason,
  };
}

export function buildVoiceTripContext(
  trip: LiveTrip,
  routes: LiveRoute[],
  selectedRouteId?: string,
): VoiceTripContext | null {
  if (!routes.length) return null;
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) || routes[0];
  return {
    updatedAt: Date.now(),
    originLabel: trip.originLabel,
    destinationLabel: trip.destinationLabel,
    selectedRouteId: selectedRoute.id,
    selectedRoute: summarizeRoute(selectedRoute),
    alternatives: routes.map(summarizeRoute),
  };
}

export function writeVoiceTripContext(context: VoiceTripContext | null) {
  if (typeof window === "undefined") return;
  try {
    if (!context) {
      window.sessionStorage.removeItem(VOICE_TRIP_CONTEXT_KEY);
      return;
    }
    window.sessionStorage.setItem(VOICE_TRIP_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // The trip page still works when storage is blocked.
  }
}

export function clearVoiceTripContext() {
  writeVoiceTripContext(null);
}

export function readVoiceTripContext(): VoiceTripContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(VOICE_TRIP_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VoiceTripContext>;
    if (
      !parsed ||
      typeof parsed.updatedAt !== "number" ||
      typeof parsed.originLabel !== "string" ||
      typeof parsed.destinationLabel !== "string" ||
      !parsed.selectedRoute ||
      !Array.isArray(parsed.alternatives)
    ) {
      return null;
    }
    return parsed as VoiceTripContext;
  } catch {
    return null;
  }
}
