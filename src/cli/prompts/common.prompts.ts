/**
 * Common prompt utilities
 * @module cli/prompts/common.prompts
 */

import * as p from '@clack/prompts';

/**
 * Handle cancelled prompts - exit gracefully
 * @param value - The prompt result to check
 */
export function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }
}

/**
 * Prompt for a date with validation
 * @param message - The prompt message
 * @param placeholder - Optional placeholder text
 * @returns A valid Date object
 */
export async function promptDate(message: string, placeholder?: string): Promise<Date> {
  const dateStr = await p.text({
    message,
    placeholder: placeholder || 'YYYY-MM-DD',
    validate: (value) => {
      if (!value) {
        return 'Date is required';
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return 'Invalid date format. Use YYYY-MM-DD';
      }
      return undefined;
    },
  });

  handleCancel(dateStr);

  return new Date(dateStr as string);
}

/**
 * Prompt for required text
 * @param message - The prompt message
 * @param placeholder - Optional placeholder text
 * @param initialValue - Optional initial value
 * @returns A non-empty string
 */
export async function promptText(
  message: string,
  placeholder?: string,
  initialValue?: string
): Promise<string> {
  const text = await p.text({
    message,
    ...(placeholder && { placeholder }),
    ...(initialValue && { initialValue }),
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'This field is required';
      }
      return undefined;
    },
  });

  handleCancel(text);

  return text as string;
}

/**
 * Prompt for optional text
 * @param message - The prompt message
 * @param placeholder - Optional placeholder text
 * @param initialValue - Optional initial value
 * @returns A string or undefined if empty
 */
export async function promptOptionalText(
  message: string,
  placeholder?: string,
  initialValue?: string
): Promise<string | undefined> {
  const text = await p.text({
    message,
    ...(placeholder && { placeholder }),
    ...(initialValue && { initialValue }),
  });

  handleCancel(text);

  const textStr = text as string;
  return textStr && textStr.trim().length > 0 ? textStr : undefined;
}

/**
 * Prompt for confirmation
 * @param message - The prompt message
 * @param initialValue - Optional initial value (default: false)
 * @returns True if confirmed, false otherwise
 */
export async function promptConfirm(message: string, initialValue = false): Promise<boolean> {
  const confirmed = await p.confirm({
    message,
    initialValue,
  });

  handleCancel(confirmed);

  return confirmed as boolean;
}
