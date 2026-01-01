/**
 * Segment add command
 * @module cli/commands/segment/add
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { generateSegmentId } from '../../../domain/types/branded.js';
import type { SegmentType } from '../../../domain/types/common.js';
import { SegmentService } from '../../../services/segment.service.js';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { colors, printError } from '../../output/colors.js';
import { formatSegment } from '../../output/formatters.js';
import {
  handleCancel,
  promptDate,
  promptOptionalText,
  promptText,
} from '../../prompts/common.prompts.js';
import { promptSegmentStatus, promptSegmentType } from '../../prompts/segment.prompts.js';

export function addCommand(): Command {
  return new Command('add')
    .description('Add a segment to the working itinerary')
    .option(
      '-t, --type <type>',
      'Segment type (FLIGHT, HOTEL, MEETING, ACTIVITY, TRANSFER, CUSTOM)'
    )
    .action(async (options) => {
      p.intro(colors.heading('Add Segment'));

      // Get working itinerary
      const storage = new JsonItineraryStorage();
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      const segmentService = new SegmentService(storage);
      const workingService = new WorkingContextService(configStorage, storage);

      const workingResult = await workingService.getWorkingItinerary();
      if (!workingResult.success || !workingResult.value) {
        printError('No working itinerary set. Use "itinerator itinerary use <id>" first.');
        process.exit(1);
      }

      const itinerary = workingResult.value;

      // Get segment type
      let segmentType: SegmentType;
      if (options.type) {
        segmentType = options.type.toUpperCase() as SegmentType;
      } else {
        segmentType = await promptSegmentType();
      }

      // Get base segment info
      const status = await promptSegmentStatus();

      const startDatetime = await promptDate('Start date/time (YYYY-MM-DD HH:mm):');
      const endDatetime = await promptDate('End date/time (YYYY-MM-DD HH:mm):');

      if (endDatetime <= startDatetime) {
        printError('End time must be after start time');
        process.exit(1);
      }

      // Get traveler IDs (default to all travelers if not specified)
      const travelerIds = itinerary.travelers.map((t) => t.id);

      const notes = await promptOptionalText('Notes (optional):');

      // Type-specific prompts
      let typeSpecificData: Record<string, unknown> = {};

      switch (segmentType) {
        case 'FLIGHT': {
          const airline = await promptText('Airline name:');
          const airlineCode = await promptOptionalText('Airline code (e.g., UA):');
          const flightNumber = await promptText('Flight number (e.g., UA123):');
          const originCode = await promptText('Origin airport code (e.g., SFO):');
          const originName = await promptOptionalText('Origin airport name:');
          const destCode = await promptText('Destination airport code (e.g., JFK):');
          const destName = await promptOptionalText('Destination airport name:');
          const cabinClass = await p.select({
            message: 'Cabin class:',
            options: [
              { value: 'ECONOMY', label: 'Economy' },
              { value: 'PREMIUM_ECONOMY', label: 'Premium Economy' },
              { value: 'BUSINESS', label: 'Business' },
              { value: 'FIRST', label: 'First' },
            ],
          });
          handleCancel(cabinClass);

          typeSpecificData = {
            airline: {
              name: airline,
              ...(airlineCode ? { code: airlineCode.toUpperCase() } : {}),
            },
            flightNumber: flightNumber.toUpperCase(),
            origin: {
              name: originName || originCode.toUpperCase(),
              code: originCode.toUpperCase(),
            },
            destination: {
              name: destName || destCode.toUpperCase(),
              code: destCode.toUpperCase(),
            },
            cabinClass,
          };
          break;
        }

        case 'HOTEL': {
          const propertyName = await promptText('Hotel name:');
          const locationName = await promptText('Location:');
          const locationCode = await promptOptionalText('City code (e.g., NYC):');
          const roomType = await promptOptionalText('Room type:');
          const checkInDate = new Date(startDatetime.toISOString().split('T')[0] as string);
          const checkOutDate = new Date(endDatetime.toISOString().split('T')[0] as string);

          typeSpecificData = {
            property: { name: propertyName },
            location: {
              name: locationName,
              ...(locationCode ? { code: locationCode.toUpperCase() } : {}),
            },
            checkInDate,
            checkOutDate,
            roomType,
            roomCount: 1,
            amenities: [],
          };
          break;
        }

        case 'MEETING': {
          const title = await promptText('Meeting title:');
          const locationName = await promptText('Location:');
          const organizer = await promptOptionalText('Organizer:');
          const agenda = await promptOptionalText('Agenda:');
          const meetingUrl = await promptOptionalText('Meeting URL (for virtual):');

          typeSpecificData = {
            title,
            location: { name: locationName },
            organizer,
            attendees: [],
            agenda,
            meetingUrl,
          };
          break;
        }

        case 'ACTIVITY': {
          const name = await promptText('Activity name:');
          const description = await promptOptionalText('Description:');
          const locationName = await promptText('Location:');
          const category = await promptOptionalText('Category:');

          typeSpecificData = {
            name,
            description,
            location: { name: locationName },
            category,
          };
          break;
        }

        case 'TRANSFER': {
          const transferType = await p.select({
            message: 'Transfer type:',
            options: [
              { value: 'TAXI', label: 'Taxi' },
              { value: 'SHUTTLE', label: 'Shuttle' },
              { value: 'PRIVATE', label: 'Private Car' },
              { value: 'PUBLIC', label: 'Public Transport' },
              { value: 'RIDE_SHARE', label: 'Ride Share' },
            ],
          });
          handleCancel(transferType);

          const pickupName = await promptText('Pickup location:');
          const dropoffName = await promptText('Dropoff location:');

          typeSpecificData = {
            transferType,
            pickupLocation: { name: pickupName },
            dropoffLocation: { name: dropoffName },
          };
          break;
        }

        case 'CUSTOM': {
          const title = await promptText('Title:');
          const description = await promptOptionalText('Description:');
          const locationName = await promptOptionalText('Location:');

          typeSpecificData = {
            title,
            description,
            ...(locationName ? { location: { name: locationName } } : {}),
            customData: {},
          };
          break;
        }
      }

      // Create segment
      const spinner = p.spinner();
      spinner.start('Adding segment...');

      const segment = {
        id: generateSegmentId(),
        type: segmentType,
        status: status as 'TENTATIVE' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' | 'COMPLETED',
        startDatetime,
        endDatetime,
        travelerIds,
        ...(notes ? { notes } : {}),
        metadata: {},
        ...typeSpecificData,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await segmentService.add(itinerary.id, segment as any);

      if (!result.success) {
        spinner.stop('Failed to add segment');
        printError(result.error.message);
        process.exit(1);
      }

      spinner.stop('Segment added!');

      // Find the added segment
      const addedSegment = result.value.segments.find((s) => s.id === segment.id);
      if (addedSegment) {
        console.log(`\n${formatSegment(addedSegment, result.value.segments.length)}`);
      }

      p.outro(`Added to: ${itinerary.title}`);
    });
}
