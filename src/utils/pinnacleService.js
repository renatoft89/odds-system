import 'dotenv/config';
import OddsBlazeService from './oddsBlazeService.js';

/**
 * PinnacleService — Fornece odds "sharp" de referência para cálculo de EV.
 *
 * Estratégia: Extrai odds de bookmakers eficientes (Marathonbet, Betfair, Pinnacle se disponível)
 * diretamente do payload da The Odds API, eliminando a dependência de wrappers não-oficiais
 * da RapidAPI.
 *
 * A API oficial da Pinnacle (api.pinnacle.com) está fechada ao público geral desde julho de 2025
 * e requer conta com saldo depositado. Por isso, usamos bookmakers igualmente eficientes
 * disponíveis via The Odds API como substitutos.
 */
export class PinnacleService {
  constructor() {
    // Ligas com dados reais ativos na The Odds API
    this.activeLeagues = [
      process.env.THE_ODDS_SPORT_BRAZIL_SERIE_A || process.env.THE_ODDS_SPORT_BRAZIL || 'soccer_brazil_campeonato',
      process.env.THE_ODDS_SPORT_PREMIER_LEAGUE || 'soccer_epl',
      process.env.THE_ODDS_SPORT_LA_LIGA || 'soccer_spain_la_liga',
      process.env.THE_ODDS_SPORT_LIBERTADORES || 'soccer_conmebol_copa_libertadores',
      process.env.THE_ODDS_SPORT_SULAMERICANA || 'soccer_conmebol_copa_sudamericana',
    ];
  }

  /**
   * Retorna odds sharp de referência agregando dados de bookmakers eficientes
   * já coletados pelo OddsBlazeService (sem requisição adicional à API).
   *
   * @returns {Promise<Array<Object>>} Lista de partidas com sharpOdds
   */
  async fetchPinnacleOdds() {
    const allSharpMatches = [];

    for (const league of this.activeLeagues) {
      try {
        const matches = await OddsBlazeService.fetchOdds(league);

        for (const match of matches) {
          const sharp = match.sharpOdds;
          if (!sharp) continue;

          allSharpMatches.push({
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            eventDate: new Date(match.eventDate),
            sportTitle: 'Soccer',
            sharpBookmaker: sharp.bookmakerName,
            sharpOdds: {
              homeOdds: sharp.homeOdds,
              drawOdds: sharp.drawOdds,
              awayOdds: sharp.awayOdds
            }
          });
        }
      } catch (err) {
        console.error(`[PinnacleService] Erro ao coletar sharp odds para ${league}:`, err.message);
      }
    }

    if (allSharpMatches.length > 0) {
      console.log(`[PinnacleService] ${allSharpMatches.length} partidas com odds sharp disponíveis.`);
    } else {
      console.warn('[PinnacleService] Nenhuma odds sharp disponível. Bookmakers eficientes (Marathonbet, Betfair, Pinnacle) não estão presentes no payload das ligas ativas.');
    }

    return allSharpMatches;
  }
}

export default new PinnacleService();

