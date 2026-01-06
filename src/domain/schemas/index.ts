/**
 * Domain validation schemas entry point
 * @module domain/schemas
 */

// Common schemas
export {
  boardBasisSchema,
  cabinClassSchema,
  dateSchema,
  isoDateSchema,
  itineraryIdSchema,
  itineraryStatusSchema,
  seatPreferenceSchema,
  segmentIdSchema,
  segmentStatusSchema,
  segmentTypeSchema,
  timeSchema,
  transferTypeSchema,
  travelerIdSchema,
  travelerTypeSchema,
  tripTypeSchema,
  uuidSchema,
} from './common.schema.js';

// Location schemas
export {
  addressSchema,
  companySchema,
  coordinatesSchema,
  locationSchema,
} from './location.schema.js';

// Money schemas
export { currencyCodeSchema, moneyInputSchema, moneySchema } from './money.schema.js';

// Traveler schemas
export {
  loyaltyProgramSchema,
  travelPreferencesSchema,
  travelStyleSchema,
  travelerInputSchema,
  travelerSchema,
  type TravelerCreateInput,
  type TravelerInput,
  type TravelerOutput,
} from './traveler.schema.js';

// Segment schemas
export {
  activitySegmentSchema,
  customSegmentSchema,
  flightSegmentSchema,
  hotelSegmentSchema,
  meetingSegmentSchema,
  segmentSchema,
  transferSegmentSchema,
  type ActivitySegmentInput,
  type CustomSegmentInput,
  type FlightSegmentInput,
  type HotelSegmentInput,
  type MeetingSegmentInput,
  type SegmentInput,
  type SegmentOutput,
  type TransferSegmentInput,
} from './segment.schema.js';

// Scratchpad schemas
export {
  addToScratchpadSchema,
  scratchpadByTypeSchema,
  scratchpadItemIdSchema,
  scratchpadItemSchema,
  scratchpadPrioritySchema,
  scratchpadSchema,
  scratchpadSourceSchema,
  swapResultSchema,
  type AddToScratchpadInput,
  type ScratchpadInput,
  type ScratchpadItemInput,
  type ScratchpadItemOutput,
  type ScratchpadOutput,
  type SwapResultOutput,
} from './scratchpad.schema.js';

// Itinerary schemas
export {
  itineraryCreateSchema,
  itinerarySchema,
  itineraryUpdateSchema,
  type ItineraryCreateInput,
  type ItineraryInput,
  type ItineraryOutput,
  type ItineraryUpdateInput,
} from './itinerary.schema.js';

// Tool argument schemas
export {
  addActivityArgsSchema,
  addFlightArgsSchema,
  addHotelArgsSchema,
  addMeetingArgsSchema,
  addTransferArgsSchema,
  addTravelerArgsSchema,
  addToScratchpadArgsSchema,
  deleteSegmentArgsSchema,
  geocodeLocationArgsSchema,
  getDistanceArgsSchema,
  getSegmentArgsSchema,
  moveSegmentArgsSchema,
  reorderSegmentsArgsSchema,
  retrieveTravelIntelligenceArgsSchema,
  searchFlightsArgsSchema,
  searchHotelsArgsSchema,
  searchTransfersArgsSchema,
  searchWebArgsSchema,
  showRouteArgsSchema,
  storeTravelIntelligenceArgsSchema,
  switchToTripDesignerArgsSchema,
  updateItineraryArgsSchema,
  updatePreferencesArgsSchema,
  updateSegmentArgsSchema,
} from './tool-args.schema.js';
