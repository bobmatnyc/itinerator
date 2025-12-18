/**
 * Itinerary-specific prompts
 * @module cli/prompts/itinerary.prompts
 */

import * as p from '@clack/prompts';
import type { ItineraryId } from '../../domain/types/branded.js';
import type { TravelerType, TripType } from '../../domain/types/common.js';
import type { ItinerarySummary } from '../../storage/storage.interface.js';
import { handleCancel, promptDate, promptOptionalText, promptText } from './common.prompts.js';

/**
 * Input for creating an itinerary
 */
export interface ItineraryCreateInput {
  title: string;
  description?: string | undefined;
  startDate: Date;
  endDate: Date;
  tripType?: TripType | undefined;
}

/**
 * Input for adding a traveler
 */
export interface TravelerInput {
  firstName: string;
  lastName: string;
  email?: string | undefined;
  type: TravelerType;
}

/**
 * Interactive prompts for creating an itinerary
 * @returns Itinerary creation input
 */
export async function promptCreateItinerary(): Promise<ItineraryCreateInput> {
  const title = await promptText('Itinerary title:', 'My Trip to Paris');

  const description = await promptOptionalText(
    'Description (optional):',
    'A wonderful vacation in Paris'
  );

  const startDate = await promptDate('Start date:', 'YYYY-MM-DD');

  const endDate = await promptDate('End date:', 'YYYY-MM-DD');

  // Validate end date is after start date
  if (endDate <= startDate) {
    p.cancel('End date must be after start date');
    process.exit(1);
  }

  const tripTypeChoice = await p.select({
    message: 'Trip type (optional):',
    options: [
      { value: undefined, label: 'Skip' },
      { value: 'LEISURE', label: 'Leisure' },
      { value: 'BUSINESS', label: 'Business' },
      { value: 'MIXED', label: 'Mixed' },
    ],
  });

  handleCancel(tripTypeChoice);

  return {
    title,
    description,
    startDate,
    endDate,
    tripType: tripTypeChoice as TripType | undefined,
  };
}

/**
 * Interactive prompts for adding a traveler
 * @returns Traveler input
 */
export async function promptAddTraveler(): Promise<TravelerInput> {
  const firstName = await promptText('First name:');

  const lastName = await promptText('Last name:');

  const email = await promptOptionalText('Email (optional):');

  const type = await p.select({
    message: 'Traveler type:',
    options: [
      { value: 'ADULT', label: 'Adult' },
      { value: 'CHILD', label: 'Child' },
      { value: 'INFANT', label: 'Infant' },
      { value: 'SENIOR', label: 'Senior' },
    ],
  });

  handleCancel(type);

  return {
    firstName,
    lastName,
    email,
    type: type as TravelerType,
  };
}

/**
 * Select from a list of itineraries
 * @param summaries - List of itinerary summaries
 * @param message - Optional custom message
 * @returns Selected itinerary ID
 */
export async function promptSelectItinerary(
  summaries: ItinerarySummary[],
  message?: string
): Promise<ItineraryId> {
  const options = summaries.map((summary) => ({
    value: summary.id,
    label: `${summary.title} (${summary.status}) - ${summary.startDate.toLocaleDateString()}`,
    hint: summary.id.slice(0, 8),
  }));

  const selected = await p.select({
    message: message || 'Select an itinerary:',
    options,
  });

  handleCancel(selected);

  return selected as ItineraryId;
}
