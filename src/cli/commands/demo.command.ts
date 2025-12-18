/**
 * Demo command - Create a sample itinerary to explore features
 * @module cli/commands/demo
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { generateTravelerId } from '../../domain/types/branded.js';
import { TravelerType } from '../../domain/types/common.js';
import type { FlightSegment, HotelSegment, MeetingSegment } from '../../domain/types/segment.js';
import { ItineraryService } from '../../services/itinerary.service.js';
import { SegmentService } from '../../services/segment.service.js';
import { JsonItineraryStorage } from '../../storage/json-storage.js';
import { colors, formatItinerary, printError } from '../output/index.js';

/**
 * Create the demo command
 * @returns Commander command instance
 */
export function demoCommand(): Command {
  return new Command('demo')
    .description('Create a sample itinerary to explore features')
    .action(async () => {
      p.intro(colors.heading('Itinerizer Demo'));

      const spinner = p.spinner();
      spinner.start('Creating sample itinerary...');

      try {
        // Initialize services
        const storage = new JsonItineraryStorage();
        await storage.initialize();
        const itineraryService = new ItineraryService(storage);
        const segmentService = new SegmentService(storage);

        // Create sample itinerary
        const traveler = {
          id: generateTravelerId(),
          type: TravelerType.ADULT,
          firstName: 'John',
          lastName: 'Traveler',
          email: 'john@example.com',
          loyaltyPrograms: [],
          specialRequests: [],
          metadata: {},
        };

        const createResult = await itineraryService.create({
          title: 'Business Trip to NYC',
          description: 'Annual tech conference and client meetings',
          startDate: new Date('2025-03-15'),
          endDate: new Date('2025-03-21'),
          tripType: 'BUSINESS',
          travelers: [traveler],
        });

        if (!createResult.success) {
          spinner.stop('Failed to create demo itinerary');
          printError(createResult.error.message);
          process.exit(1);
        }

        const itinerary = createResult.value;

        // Add sample flight segment
        await segmentService.add(itinerary.id, {
          type: 'FLIGHT' as const,
          status: 'CONFIRMED' as const,
          startDatetime: new Date('2025-03-15T08:00:00'),
          endDatetime: new Date('2025-03-15T12:00:00'),
          travelerIds: [traveler.id],
          airline: { name: 'United Airlines', code: 'UA' },
          flightNumber: 'UA123',
          origin: { name: 'San Francisco International', code: 'SFO' },
          destination: { name: 'John F. Kennedy International', code: 'JFK' },
          cabinClass: 'BUSINESS' as const,
          metadata: {},
        } as Omit<FlightSegment, 'id'>);

        // Add hotel
        await segmentService.add(itinerary.id, {
          type: 'HOTEL' as const,
          status: 'CONFIRMED' as const,
          startDatetime: new Date('2025-03-15T15:00:00'),
          endDatetime: new Date('2025-03-20T11:00:00'),
          travelerIds: [traveler.id],
          property: { name: 'The Manhattan Grand' },
          location: { name: 'Manhattan, New York', code: 'NYC' },
          checkInDate: new Date('2025-03-15'),
          checkOutDate: new Date('2025-03-20'),
          roomType: 'Executive Suite',
          roomCount: 1,
          amenities: ['WiFi', 'Gym', 'Room Service'],
          metadata: {},
        } as Omit<HotelSegment, 'id'>);

        // Add meeting
        await segmentService.add(itinerary.id, {
          type: 'MEETING' as const,
          status: 'CONFIRMED' as const,
          startDatetime: new Date('2025-03-16T09:00:00'),
          endDatetime: new Date('2025-03-16T17:00:00'),
          travelerIds: [traveler.id],
          title: 'Tech Conference Day 1',
          location: { name: 'Jacob Javits Center', code: 'NYC' },
          attendees: ['Sarah Developer', 'Mike Engineer'],
          agenda: 'Keynotes, workshops, and networking',
          metadata: {},
        } as Omit<MeetingSegment, 'id'>);

        spinner.stop('Demo itinerary created!');

        // Reload to get all segments
        const loadResult = await itineraryService.get(itinerary.id);
        if (loadResult.success) {
          console.log('');
          console.log(formatItinerary(loadResult.value));
          console.log('');
        }

        p.note(
          `ID: ${itinerary.id}\n\nUse "itinerizer itinerary use ${itinerary.id.slice(0, 8)}" to set as working itinerary`,
          'Demo Itinerary Created'
        );

        p.outro('Try "itinerizer itinerary show" to see full details');
      } catch (error) {
        spinner.stop('Demo creation failed');
        printError(error instanceof Error ? error.message : 'Unknown error occurred');
        process.exit(1);
      }
    });
}
