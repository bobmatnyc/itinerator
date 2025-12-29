/**
 * Upload Import API Route
 * POST /api/v1/import/upload
 * Upload file (PDF, ICS, JSON, etc.) and extract booking data
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImportService } from '../../../../../services/import/index.js';
import { OPENROUTER_API_KEY } from '$env/static/private';

/**
 * POST /api/v1/import/upload
 * Upload file and extract booking data
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Check API key
    if (!OPENROUTER_API_KEY) {
      return error(500, 'OPENROUTER_API_KEY not configured');
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return error(400, 'No file provided');
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());

    // Initialize import service
    const importService = new ImportService({
      apiKey: OPENROUTER_API_KEY,
    });

    // Import from upload
    const result = await importService.importFromUpload(
      buffer,
      file.name,
      file.type
    );

    // Return result
    return json(result);
  } catch (err) {
    console.error('Upload import error:', err);
    return error(500, err instanceof Error ? err.message : 'Failed to process upload');
  }
};
