'use client';

import { useEffect, useState } from 'react';
import { OSM_REGIONS, bboxString, osmElementToFacility, capOsmFacilities } from '../utils/osm.js';

// Public, keyless Overpass mirrors. Queried in parallel — the free instances
// are community-run and can be slow or briefly unavailable, so we take
// whichever responds first instead of waiting on one at a time. Fetched
// directly from the browser (not proxied through our own server): Overpass's
// abuse protection is much stricter on server/datacenter traffic than on
// ordinary browser requests.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// The free public mirrors are community-run and can be genuinely slow
// (observed up to ~25s on a successful response), not just occasionally
// down — so this needs to be generous rather than snappy.
const REQUEST_TIMEOUT_MS = 28000;

function buildQuery() {
  const clauses = OSM_REGIONS.map(({ bbox }) => {
    const b = bboxString(bbox);
    return `node["amenity"="toilets"](${b});way["amenity"="toilets"](${b});node["amenity"="waste_disposal"](${b});node["amenity"="recycling"](${b});`;
  }).join('');
  return `[out:json][timeout:25];(${clauses});out center;`;
}

function queryEndpoint(endpoint, query, signal) {
  return fetch(endpoint, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  }).then((res) => {
    if (!res.ok) throw new Error(`${endpoint} responded ${res.status}`);
    return res.json();
  });
}

async function fetchOsmFacilities() {
  const query = buildQuery();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const data = await Promise.any(
      OVERPASS_ENDPOINTS.map((endpoint) => queryEndpoint(endpoint, query, controller.signal))
    );
    const mapped = (data.elements || []).map(osmElementToFacility).filter(Boolean);
    return capOsmFacilities(mapped);
  } finally {
    clearTimeout(timeout);
  }
}

export function useOsmFacilities() {
  const [facilities, setFacilities] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;

    fetchOsmFacilities()
      .then((result) => {
        if (cancelled) return;
        setFacilities(result);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { facilities, status };
}
