/**
 * Schema.org Extractor - Extract booking data from Schema.org JSON-LD
 * @module services/import/extractors/schema-org
 */

import type { ImportResult, ImportFormat, ExtractedSegment } from '../types.js';
import { extractSchemaOrg } from '../utils/html-to-text.js';
import { SegmentType, SegmentStatus } from '../../../domain/types/common.js';

/**
 * Schema.org extractor for structured data
 */
export class SchemaOrgExtractor {
  /**
   * Extract booking data from HTML with Schema.org JSON-LD
   */
  async extract(html: string, format: ImportFormat): Promise<ImportResult> {
    const schemas = extractSchemaOrg(html);

    if (schemas.length === 0) {
      return {
        success: false,
        format,
        segments: [],
        confidence: 0,
        errors: ['No Schema.org JSON-LD found in HTML'],
      };
    }

    const segments: ExtractedSegment[] = [];
    const errors: string[] = [];

    for (const schema of schemas) {
      try {
        const segment = this.convertSchemaToSegment(schema);
        if (segment) {
          segments.push(segment);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    return {
      success: segments.length > 0,
      format,
      segments,
      confidence: segments.length > 0 ? 0.95 : 0, // High confidence for structured data
      errors: errors.length > 0 ? errors : undefined,
      summary: `Found ${segments.length} booking(s) from Schema.org data`,
    };
  }

  /**
   * Convert Schema.org object to segment
   */
  private convertSchemaToSegment(schema: any): ExtractedSegment | null {
    const type = schema['@type'];

    switch (type) {
      case 'FlightReservation':
        return this.convertFlightReservation(schema);
      case 'LodgingReservation':
        return this.convertLodgingReservation(schema);
      case 'EventReservation':
        return this.convertEventReservation(schema);
      case 'RentalCarReservation':
        return this.convertRentalCarReservation(schema);
      case 'FoodEstablishmentReservation':
        return this.convertRestaurantReservation(schema);
      default:
        console.warn(`Unknown Schema.org type: ${type}`);
        return null;
    }
  }

  /**
   * Convert FlightReservation to flight segment
   */
  private convertFlightReservation(schema: any): ExtractedSegment {
    const flight = schema.reservationFor || {};
    const ticket = schema.reservedTicket || {};

    return {
      type: SegmentType.FLIGHT,
      status: this.mapReservationStatus(schema.reservationStatus),
      startDatetime: new Date(flight.departureTime),
      endDatetime: new Date(flight.arrivalTime),
      confirmationNumber: schema.reservationNumber || schema.confirmationNumber,
      bookingReference: schema.reservationId,
      airline: {
        name: flight.provider?.name || flight.airline?.name || '',
        code: flight.provider?.iataCode || flight.airline?.iataCode || '',
      },
      flightNumber: flight.flightNumber || '',
      origin: {
        name: flight.departureAirport?.name || '',
        code: flight.departureAirport?.iataCode || '',
        city: flight.departureAirport?.address?.addressLocality || '',
        country: flight.departureAirport?.address?.addressCountry || '',
      },
      destination: {
        name: flight.arrivalAirport?.name || '',
        code: flight.arrivalAirport?.iataCode || '',
        city: flight.arrivalAirport?.address?.addressLocality || '',
        country: flight.arrivalAirport?.address?.addressCountry || '',
      },
      seatAssignments: ticket.ticketedSeat?.seatNumber
        ? { default: ticket.ticketedSeat.seatNumber }
        : undefined,
      price: schema.totalPrice
        ? { amount: parseFloat(schema.totalPrice), currency: schema.priceCurrency || 'USD' }
        : undefined,
      confidence: 0.95,
      inferred: false,
    } as ExtractedSegment;
  }

  /**
   * Convert LodgingReservation to hotel segment
   */
  private convertLodgingReservation(schema: any): ExtractedSegment {
    const lodging = schema.reservationFor || {};

    return {
      type: SegmentType.HOTEL,
      status: this.mapReservationStatus(schema.reservationStatus),
      startDatetime: new Date(schema.checkinTime || schema.checkinDate),
      endDatetime: new Date(schema.checkoutTime || schema.checkoutDate),
      confirmationNumber: schema.reservationNumber || schema.confirmationNumber,
      bookingReference: schema.reservationId,
      property: {
        name: lodging.name || '',
        code: '',
      },
      location: {
        name: lodging.name || '',
        address: this.formatAddress(lodging.address),
        city: lodging.address?.addressLocality || '',
        country: lodging.address?.addressCountry || '',
      },
      checkInDate: new Date(schema.checkinDate || schema.checkinTime),
      checkOutDate: new Date(schema.checkoutDate || schema.checkoutTime),
      checkInTime: this.extractTime(schema.checkinTime) || '15:00',
      checkOutTime: this.extractTime(schema.checkoutTime) || '11:00',
      roomCount: 1,
      price: schema.totalPrice
        ? { amount: parseFloat(schema.totalPrice), currency: schema.priceCurrency || 'USD' }
        : undefined,
      confidence: 0.95,
      inferred: false,
    } as ExtractedSegment;
  }

  /**
   * Convert EventReservation to activity segment
   */
  private convertEventReservation(schema: any): ExtractedSegment {
    const event = schema.reservationFor || {};

    return {
      type: SegmentType.ACTIVITY,
      status: this.mapReservationStatus(schema.reservationStatus),
      startDatetime: new Date(event.startDate),
      endDatetime: new Date(event.endDate || event.startDate),
      confirmationNumber: schema.reservationNumber || schema.confirmationNumber,
      bookingReference: schema.reservationId,
      name: event.name || '',
      description: event.description,
      location: {
        name: event.location?.name || '',
        address: this.formatAddress(event.location?.address),
        city: event.location?.address?.addressLocality || '',
        country: event.location?.address?.addressCountry || '',
      },
      voucherNumber: schema.ticketNumber,
      price: schema.totalPrice
        ? { amount: parseFloat(schema.totalPrice), currency: schema.priceCurrency || 'USD' }
        : undefined,
      confidence: 0.95,
      inferred: false,
    } as ExtractedSegment;
  }

  /**
   * Convert RentalCarReservation to transfer segment
   */
  private convertRentalCarReservation(schema: any): ExtractedSegment {
    const car = schema.reservationFor || {};
    const pickup = schema.pickupLocation || {};
    const dropoff = schema.dropoffLocation || pickup;

    return {
      type: SegmentType.TRANSFER,
      status: this.mapReservationStatus(schema.reservationStatus),
      startDatetime: new Date(schema.pickupTime),
      endDatetime: new Date(schema.dropoffTime),
      confirmationNumber: schema.reservationNumber || schema.confirmationNumber,
      bookingReference: schema.reservationId,
      transferType: 'RENTAL_CAR',
      pickupLocation: {
        name: pickup.name || '',
        address: this.formatAddress(pickup.address),
        city: pickup.address?.addressLocality || '',
        country: pickup.address?.addressCountry || '',
      },
      dropoffLocation: {
        name: dropoff.name || '',
        address: this.formatAddress(dropoff.address),
        city: dropoff.address?.addressLocality || '',
        country: dropoff.address?.addressCountry || '',
      },
      vehicleDetails: car.name || car.model,
      price: schema.totalPrice
        ? { amount: parseFloat(schema.totalPrice), currency: schema.priceCurrency || 'USD' }
        : undefined,
      confidence: 0.95,
      inferred: false,
    } as ExtractedSegment;
  }

  /**
   * Convert FoodEstablishmentReservation to activity segment
   */
  private convertRestaurantReservation(schema: any): ExtractedSegment {
    const restaurant = schema.reservationFor || {};
    const startTime = new Date(schema.startTime);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

    return {
      type: SegmentType.ACTIVITY,
      status: this.mapReservationStatus(schema.reservationStatus),
      startDatetime: startTime,
      endDatetime: endTime,
      confirmationNumber: schema.reservationNumber || schema.confirmationNumber,
      bookingReference: schema.reservationId,
      name: `Dinner at ${restaurant.name}`,
      description: `Reservation for ${schema.partySize || 2} people`,
      location: {
        name: restaurant.name || '',
        address: this.formatAddress(restaurant.address),
        city: restaurant.address?.addressLocality || '',
        country: restaurant.address?.addressCountry || '',
      },
      category: 'Restaurant',
      confidence: 0.95,
      inferred: false,
    } as ExtractedSegment;
  }

  /**
   * Map Schema.org reservation status to our status
   */
  private mapReservationStatus(status: string): SegmentStatus {
    if (!status) return SegmentStatus.TENTATIVE;

    const normalized = status.toLowerCase();
    if (normalized.includes('confirmed')) return SegmentStatus.CONFIRMED;
    if (normalized.includes('pending')) return SegmentStatus.TENTATIVE;
    if (normalized.includes('cancelled')) return SegmentStatus.CANCELLED;

    return SegmentStatus.CONFIRMED;
  }

  /**
   * Format address from Schema.org PostalAddress
   */
  private formatAddress(address: any): string {
    if (!address) return '';

    const parts = [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode,
      address.addressCountry,
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Extract time from datetime string
   */
  private extractTime(datetime: string | undefined): string | undefined {
    if (!datetime) return undefined;

    try {
      const date = new Date(datetime);
      return date.toTimeString().substring(0, 5); // HH:MM
    } catch {
      return undefined;
    }
  }
}
