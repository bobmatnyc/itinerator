/**
 * Location and address types
 * @module domain/types/location
 */

/**
 * Geographic coordinates
 */
export interface Coordinates {
  /** Latitude in decimal degrees (-90 to 90) */
  latitude: number;
  /** Longitude in decimal degrees (-180 to 180) */
  longitude: number;
}

/**
 * Physical address
 */
export interface Address {
  /** Street address */
  street?: string;
  /** City name */
  city?: string;
  /** State or province */
  state?: string;
  /** Postal or ZIP code */
  postalCode?: string;
  /** Country (ISO 3166-1 alpha-2 code) */
  country: string;
}

/**
 * Location with optional address and coordinates
 */
export interface Location {
  /** Location name (e.g., airport name, venue name) */
  name: string;
  /** IATA airport or city code */
  code?: string;
  /** City name */
  city?: string;
  /** Country name */
  country?: string;
  /** Physical address */
  address?: Address;
  /** Geographic coordinates */
  coordinates?: Coordinates;
  /** IANA timezone identifier */
  timezone?: string;
}

/**
 * Company or service provider
 */
export interface Company {
  /** Company name */
  name: string;
  /** Company code (e.g., airline IATA code) */
  code?: string;
  /** Company website URL */
  website?: string;
}
