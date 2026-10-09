'use client';

// In-site turn-by-turn navigation: routes on our own map, follows the user
// with watchPosition, re-routes when they leave the path, and detects arrival.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { distanceKm } from '../utils/geo.js';
import { ARRIVE_M, OFF_ROUTE_M, currentStepIndex, fetchWalkingRoute, snapToRoute } from '../utils/routing.js';

const REROUTE_COOLDOWN_MS = 8000;

export function useNavigation({ userLocation, setUserLocation, locationSource }) {
  const [target, setTarget] = useState(null);
  const [route, setRoute] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | routing | active | arrived
  const [rerouted, setRerouted] = useState(0);
  const lastReroute = useRef(0);
  const requestId = useRef(0);
  const routeOrigin = useRef(null); // where the user was when the current route was calculated

  const loadRoute = useCallback(async (from, facility) => {
    const id = ++requestId.current;
    const r = await fetchWalkingRoute(from, facility, facility.name);
    if (id !== requestId.current) return null;
    routeOrigin.current = from;
    setRoute(r);
    return r;
  }, []);

  const start = useCallback(
    async (facility, from) => {
      if (!from) return;
      setTarget(facility);
      setStatus('routing');
      setRerouted(0);
      const r = await loadRoute(from, facility);
      if (r) setStatus('active');
    },
    [loadRoute]
  );

  const stop = useCallback(() => {
    requestId.current += 1;
    setTarget(null);
    setRoute(null);
    setStatus('idle');
  }, []);

  const snap = useMemo(
    () => (route && userLocation ? snapToRoute(route, userLocation) : null),
    [route, userLocation]
  );

  const straightM = target && userLocation ? distanceKm(userLocation, target) * 1000 : null;
  const remainingM = route && snap ? Math.max(0, route.distance - snap.progress) : null;
  const stepIndex = route && snap ? currentStepIndex(route, snap.progress) : 0;

  // Arrival
  useEffect(() => {
    if (status !== 'active' || straightM == null) return;
    if (straightM <= ARRIVE_M || (remainingM != null && remainingM <= ARRIVE_M)) {
      setStatus('arrived');
    }
  }, [status, straightM, remainingM]);

  // Off-route -> re-route from the current position
  useEffect(() => {
    if (status !== 'active' || !snap || !target || !userLocation) return;
    // Off the path AND actually moved since the route was made: a start point that is simply away from a road
    // (or GPS jitter) must not trigger endless re-routing.
    const moved = routeOrigin.current ? distanceKm(userLocation, routeOrigin.current) * 1000 : 0;
    if (snap.off > OFF_ROUTE_M && moved > 30 && Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS) {
      lastReroute.current = Date.now();
      loadRoute(userLocation, target).then((r) => r && setRerouted((n) => n + 1));
    }
  }, [status, snap, target, userLocation, loadRoute]);

  // Live GPS tracking
  useEffect(() => {
    if (status !== 'active' || locationSource !== 'gps' || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [status, locationSource, setUserLocation]);

  return {
    target,
    route,
    status,
    rerouted,
    start,
    stop,
    remainingM,
    remainingMin: remainingM != null ? remainingM / 1.25 / 60 : null,
    stepIndex,
    offRouteM: snap?.off ?? 0,
  };
}
