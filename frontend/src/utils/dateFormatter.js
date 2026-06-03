/**
 * Utility function to convert and format UTC ISO 8601 date strings or Date objects
 * to the Brazilian Brasília Timezone (America/Sao_Paulo) using strictly the native Intl.DateTimeFormat API.
 * Ensures an absolute zero-dependency footprint and high-end styling.
 * 
 * @param {string|Date} dateInput The ISO date string or Date object
 * @param {Intl.DateTimeFormatOptions} [customOptions] Optional custom formatting overrides
 * @returns {string} Fully localized date-time string, or 'Data inválida' fallback
 */
export function formatToBrasiliaTime(dateInput, customOptions = {}) {
  if (!dateInput) return 'Data inválida';

  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

    // Validate that the date is actually valid
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }

    const defaultOptions = {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    };

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      ...defaultOptions,
      ...customOptions
    });

    return formatter.format(date);
  } catch (error) {
    console.error('[formatToBrasiliaTime] Failed to format date:', error);
    return 'Data inválida';
  }
}

export default formatToBrasiliaTime;
