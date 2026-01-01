/**
 * Test full context building with proper date conversion
 */

import { readFileSync } from 'fs';
import { summarizeItinerary } from './src/services/trip-designer/itinerary-summarizer.ts';

// Read the itinerary
const json = readFileSync('./data/itineraries/f6f505b6-0408-4841-b305-050f40e490b3.json', 'utf-8');

// Parse with ISO date regex (same as JsonItineraryStorage)
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const itineraryData = JSON.parse(json, (_key, value) => {
  if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
    return new Date(value);
  }
  return value;
});

console.log('Testing with properly deserialized dates:');
console.log('Title:', itineraryData.title);
console.log('Start date type:', typeof itineraryData.startDate, itineraryData.startDate instanceof Date);
console.log('End date type:', typeof itineraryData.endDate, itineraryData.endDate instanceof Date);
console.log('Segments:', itineraryData.segments.length);

console.log('\n--- Generated Summary (as LLM would see it) ---\n');
const summary = summarizeItinerary(itineraryData);
console.log(summary);
console.log('\n--- End of Summary ---');
