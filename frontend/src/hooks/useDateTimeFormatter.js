import { useCallback } from 'react';
import { formatToBrasiliaTime } from '../utils/dateFormatter.js';

/**
 * Custom React hook to safely format UTC/ISO 8601 date strings to 
 * the Brazilian fuso (America/Sao_Paulo - Horário de Brasília) of high visual standards.
 * Exposes a memoized format function using the native formatter utility.
 * 
 * @param {Intl.DateTimeFormatOptions} customOptions Custom formatting options
 * @returns {Function} A function (isoString) => string
 */
export function useDateTimeFormatter(customOptions = {}) {
  // Return format function, wrapped in useCallback to keep identity stable
  const format = useCallback((dateInput) => {
    return formatToBrasiliaTime(dateInput, customOptions);
  }, [customOptions]);

  return format;
}

export default useDateTimeFormatter;
