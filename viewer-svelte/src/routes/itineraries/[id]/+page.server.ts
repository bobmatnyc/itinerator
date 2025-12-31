import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

/**
 * Server-side load function for itinerary detail page
 * This enables SSR and allows sharing direct links to itineraries
 */
export const load: PageServerLoad = async ({ params, locals }) => {
  const { id } = params;

  // Verify user is authenticated
  if (!locals.isAuthenticated) {
    throw error(401, 'Authentication required');
  }

  // Return the itinerary ID - actual data loading happens client-side
  // via the itineraries store to maintain consistency with the rest of the app
  return {
    itineraryId: id,
    userEmail: locals.userEmail
  };
};
