/**
 * Mathematical & String Matching Utilities for Sports Arbitrage and EV+ calculations.
 * Implemented strictly in zero-dependency native JavaScript (ES6+).
 */

/**
 * Safely converts American odds (e.g. +248, 248, -361, "+150", "-110") to Decimal odds (Float).
 * 
 * Formula:
 * - For positive odds (A > 0): Decimal = (A / 100) + 1
 * - For negative odds (A < 0): Decimal = (100 / |A|) + 1
 * 
 * @param {number|string} american Value to convert
 * @param {number} fallback Fallback if conversion fails (default: 1.01)
 * @returns {number} Decimals representation of American odds
 */
export function americanToDecimal(american, fallback = 1.01) {
  if (american === null || american === undefined) return fallback;

  let parsed = 0;
  if (typeof american === 'number') {
    parsed = american;
  } else if (typeof american === 'string') {
    // Remove spaces, plus sign, and parse
    const cleanStr = american.trim().replace('+', '').replace(',', '.');
    parsed = parseFloat(cleanStr);
  } else {
    return fallback;
  }

  if (isNaN(parsed) || !isFinite(parsed) || parsed === 0) {
    return fallback;
  }

  try {
    if (parsed > 0) {
      return Number(((parsed / 100) + 1).toFixed(3));
    } else {
      return Number(((100 / Math.abs(parsed)) + 1).toFixed(3));
    }
  } catch (error) {
    console.error('[mathUtils] Error in americanToDecimal:', error.message);
    return fallback;
  }
}

/**
 * Implements the standard three-way (Home, Draw, Away) juice/margin removal (Desvigagem).
 * Yields the "True Probabilities" (Desvigiadas) for each event outcome.
 * 
 * Steps:
 * 1. Convert decimal odds into implied probabilities: P = 1 / Decimal
 * 2. Sum implied probabilities to get the overround (juice/margin): Overround = P_home + P_draw + P_away
 * 3. Divide each individual probability by the Overround to normalize and get True Probability.
 * 
 * @param {number} decimalHome Decimal odds for Home victory
 * @param {number} decimalDraw Decimal odds for Draw
 * @param {number} decimalAway Decimal odds for Away victory
 * @returns {Object} True probabilities and margin { homeProb, drawProb, awayProb, margin }
 */
export function removeVigAndGetTrueProbabilities(decimalHome, decimalDraw, decimalAway) {
  // Ensure valid decimal thresholds
  const h = Number(decimalHome) > 1.0 ? Number(decimalHome) : 1.01;
  const d = Number(decimalDraw) > 1.0 ? Number(decimalDraw) : 1.01;
  const a = Number(decimalAway) > 1.0 ? Number(decimalAway) : 1.01;

  // Implied Probabilities
  const impHome = 1 / h;
  const impDraw = 1 / d;
  const impAway = 1 / a;

  // Overround
  const overround = impHome + impDraw + impAway;

  // True Probabilities (normalized)
  const trueHome = impHome / overround;
  const trueDraw = impDraw / overround;
  const trueAway = impAway / overround;

  return {
    homeProb: Number(trueHome.toFixed(4)),
    drawProb: Number(trueDraw.toFixed(4)),
    awayProb: Number(trueAway.toFixed(4)),
    margin: Number((overround - 1.0).toFixed(4))
  };
}

/**
 * Calculates the classic Levenshtein Distance between two strings using Dynamic Programming.
 * Zero external libraries. High-performance iteration.
 * 
 * @param {string} s1 First string
 * @param {string} s2 Second string
 * @returns {number} The edit distance between strings
 */
export function levenshteinDistance(s1, s2) {
  const len1 = s1.length;
  const len2 = s2.length;

  const matrix = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // Deletion
        matrix[i][j - 1] + 1,       // Insertion
        matrix[i - 1][j - 1] + cost  // Substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Helper to normalize string for comparison by lowercasing, stripping accents NFD,
 * and deleting all non-alphanumeric characters.
 * 
 * @param {string} str String to clean
 * @returns {string} Fully normalized string
 */
function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strips accents
    .replace(/[^a-z0-9]/g, ''); // Removes spaces and special chars to focus on Levenshtein
}

/**
 * Calculates a Levenshtein-based similarity score (ratio) between 0.0 and 1.0.
 * 
 * Formula:
 * ratio = 1 - (levenshteinDistance / max(string1_length, string2_length))
 * 
 * @param {string} str1 First string
 * @param {string} str2 Second string
 * @returns {number} Similarity ratio from 0.0 (totally different) to 1.0 (exact match)
 */
export function getSimilarityRatio(str1, str2) {
  const clean1 = normalizeString(str1);
  const clean2 = normalizeString(str2);

  if (clean1 === clean2) return 1.0;
  if (clean1.length === 0 || clean2.length === 0) return 0.0;

  const distance = levenshteinDistance(clean1, clean2);
  const maxLength = Math.max(clean1.length, clean2.length);

  return Number((1.0 - distance / maxLength).toFixed(4));
}

export default {
  americanToDecimal,
  removeVigAndGetTrueProbabilities,
  levenshteinDistance,
  getSimilarityRatio
};
