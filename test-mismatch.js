/**
 * Test script for mismatch detection
 */

import { readFileSync } from 'fs';
import { detectTitleDestinationMismatch } from './src/services/trip-designer/itinerary-summarizer.ts';

const itineraryData = JSON.parse(
  readFileSync('./data/itineraries/f6f505b6-0408-4841-b305-050f40e490b3.json', 'utf-8')
);

console.log('Testing mismatch detection with itinerary:');
console.log('Title:', itineraryData.title);
console.log('Segments:', itineraryData.segments.length);
console.log('\nFlight details:');
for (const segment of itineraryData.segments) {
  if (segment.type === 'FLIGHT') {
    console.log(`  ${segment.origin?.name} → ${segment.destination?.name}`);
  }
}

console.log('\n--- Running detectTitleDestinationMismatch() ---\n');
const result = detectTitleDestinationMismatch(itineraryData);

console.log('\nResult:', JSON.stringify(result, null, 2));
