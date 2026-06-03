import stringSimilarity from 'string-similarity';
import { normalizeTeamName } from './matchEngine.js';

/**
 * Cruza as listas de jogos da Betano e Bet365 utilizando fuzzy matching.
 * @param {Array<Object>} betanoMatches Lista de partidas raspadas da Betano.
 * @param {Array<Object>} bet365Matches Lista de partidas raspadas da Bet365.
 * @param {number} threshold Limiar mínimo de similaridade (padrão: 0.65).
 * @returns {Array<Object>} Lista de jogos cruzados com odds combinadas.
 */
export function crossMatches(betanoMatches, bet365Matches, threshold = 0.65) {
  const unifiedMatches = [];

  console.log(`[Matcher] Iniciando cruzamento de ${betanoMatches.length} jogos Betano com ${bet365Matches.length} jogos Bet365...`);

  for (const matchA of betanoMatches) {
    let bestMatch = null;
    let maxRating = 0;

    const normHomeA = normalizeTeamName(matchA.homeTeam);
    const normAwayA = normalizeTeamName(matchA.awayTeam);

    for (const matchB of bet365Matches) {
      const normHomeB = normalizeTeamName(matchB.homeTeam);
      const normAwayB = normalizeTeamName(matchB.awayTeam);

      // Compara a similaridade dos times da casa e visitantes separadamente
      const homeSimilarity = stringSimilarity.compareTwoStrings(normHomeA, normHomeB);
      const awaySimilarity = stringSimilarity.compareTwoStrings(normAwayA, normAwayB);

      // Média geométrica ou simples das duas similaridades
      const averageSimilarity = (homeSimilarity + awaySimilarity) / 2;

      if (averageSimilarity > threshold && averageSimilarity > maxRating) {
        maxRating = averageSimilarity;
        bestMatch = matchB;
      }
    }

    if (bestMatch) {
      console.log(`[Matcher] Match encontrado (${(maxRating * 100).toFixed(1)}%): "${matchA.homeTeam} vs ${matchA.awayTeam}" -> "${bestMatch.homeTeam} vs ${bestMatch.awayTeam}"`);
      
      unifiedMatches.push({
        nome_padronizado: `${matchA.homeTeam} vs ${matchA.awayTeam}`,
        homeTeam: matchA.homeTeam,
        awayTeam: matchA.awayTeam,
        normalizedHome: normHomeA,
        normalizedAway: normAwayA,
        odds_betano: {
          1: Number(matchA.homeOdds.toFixed(2)),
          X: Number(matchA.drawOdds.toFixed(2)),
          2: Number(matchA.awayOdds.toFixed(2))
        },
        odds_bet365: {
          1: Number(bestMatch.homeOdds.toFixed(2)),
          X: Number(bestMatch.drawOdds.toFixed(2)),
          2: Number(bestMatch.awayOdds.toFixed(2))
        }
      });
    } else {
      console.log(`[Matcher] Sem correspondência para: ${matchA.homeTeam} vs ${matchA.awayTeam}`);
    }
  }

  console.log(`[Matcher] Cruzamento finalizado. ${unifiedMatches.length} partidas unificadas.`);
  return unifiedMatches;
}
