import { describe, it, expect } from 'vitest';
import { formatPhoneNumber, cleanPhoneNumber, isValidPhoneNumber } from '../../../viewer-svelte/src/lib/utils/phone-format';

describe('formatPhoneNumber', () => {
	it('formats US numbers correctly', () => {
		expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
		expect(formatPhoneNumber('555')).toBe('555');
		expect(formatPhoneNumber('5551234')).toBe('(555) 123-4');
	});

	it('formats international numbers correctly', () => {
		expect(formatPhoneNumber('15551234567')).toBe('+1 (555) 123-4567');
		expect(formatPhoneNumber('445551234567')).toBe('+44 (555) 123-4567');
	});

	it('handles already formatted numbers', () => {
		expect(formatPhoneNumber('(555) 123-4567')).toBe('(555) 123-4567');
		expect(formatPhoneNumber('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
	});

	it('removes non-digit characters', () => {
		expect(formatPhoneNumber('555-123-4567')).toBe('(555) 123-4567');
		expect(formatPhoneNumber('(555)123-4567')).toBe('(555) 123-4567');
	});

	it('handles empty string', () => {
		expect(formatPhoneNumber('')).toBe('');
	});

	it('handles partial input gracefully', () => {
		expect(formatPhoneNumber('5')).toBe('5');
		expect(formatPhoneNumber('55')).toBe('55');
		expect(formatPhoneNumber('555')).toBe('555');
		expect(formatPhoneNumber('5551')).toBe('(555) 1');
	});
});

describe('cleanPhoneNumber', () => {
	it('removes all formatting', () => {
		expect(cleanPhoneNumber('(555) 123-4567')).toBe('5551234567');
		expect(cleanPhoneNumber('+1 (555) 123-4567')).toBe('15551234567');
	});

	it('handles already clean numbers', () => {
		expect(cleanPhoneNumber('5551234567')).toBe('5551234567');
	});
});

describe('isValidPhoneNumber', () => {
	it('validates US numbers', () => {
		expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
		expect(isValidPhoneNumber('5551234567')).toBe(true);
	});

	it('validates international numbers', () => {
		expect(isValidPhoneNumber('+1 (555) 123-4567')).toBe(true);
		expect(isValidPhoneNumber('+44 5551234567')).toBe(true);
	});

	it('rejects invalid numbers', () => {
		expect(isValidPhoneNumber('555')).toBe(false);
		expect(isValidPhoneNumber('555-1234')).toBe(false);
		expect(isValidPhoneNumber('')).toBe(false);
	});
});
