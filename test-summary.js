/**
 * Test script for itinerary summarization
 */

import { readFileSync } from 'fs';
import { summarizeItinerary } from './src/services/trip-designer/itinerary-summarizer.ts';

const itineraryData = JSON.parse(
  readFileSync('./data/itineraries/f6f505b6-0408-4841-b305-050f40e490b3.json', 'utf-8')
);

console.log('Testing summarizeItinerary with:');
console.log('Title:', itineraryData.title);
console.log('Segments:', itineraryData.segments.length);

console.log('\n--- Generated Summary ---\n');
const summary = summarizeItinerary(itineraryData);
console.log(summary);
