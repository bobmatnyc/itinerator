/**
 * Phone number formatting utilities
 */

/**
 * Format phone number as user types
 * US format: (XXX) XXX-XXXX for 10 digits
 * International format: +X XXX XXX XXXX for 11+ digits
 */
export function formatPhoneNumber(value: string): string {
	// Remove all non-digits
	const digits = value.replace(/\D/g, '');

	// Empty input
	if (digits.length === 0) {
		return '';
	}

	// US format (10 digits or less)
	if (digits.length <= 10) {
		if (digits.length <= 3) {
			return digits;
		} else if (digits.length <= 6) {
			return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
		} else {
			return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
		}
	}

	// International format (11+ digits)
	// Assume +1 country code for 11 digits, otherwise use all leading digits as country code
	const countryCode = digits.slice(0, digits.length - 10);
	const remaining = digits.slice(-10);
	return `+${countryCode} (${remaining.slice(0, 3)}) ${remaining.slice(3, 6)}-${remaining.slice(6)}`;
}

/**
 * Clean phone number for storage (remove formatting)
 */
export function cleanPhoneNumber(formatted: string): string {
	return formatted.replace(/\D/g, '');
}

/**
 * Validate phone number (basic check for at least 10 digits)
 */
export function isValidPhoneNumber(value: string): boolean {
	const digits = value.replace(/\D/g, '');
	return digits.length >= 10;
}
