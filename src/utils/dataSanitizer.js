/**
 * Data Sanitizer Utility to validate and parse odds.
 * Ensures the "Motor de Soros" mathematical calculator only receives safe numeric values.
 */

/**
 * Safely converts an odd value of any type to a positive Float.
 * Handles strings with commas (e.g., "1,50"), nulls, undefined, and empty strings.
 * 
 * @param {any} value The odd value to parse
 * @param {number} fallback The fallback value if parsing fails (default: 1.01)
 * @returns {number} The safely parsed Float
 */
export function sanitizeOddsValue(value, fallback = 1.01) {
  if (value === null || value === undefined) {
    return fallback;
  }

  // If it's already a number
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value) && value >= 1.0 ? value : fallback;
  }

  // If it's a string representation
  if (typeof value === 'string') {
    let cleanStr = value.trim();
    if (cleanStr === '') {
      return fallback;
    }

    // Substitute comma with dot (e.g. "1,50" -> "1.50")
    cleanStr = cleanStr.replace(',', '.');

    const parsed = parseFloat(cleanStr);
    return !isNaN(parsed) && isFinite(parsed) && parsed >= 1.0 ? parsed : fallback;
  }

  return fallback;
}

/**
 * Safely sanitizes a coordinate object containing homeOdds, drawOdds, and awayOdds.
 * 
 * @param {Object} oddsObj An object containing odds (e.g., { homeOdds, drawOdds, awayOdds })
 * @returns {Object} A new object with sanitized Float odds
 */
export function sanitizeOddsObject(oddsObj) {
  if (!oddsObj) {
    return { homeOdds: 1.01, drawOdds: 1.01, awayOdds: 1.01 };
  }
  
  return {
    homeOdds: sanitizeOddsValue(oddsObj.homeOdds),
    drawOdds: sanitizeOddsValue(oddsObj.drawOdds),
    awayOdds: sanitizeOddsValue(oddsObj.awayOdds)
  };
}

/**
 * Scans a full list of processed match payloads and sanitizes the structure.
 * Useful as a filter in ingestion or response rendering.
 * 
 * @param {Array} matches Array of processed matches
 * @returns {Array} Sanitized matches
 */
export function sanitizeMatchesPayload(matches) {
  if (!Array.isArray(matches)) {
    return [];
  }
  
  return matches.map(match => {
    const sanitized = { ...match };
    
    if (sanitized.sportsbookA) {
      sanitized.sportsbookA = sanitizeOddsObject(sanitized.sportsbookA);
    }
    if (sanitized.sportsbookB) {
      sanitized.sportsbookB = sanitizeOddsObject(sanitized.sportsbookB);
    }
    
    return sanitized;
  });
}

/**
 * Verifies if a game satisfies all integrity conditions (no cancelled status, no esports terms, positive non-zero odds).
 * 
 * @param {Object} game Raw or parsed game object
 * @returns {boolean} True if the game is highly integral and operable
 */
export function isValidGame(game) {
  if (!game) return false;

  // 1. Status Filter
  // Checks status, match_status, state, event_status fields
  const statusFields = ['status', 'match_status', 'state', 'event_status'];
  for (const field of statusFields) {
    if (game[field] !== undefined && game[field] !== null) {
      const statusValue = String(game[field]).trim().toLowerCase();
      const forbiddenStatuses = ['cancelled', 'postponed', 'delayed', 'suspended', 'void', 'aborted', 'postergado', 'suspenso', 'cancelado'];
      if (forbiddenStatuses.some(forbidden => statusValue.includes(forbidden))) {
        return false; // Rejected due to status
      }
    }
  }

  // 2. e-Sports Filter
  // Checks league, sport_title, sport_key, home_team, away_team, homeTeam, awayTeam
  const esportsTerms = ['esports', 'e-sports', 'e-soccer', 'esoccer', 'cyber', 'ebasketball', 'e-basketball', 'league of legends', 'dota', 'counter-strike', 'pes ', 'pes20', 'efootball', 'virtual', 'fifa efoot', 'ea sports fc', 'fifa online'];
  const textFieldsToCheck = [
    game.league,
    game.sport_title,
    game.sport_key,
    game.home_team,
    game.away_team,
    game.homeTeam,
    game.awayTeam
  ];
  for (const text of textFieldsToCheck) {
    if (text) {
      const normalizedText = String(text).toLowerCase();
      if (esportsTerms.some(term => normalizedText.includes(term))) {
        return false; // Rejected due to esports term
      }
    }
  }

  // 3. Phantom Odds Filter
  // Evaluates both raw and parsed formats
  // Format A: Parsed games in dbService/leverageService { sportsbookA: { homeOdds, drawOdds, awayOdds } }
  if (game.sportsbookA || game.sportsbookB) {
    const checkOddsObj = (odds) => {
      if (!odds) return false;
      const home = sanitizeOddsValue(odds.homeOdds, 0);
      const draw = sanitizeOddsValue(odds.drawOdds, 0);
      const away = sanitizeOddsValue(odds.awayOdds, 0);
      return home > 0 && draw > 0 && away > 0;
    };
    
    // Check both A and B are operable (non-zero positive odds)
    if (game.sportsbookA && !checkOddsObj(game.sportsbookA)) return false;
    if (game.sportsbookB && !checkOddsObj(game.sportsbookB)) return false;
  } 
  // Format B: Raw events from The Odds API { bookmakers: [...] }
  else if (Array.isArray(game.bookmakers)) {
    // Check if there is at least one bookmaker with valid h2h odds
    const hasValidBookmakerOdds = game.bookmakers.some(bm => {
      const h2h = bm.markets?.find(m => m.key === 'h2h');
      if (!h2h || !Array.isArray(h2h.outcomes) || h2h.outcomes.length < 2) return false;
      
      return h2h.outcomes.every(outcome => {
        const price = sanitizeOddsValue(outcome.price, 0);
        return price > 0;
      });
    });
    
    if (!hasValidBookmakerOdds) return false; // Rejected: no valid non-zero odds found
  }
  // Format C: Direct properties on the object itself { homeOdds, drawOdds, awayOdds }
  else if (game.homeOdds !== undefined || game.drawOdds !== undefined || game.awayOdds !== undefined) {
    const home = sanitizeOddsValue(game.homeOdds, 0);
    const draw = sanitizeOddsValue(game.drawOdds, 0);
    const away = sanitizeOddsValue(game.awayOdds, 0);
    if (home <= 0 || draw <= 0 || away <= 0) {
      return false; // Rejected: invalid/zero odds
    }
  }

  return true; // Passed all integrity rules!
}

/**
 * Filter an array of games or match objects, removing any that fail integrity rules.
 * 
 * @param {Array} games Array of game objects (raw or processed)
 * @returns {Array} Integral games list
 */
export function filterIntegrity(games) {
  if (!Array.isArray(games)) return [];
  return games.filter(isValidGame);
}

/**
 * Express Middleware to sanitize incoming payloads in request bodies.
 * Provides defense-in-depth on POST/PUT requests with odds data.
 */
export function oddsSanitizerMiddleware(req, res, next) {
  if (req.body) {
    if (Array.isArray(req.body.matches)) {
      req.body.matches = filterIntegrity(sanitizeMatchesPayload(req.body.matches));
    } else if (req.body.homeOdds || req.body.drawOdds || req.body.awayOdds) {
      req.body.homeOdds = sanitizeOddsValue(req.body.homeOdds);
      req.body.drawOdds = sanitizeOddsValue(req.body.drawOdds);
      req.body.awayOdds = sanitizeOddsValue(req.body.awayOdds);
    }
  }
  next();
}

export default {
  sanitizeOddsValue,
  sanitizeOddsObject,
  sanitizeMatchesPayload,
  oddsSanitizerMiddleware,
  isValidGame,
  filterIntegrity
};
