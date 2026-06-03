import 'dotenv/config';
import { interceptAndSanitizeOddsPayload } from './matchEngine.js';
import { sanitizeOddsValue, isValidGame } from './dataSanitizer.js';
import MemoryCache from './memoryCache.js';

// Bookmakers considerados "sharp" (eficientes, sem margem alta) — usados como referência de EV
const SHARP_BOOKS = ['pinnacle', 'marathonbet', 'betfair_ex_eu', 'betfair_sb_uk', 'betfair_ex_uk', 'onexbet'];

// Bookmakers preferenciais para sportsbookA (prioridade: Betano e similares)
const BOOKS_PRIORITY_A = ['betano', 'bwin', 'unibet_nl', 'unibet_fr', 'winamax_fr', 'winamax_de', 'betclic_fr', 'tipico_de', 'nordicbet'];

// Bookmakers preferenciais para sportsbookB (prioridade: Bet365 e similares)
const BOOKS_PRIORITY_B = ['bet365', 'bet365_eu', 'ladbrokes_uk', 'paddypower', 'skybet', 'coral', 'casumo', 'leovegas', 'leovegas_se', 'livescorebet', 'grosvenor', 'virginbet'];

export class OddsBlazeService {
  constructor() {
    this.apiKey = process.env.THE_ODDS_API_KEY;
    if (!this.apiKey) {
      console.error('[TheOddsApiService] ERRO CRÍTICO: THE_ODDS_API_KEY não está definida no .env. Nenhum dado real será coletado.');
    }
  }

  /**
   * Extrai odds H2H reais de um bookmaker para um evento específico.
   * Retorna null se as odds não estiverem disponíveis ou incompletas.
   */
  extractH2HOdds(bookmaker, homeTeam, awayTeam) {
    if (!bookmaker) return null;
    const h2h = bookmaker.markets?.find(m => m.key === 'h2h');
    if (!h2h || !Array.isArray(h2h.outcomes)) return null;

    let homeOdds = null;
    let drawOdds = null;
    let awayOdds = null;

    for (const outcome of h2h.outcomes) {
      const name = outcome.name;
      const price = sanitizeOddsValue(outcome.price);
      if (!price || price < 1.01) continue;
      if (name === homeTeam) homeOdds = price;
      else if (name === awayTeam) awayOdds = price;
      else if (name.toLowerCase() === 'draw' || name.toLowerCase() === 'empate') drawOdds = price;
    }

    // Exige as três odds completas para ser válido (H2H 1X2)
    if (!homeOdds || !drawOdds || !awayOdds) return null;
    return { homeOdds, drawOdds, awayOdds };
  }

  /**
   * Seleciona o melhor bookmaker disponível em um evento, seguindo lista de prioridade.
   * @param {Array} bookmakers Lista de bookmakers do evento
   * @param {Array} priorityList Lista de keys preferidos, em ordem
   * @param {Array} excludeKeys Keys de bookmakers a excluir (ex: já usados)
   * @param {string} homeTeam
   * @param {string} awayTeam
   * @returns {{ key: string, name: string, homeOdds, drawOdds, awayOdds } | null}
   */
  selectBookmaker(bookmakers, priorityList, excludeKeys, homeTeam, awayTeam) {
    if (!bookmakers) return null;

    // Primeiro: tentar bookmakers preferidos na ordem da lista
    for (const preferredKey of priorityList) {
      const bm = bookmakers.find(b => b.key === preferredKey && !excludeKeys.includes(b.key));
      if (!bm) continue;
      const odds = this.extractH2HOdds(bm, homeTeam, awayTeam);
      if (odds) return { key: bm.key, name: bm.title, ...odds };
    }

    // Segundo: aceitar qualquer bookmaker disponível não excluído
    for (const bm of bookmakers) {
      if (excludeKeys.includes(bm.key)) continue;
      if (SHARP_BOOKS.includes(bm.key)) continue; // Sharp books reservados para sharpOdds
      const odds = this.extractH2HOdds(bm, homeTeam, awayTeam);
      if (odds) return { key: bm.key, name: bm.title, ...odds };
    }

    return null;
  }

  /**
   * Consulta The Odds API para obter odds decimais reais da liga desejada.
   * Usa os bookmakers REALMENTE presentes no payload — sem simulação de dados.
   * @param {string} sportKey Chave do esporte (ex: soccer_conmebol_copa_libertadores)
   * @returns {Promise<Array<Object>>} Lista de partidas normalizadas com odds reais.
   */
  async fetchOdds(sportKey) {
    if (!this.apiKey) return [];

    const cacheKey = `odds_${sportKey}`;
    const cachedData = MemoryCache.get(cacheKey);
    if (cachedData) {
      console.log(`[TheOddsApiService] [CACHE HIT] Retornando odds em cache para: ${sportKey}`);
      return cachedData;
    }

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${this.apiKey}&regions=eu,uk&markets=h2h&oddsFormat=decimal`;
    console.log(`[TheOddsApiService] Consultando: ${url.replace(this.apiKey, '***')}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const body = await response.text();
        console.error(`[TheOddsApiService] Erro HTTP ${response.status}: ${body}`);
        return [];
      }

      let events = await response.json();

      // Log de quota restante (útil para monitorar uso da chave gratuita)
      const remainingReqs = response.headers.get('x-requests-remaining');
      const usedReqs = response.headers.get('x-requests-used');
      if (remainingReqs !== null) {
        console.log(`[TheOddsApiService] Quota da API: ${usedReqs} usadas, ${remainingReqs} restantes.`);
      }

      if (!Array.isArray(events)) {
        console.warn('[TheOddsApiService] Resposta inesperada da API:', JSON.stringify(events));
        return [];
      }

      events = interceptAndSanitizeOddsPayload(events);
      console.log(`[TheOddsApiService] ${events.length} eventos recebidos para "${sportKey}".`);

      const processedMatches = [];

      for (const event of events) {
        if (!isValidGame(event)) {
          console.log(`[TheOddsApiService] [FILTRO] Ignorando: ${event.home_team} vs ${event.away_team}`);
          continue;
        }

        const homeTeam = event.home_team;
        const awayTeam = event.away_team;
        const eventDate = event.commence_time;
        if (!homeTeam || !awayTeam) continue;

        const bookmakers = event.bookmakers || [];

        // 1. Selecionar sportsbookA (preferência: Betano e similares)
        const bmA = this.selectBookmaker(bookmakers, BOOKS_PRIORITY_A, [], homeTeam, awayTeam);

        // 2. Selecionar sportsbookB (preferência: Bet365 e similares, excluindo o já escolhido A)
        const excludeForB = bmA ? [bmA.key] : [];
        const bmB = this.selectBookmaker(bookmakers, BOOKS_PRIORITY_B, excludeForB, homeTeam, awayTeam);

        // Exige ao menos 2 bookmakers reais com odds completas para o evento ser útil
        if (!bmA || !bmB) {
          const booksFound = bookmakers.map(b => b.key).join(', ') || 'nenhum';
          console.log(`[TheOddsApiService] [SKIP] ${homeTeam} vs ${awayTeam}: não foi possível selecionar 2 bookmakers distintos com odds completas. Disponíveis: ${booksFound}`);
          continue;
        }

        // 3. Selecionar sharp odds de referência (Pinnacle, Marathonbet, Betfair etc.)
        let sharpOdds = null;
        for (const sharpKey of SHARP_BOOKS) {
          const sharpBm = bookmakers.find(b => b.key === sharpKey);
          if (!sharpBm) continue;
          const odds = this.extractH2HOdds(sharpBm, homeTeam, awayTeam);
          if (odds) {
            sharpOdds = { key: sharpBm.key, name: sharpBm.title, ...odds };
            break;
          }
        }

        processedMatches.push({
          homeTeam,
          awayTeam,
          eventDate,
          sportsbookA: {
            bookmakerKey: bmA.key,
            bookmakerName: bmA.name,
            homeOdds: bmA.homeOdds,
            drawOdds: bmA.drawOdds,
            awayOdds: bmA.awayOdds
          },
          sportsbookB: {
            bookmakerKey: bmB.key,
            bookmakerName: bmB.name,
            homeOdds: bmB.homeOdds,
            drawOdds: bmB.drawOdds,
            awayOdds: bmB.awayOdds
          },
          sharpOdds: sharpOdds ? {
            bookmakerKey: sharpOdds.key,
            bookmakerName: sharpOdds.name,
            homeOdds: sharpOdds.homeOdds,
            drawOdds: sharpOdds.drawOdds,
            awayOdds: sharpOdds.awayOdds
          } : null
        });
      }

      console.log(`[TheOddsApiService] Processamento concluído: ${processedMatches.length} partidas com odds reais de 2+ bookmakers.`);

      const ttlSec = Number(process.env.ODDS_CACHE_TTL_SEC) || 300;
      MemoryCache.set(cacheKey, processedMatches, ttlSec * 1000);

      return processedMatches;
    } catch (error) {
      console.error('[TheOddsApiService] Erro ao consumir The Odds API:', error.message);
      return [];
    }
  }
}

export default new OddsBlazeService();
