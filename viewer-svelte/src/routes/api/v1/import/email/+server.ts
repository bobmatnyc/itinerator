/**
 * Email Import Webhook - Receives emails from inbound.new
 * POST /api/v1/import/email - Process incoming email and extract bookings
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImportService } from '../../../../../src/services/import/index.js';
import { generateSegmentId } from '../../../../../src/domain/types/branded.js';

/**
 * Inbound.new webhook payload structure
 */
interface InboundWebhookPayload {
  event: 'email.received';
  timestamp: string;
  email: {
    id: string;
    messageId: string;
    from: string;
    to: string[];
    subject: string;
    receivedAt: string;
    parsedData: {
      from: { address: string; name?: string };
      to: { address: string; name?: string }[];
      subject: string;
      textBody: string;
      htmlBody: string;
      attachments: Array<{
        filename: string;
        contentType: string;
        size: number;
        url: string;
      }>;
      headers: Record<string, string>;
      inReplyTo?: string;
      references?: string[];
      date: string;
    };
  };
}

/**
 * POST /api/v1/import/email
 * Webhook endpoint for inbound.new email service
 *
 * Flow:
 * 1. Validate webhook signature/API key
 * 2. Extract sender email to find matching user
 * 3. Pass email to LLM for booking extraction
 * 4. Find or create itinerary for user
 * 5. Add extracted segments to itinerary
 * 6. Return 200 OK to inbound.new
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  console.log('[POST /import/email] Received webhook');

  try {
    // Validate API key from header
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedKey = process.env.INBOUND_API_KEY;

    if (!expectedKey) {
      console.error('[POST /import/email] INBOUND_API_KEY not configured');
      throw error(500, {
        message: 'Email import service not configured'
      });
    }

    if (!apiKey || apiKey !== expectedKey) {
      console.error('[POST /import/email] Invalid API key');
      throw error(401, {
        message: 'Invalid API key'
      });
    }

    // Parse webhook payload
    const payload = await request.json() as InboundWebhookPayload;
    console.log('[POST /import/email] Webhook payload:', {
      event: payload.event,
      emailId: payload.email.id,
      from: payload.email.parsedData.from.address,
      subject: payload.email.parsedData.subject,
    });

    // Validate event type
    if (payload.event !== 'email.received') {
      console.error('[POST /import/email] Unexpected event type:', payload.event);
      throw error(400, {
        message: `Unsupported event type: ${payload.event}`
      });
    }

    // Extract sender email to identify user
    const senderEmail = payload.email.parsedData.from.address;
    console.log('[POST /import/email] Sender email:', senderEmail);

    // Initialize email import service
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      console.error('[POST /import/email] OPENROUTER_API_KEY not configured');
      throw error(500, {
        message: 'Email extraction service not configured'
      });
    }

    const importService = new ImportService({
      apiKey: openrouterApiKey,
    });

    // Use HTML body for better Schema.org extraction, fallback to text
    const emailContent = payload.email.parsedData.htmlBody || payload.email.parsedData.textBody;

    // Extract bookings from email
    console.log('[POST /import/email] Extracting bookings...');
    const extractionResult = await importService.importFromEmail(emailContent, {
      fromEmail: payload.email.parsedData.from.address,
      subject: payload.email.parsedData.subject,
      receivedAt: payload.email.parsedData.date,
    });

    if (!extractionResult.success) {
      console.error('[POST /import/email] Extraction failed:', extractionResult.errors);
      throw error(400, {
        message: `Failed to extract bookings: ${extractionResult.errors?.join(', ')}`
      });
    }

    const { segments, confidence, summary, errors: warnings } = extractionResult;
    console.log('[POST /import/email] Extracted bookings:', {
      segmentCount: segments.length,
      confidence,
      summary,
      warnings,
    });

    // If no segments found, return early with info
    if (segments.length === 0) {
      console.log('[POST /import/email] No bookings found in email');
      return json({
        success: true,
        message: 'No travel bookings found in email',
        confidence,
        summary,
      }, { status: 200 });
    }

    // Find user's most recent itinerary or create new one
    const { storage, collectionService, segmentService } = locals.services;

    // List user's itineraries
    const listResult = await storage.listByUser(senderEmail);
    if (!listResult.success) {
      console.error('[POST /import/email] Failed to list itineraries:', listResult.error);
      throw error(500, {
        message: 'Failed to load user itineraries'
      });
    }

    let itineraryId;
    const itineraries = listResult.value;

    if (itineraries.length === 0) {
      // Create new itinerary for user
      console.log('[POST /import/email] Creating new itinerary for user:', senderEmail);
      const createResult = await collectionService.createItinerary({
        title: `Email Import - ${payload.email.parsedData.subject}`,
        description: `Imported from email received on ${new Date(payload.email.parsedData.date).toLocaleDateString()}`,
        createdBy: senderEmail,
      });

      if (!createResult.success) {
        console.error('[POST /import/email] Failed to create itinerary:', createResult.error);
        throw error(500, {
          message: 'Failed to create itinerary'
        });
      }

      itineraryId = createResult.value.id;
      console.log('[POST /import/email] Created itinerary:', itineraryId);
    } else {
      // Use most recent itinerary (sorted by updatedAt desc)
      const sortedItineraries = [...itineraries].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      itineraryId = sortedItineraries[0].id;
      console.log('[POST /import/email] Using existing itinerary:', itineraryId);
    }

    // Add each segment to the itinerary
    const addedSegments = [];
    const errors = [];

    for (const segment of segments) {
      // Add segment ID and required metadata
      const segmentWithId = {
        ...segment,
        id: generateSegmentId(),
        metadata: {
          importedFrom: 'email',
          emailId: payload.email.id,
          emailSubject: payload.email.parsedData.subject,
          emailDate: payload.email.parsedData.date,
        },
        travelerIds: [], // Empty initially - user can assign later
      };

      const addResult = await segmentService.add(itineraryId, segmentWithId);

      if (addResult.success) {
        addedSegments.push(segmentWithId.id);
        console.log('[POST /import/email] Added segment:', segmentWithId.id, segmentWithId.type);
      } else {
        console.error('[POST /import/email] Failed to add segment:', addResult.error);
        errors.push({
          segment: segment.type,
          error: addResult.error.message,
        });
      }
    }

    console.log('[POST /import/email] Import complete:', {
      itineraryId,
      addedSegments: addedSegments.length,
      errors: errors.length,
    });

    // Return success response to inbound.new
    return json({
      success: true,
      message: `Imported ${addedSegments.length} booking(s) to itinerary`,
      itineraryId,
      segments: addedSegments,
      confidence,
      summary,
      warnings,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 200 });

  } catch (err) {
    console.error('[POST /import/email] Unexpected error:', err);

    // If it's already an error response, re-throw
    if (err instanceof Error && 'status' in err) {
      throw err;
    }

    // Return generic error
    throw error(500, {
      message: err instanceof Error ? err.message : 'Internal server error'
    });
  }
};
