import { describe, it, expect } from 'vitest';

/**
 * Unit tests for location detection and map marker generation
 *
 * NOTE: This test requires the detectLocationsInText function to be exported from chat.ts
 * TODO: Export detectLocationsInText from viewer-svelte/src/lib/stores/chat.ts
 */

// TEMPORARY: Copy types and function implementation for testing
// These are exact copies from chat.ts and visualization.svelte.ts

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  type: 'flight' | 'hotel' | 'activity' | 'transfer' | 'origin' | 'destination';
}

// Known airport codes with coordinates (from chat.ts lines 28-52)
const KNOWN_AIRPORTS: Record<string, { lat: number; lng: number; city: string }> = {
  'JFK': { lat: 40.6413, lng: -73.7781, city: 'New York JFK' },
  'LAX': { lat: 33.9425, lng: -118.4081, city: 'Los Angeles' },
  'NRT': { lat: 35.7720, lng: 140.3929, city: 'Tokyo Narita' },
  'HND': { lat: 35.5494, lng: 139.7798, city: 'Tokyo Haneda' },
  'SFO': { lat: 37.6213, lng: -122.3790, city: 'San Francisco' },
  'ORD': { lat: 41.9742, lng: -87.9073, city: 'Chicago O\'Hare' },
  'LHR': { lat: 51.4700, lng: -0.4543, city: 'London Heathrow' },
  'CDG': { lat: 49.0097, lng: 2.5479, city: 'Paris Charles de Gaulle' },
  'DXB': { lat: 25.2532, lng: 55.3657, city: 'Dubai' },
  'SIN': { lat: 1.3644, lng: 103.9915, city: 'Singapore Changi' },
  'ICN': { lat: 37.4602, lng: 126.4407, city: 'Seoul Incheon' },
  'BKK': { lat: 13.6900, lng: 100.7501, city: 'Bangkok Suvarnabhumi' },
  'HKG': { lat: 22.3080, lng: 113.9185, city: 'Hong Kong' },
  'SYD': { lat: -33.9399, lng: 151.1753, city: 'Sydney' },
  'MEL': { lat: -37.6690, lng: 144.8410, city: 'Melbourne' },
  'YVR': { lat: 49.1967, lng: -123.1815, city: 'Vancouver' },
  'YYZ': { lat: 43.6777, lng: -79.6248, city: 'Toronto Pearson' },
  'AMS': { lat: 52.3105, lng: 4.7683, city: 'Amsterdam Schiphol' },
  'FRA': { lat: 50.0379, lng: 8.5622, city: 'Frankfurt' },
  'MUC': { lat: 48.3538, lng: 11.7861, city: 'Munich' },
  'FCO': { lat: 41.8003, lng: 12.2389, city: 'Rome Fiumicino' },
  'MAD': { lat: 40.4983, lng: -3.5676, city: 'Madrid' },
  'BCN': { lat: 41.2974, lng: 2.0833, city: 'Barcelona' },
};

// Known cities with coordinates (from chat.ts lines 54-81)
const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  'Tokyo': { lat: 35.6762, lng: 139.6503 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Yokohama': { lat: 35.4437, lng: 139.6380 },
  'Kyoto': { lat: 35.0116, lng: 135.7681 },
  'Osaka': { lat: 34.6937, lng: 135.5023 },
  'London': { lat: 51.5074, lng: -0.1278 },
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'Rome': { lat: 41.9028, lng: 12.4964 },
  'Barcelona': { lat: 41.3851, lng: 2.1734 },
  'Dubai': { lat: 25.2048, lng: 55.2708 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Seoul': { lat: 37.5665, lng: 126.9780 },
  'Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Sydney': { lat: -33.8688, lng: 151.2093 },
  'Melbourne': { lat: -37.8136, lng: 144.9631 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'Chicago': { lat: 41.8781, lng: -87.6298 },
  'Vancouver': { lat: 49.2827, lng: -123.1207 },
  'Toronto': { lat: 43.6532, lng: -79.3832 },
  'Amsterdam': { lat: 52.3676, lng: 4.9041 },
  'Frankfurt': { lat: 50.1109, lng: 8.6821 },
  'Munich': { lat: 48.1351, lng: 11.5820 },
  'Madrid': { lat: 40.4168, lng: -3.7038 },
};

/**
 * Detect geographic locations in text and return map markers
 * Copy from chat.ts lines 88-130
 */
function detectLocationsInText(text: string): MapMarker[] {
  const markers: MapMarker[] = [];
  const seen = new Set<string>(); // Track to avoid duplicates

  // Check for airport codes (3 uppercase letters, word boundary)
  const airportMatches = text.match(/\b([A-Z]{3})\b/g);
  if (airportMatches) {
    for (const code of airportMatches) {
      if (KNOWN_AIRPORTS[code] && !seen.has(code)) {
        const airport = KNOWN_AIRPORTS[code];
        markers.push({
          lat: airport.lat,
          lng: airport.lng,
          label: `${code} (${airport.city})`,
          type: 'flight' as any
        });
        seen.add(code);
      }
    }
  }

  // Check for known city names (case-sensitive to avoid false positives)
  for (const [city, coords] of Object.entries(KNOWN_CITIES)) {
    if (text.includes(city) && !seen.has(city)) {
      // Avoid duplicate if airport already added for this city
      const isDuplicate = markers.some(m =>
        Math.abs(m.lat - coords.lat) < 0.5 && Math.abs(m.lng - coords.lng) < 0.5
      );

      if (!isDuplicate) {
        markers.push({
          lat: coords.lat,
          lng: coords.lng,
          label: city,
          type: 'destination'
        });
        seen.add(city);
      }
    }
  }

  return markers;
}

// =============================================================================
// TESTS
// =============================================================================

describe('detectLocationsInText', () => {
  it('detects IATA airport codes (JFK, LAX, NRT)', () => {
    const text = 'Flying from JFK to LAX via NRT';
    const markers = detectLocationsInText(text);

    expect(markers).toHaveLength(3);

    // Check JFK
    const jfk = markers.find(m => m.label.includes('JFK'));
    expect(jfk).toBeDefined();
    expect(jfk?.lat).toBe(40.6413);
    expect(jfk?.lng).toBe(-73.7781);
    expect(jfk?.type).toBe('flight');

    // Check LAX
    const lax = markers.find(m => m.label.includes('LAX'));
    expect(lax).toBeDefined();
    expect(lax?.lat).toBe(33.9425);
    expect(lax?.lng).toBe(-118.4081);

    // Check NRT
    const nrt = markers.find(m => m.label.includes('NRT'));
    expect(nrt).toBeDefined();
    expect(nrt?.lat).toBe(35.7720);
    expect(nrt?.lng).toBe(140.3929);
  });

  it('detects known city names (Tokyo, Paris, London)', () => {
    const text = 'Planning trips to Tokyo, Paris, and London';
    const markers = detectLocationsInText(text);

    expect(markers.length).toBeGreaterThanOrEqual(3);

    // Check Tokyo
    const tokyo = markers.find(m => m.label === 'Tokyo');
    expect(tokyo).toBeDefined();
    expect(tokyo?.lat).toBe(35.6762);
    expect(tokyo?.lng).toBe(139.6503);
    expect(tokyo?.type).toBe('destination');

    // Check Paris
    const paris = markers.find(m => m.label === 'Paris');
    expect(paris).toBeDefined();
    expect(paris?.lat).toBe(48.8566);
    expect(paris?.lng).toBe(2.3522);

    // Check London
    const london = markers.find(m => m.label === 'London');
    expect(london).toBeDefined();
    expect(london?.lat).toBe(51.5074);
    expect(london?.lng).toBe(-0.1278);
  });

  it('returns coordinates for detected locations', () => {
    const text = 'Visit SFO and San Francisco';
    const markers = detectLocationsInText(text);

    // SFO and San Francisco are close, so duplicate detection removes one
    expect(markers).toHaveLength(1);

    markers.forEach(marker => {
      expect(marker.lat).toBeDefined();
      expect(marker.lng).toBeDefined();
      expect(typeof marker.lat).toBe('number');
      expect(typeof marker.lng).toBe('number');
      expect(marker.lat).toBeGreaterThan(-90);
      expect(marker.lat).toBeLessThan(90);
      expect(marker.lng).toBeGreaterThan(-180);
      expect(marker.lng).toBeLessThan(180);
    });
  });

  it('detects multiple locations in one text', () => {
    const text = 'Route: JFK → LHR → CDG → FCO with stops in London and Paris';
    const markers = detectLocationsInText(text);

    expect(markers.length).toBeGreaterThanOrEqual(4); // At least 4 airports

    // Should have airport codes
    expect(markers.some(m => m.label.includes('JFK'))).toBe(true);
    expect(markers.some(m => m.label.includes('LHR'))).toBe(true);
    expect(markers.some(m => m.label.includes('CDG'))).toBe(true);
    expect(markers.some(m => m.label.includes('FCO'))).toBe(true);
  });

  it('ignores non-location 3-letter words', () => {
    const text = 'The cat and dog are not airports';
    const markers = detectLocationsInText(text);

    // "cat", "and", "dog", "are", "not" are all 3 letters but not airport codes
    expect(markers).toHaveLength(0);
  });

  it('returns empty array when no locations found', () => {
    const text = 'This text has no geographic locations';
    const markers = detectLocationsInText(text);

    expect(markers).toEqual([]);
  });

  it('handles case sensitivity correctly', () => {
    const text = 'visiting tokyo is different from Tokyo';
    const markers = detectLocationsInText(text);

    // Only "Tokyo" (capital T) should match
    expect(markers).toHaveLength(1);
    expect(markers[0].label).toBe('Tokyo');
  });

  it('avoids duplicate airport codes', () => {
    const text = 'JFK JFK JFK three times';
    const markers = detectLocationsInText(text);

    expect(markers).toHaveLength(1);
    expect(markers[0].label).toContain('JFK');
  });

  it('avoids duplicate city names', () => {
    const text = 'Tokyo is great, I love Tokyo, Tokyo rocks';
    const markers = detectLocationsInText(text);

    expect(markers).toHaveLength(1);
    expect(markers[0].label).toBe('Tokyo');
  });

  it('avoids duplicate when city and airport are close', () => {
    const text = 'Flying to NRT and visiting Tokyo';
    const markers = detectLocationsInText(text);

    // NRT is Tokyo Narita (35.772, 139.393), Tokyo city is (35.676, 139.650)
    // Distance is ~0.257 degrees, which is LESS than 0.5 threshold
    // However, both are detected because longitude difference is considered separately
    // The duplicate detection checks: abs(lat1-lat2) < 0.5 AND abs(lng1-lng2) < 0.5
    // This is actually working correctly - both should be added
    expect(markers).toHaveLength(2);
    expect(markers.some(m => m.label.includes('NRT'))).toBe(true);
    expect(markers.some(m => m.label === 'Tokyo')).toBe(true);
  });

  it('detects airports in lowercase context but matches uppercase codes', () => {
    const text = 'departure from jfk and arrival at lax';
    const markers = detectLocationsInText(text);

    // Lowercase "jfk" and "lax" should not match (regex uses \b[A-Z]{3}\b)
    expect(markers).toHaveLength(0);
  });

  it('handles mixed content with numbers and punctuation', () => {
    const text = 'Flight #123: JFK → LAX (2 stops)';
    const markers = detectLocationsInText(text);

    expect(markers).toHaveLength(2);
    expect(markers.some(m => m.label.includes('JFK'))).toBe(true);
    expect(markers.some(m => m.label.includes('LAX'))).toBe(true);
  });

  it('detects international routes', () => {
    const text = 'Round trip: SIN → HKG → ICN → BKK';
    const markers = detectLocationsInText(text);

    expect(markers).toHaveLength(4);
    expect(markers.some(m => m.label.includes('SIN'))).toBe(true);
    expect(markers.some(m => m.label.includes('HKG'))).toBe(true);
    expect(markers.some(m => m.label.includes('ICN'))).toBe(true);
    expect(markers.some(m => m.label.includes('BKK'))).toBe(true);
  });

  it('includes city name in airport labels', () => {
    const text = 'Connecting through ORD';
    const markers = detectLocationsInText(text);

    expect(markers).toHaveLength(1);
    expect(markers[0].label).toBe('ORD (Chicago O\'Hare)');
  });

  it('assigns correct marker types', () => {
    const text = 'From JFK to Tokyo';
    const markers = detectLocationsInText(text);

    expect(markers).toHaveLength(2);

    const airportMarker = markers.find(m => m.label.includes('JFK'));
    expect(airportMarker?.type).toBe('flight');

    const cityMarker = markers.find(m => m.label === 'Tokyo');
    expect(cityMarker?.type).toBe('destination');
  });

  it('handles empty string', () => {
    const text = '';
    const markers = detectLocationsInText(text);

    expect(markers).toEqual([]);
  });

  it('handles whitespace only', () => {
    const text = '   \n\t  ';
    const markers = detectLocationsInText(text);

    expect(markers).toEqual([]);
  });

  it('detects locations in structured questions context', () => {
    const text = 'Would you prefer flying into HND or NRT for your Tokyo trip?';
    const markers = detectLocationsInText(text);

    // Should detect both airports plus Tokyo city
    expect(markers.length).toBeGreaterThanOrEqual(2);
    expect(markers.some(m => m.label.includes('HND'))).toBe(true);
    expect(markers.some(m => m.label.includes('NRT'))).toBe(true);
  });
});
