import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDatabase, MatchOdds, saveOrUpdateOdds } from './database/dbService.js';
import MemoryCache from './utils/memoryCache.js';
import OddsBlazeService from './utils/oddsBlazeService.js';
import { normalizeTeamName } from './utils/matchEngine.js';
import LeverageService from './utils/leverageService.js';
import AnalyticsService from './utils/analyticsService.js'; // Novo serviço analítico

// Função auxiliar de delay para o loop do orquestrador
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const app = express();
const PORT = process.env.PORT || 3000;
const API_FRESHNESS_MS = Number(process.env.API_FRESHNESS_MS) || 24 * 60 * 60 * 1000; // Ajustado frescor para 24h visto que a API atualiza 3x/dia

// Configuração segura do CORS e Parsing JSON
app.use(cors({
  origin: '*', // Permite conexões de qualquer origem para facilidade local, configurável em produção
  methods: ['GET']
}));
app.use(express.json());

/**
 * Rota GET /api/leverage/pipeline
 * Retorna o pipeline de apostas em Soros (Alavancagem) calculado dinamicamente.
 */
app.get('/api/leverage/pipeline', async (req, res) => {
  try {
    const { initialStake, steps, league } = req.query;
    console.log(`[API] GET /api/leverage/pipeline - initialStake: ${initialStake}, steps: ${steps}, league: ${league}`);

    const parsedStake = Number(initialStake) || 10;
    const parsedSteps = Number(steps) || 3;
    const parsedLeague = league || 'brazil-serie-a';

    const cacheKey = `pipeline_${parsedStake}_${parsedSteps}_${parsedLeague}`;
    const cachedResponse = MemoryCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[API] [CACHE HIT] Retornando pipeline de Soros cacheado para: ${cacheKey}`);
      return res.json(cachedResponse);
    }

    const pipeline = await LeverageService.generateSorosPipeline(parsedStake, parsedSteps, parsedLeague);

    const responsePayload = {
      success: true,
      timestamp: new Date(),
      initialStake: parsedStake,
      steps: parsedSteps,
      league: parsedLeague,
      totalCount: pipeline.length,
      data: pipeline
    };

    // Cache por 60 segundos
    MemoryCache.set(cacheKey, responsePayload, 60 * 1000);

    res.json(responsePayload);
  } catch (error) {
    console.error('[API] Erro ao buscar pipeline de alavancagem:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao processar e calcular a alavancagem de Soros.'
    });
  }
});

/**
 * Rota GET /api/leverage/boa-do-dia
 * Retorna palpites de altíssimo valor matemático selecionados de todas as principais ligas.
 */
app.get('/api/leverage/boa-do-dia', async (req, res) => {
  try {
    const { stake } = req.query;
    console.log(`[API] GET /api/leverage/boa-do-dia - stake de referência: ${stake}`);

    const parsedStake = Number(stake) || 10;
    
    const cacheKey = `boadodia_${parsedStake}`;
    const cachedResponse = MemoryCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[API] [CACHE HIT] Retornando A Boa do Dia cacheada para: ${cacheKey}`);
      return res.json(cachedResponse);
    }

    const result = await AnalyticsService.calculateBoaDoDia(parsedStake);

    // Cache por 60 segundos
    if (result && result.success) {
      MemoryCache.set(cacheKey, result, 60 * 1000);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Erro ao calcular a Boa do Dia:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao processar os palpites da Boa do Dia.'
    });
  }
});

/**
 * Injeta partidas simuladas de alta qualidade no MongoDB em caso de offline/falha de API.
 */
async function injectMockMatches(league) {
  const baseDate = new Date();
  let mockList = [];

  if (league === 'brazil-serie-a') {
    mockList = [
      {
        homeTeam: 'Flamengo',
        awayTeam: 'Palmeiras',
        dateOffsetDays: 1,
        hour: 16,
        oddsA: { homeOdds: 1.85, drawOdds: 3.40, awayOdds: 3.80 },
        oddsB: { homeOdds: 1.90, drawOdds: 3.30, awayOdds: 3.90 }
      },
      {
        homeTeam: 'São Paulo',
        awayTeam: 'Corinthians',
        dateOffsetDays: 1,
        hour: 19,
        oddsA: { homeOdds: 2.10, drawOdds: 3.10, awayOdds: 3.20 },
        oddsB: { homeOdds: 2.05, drawOdds: 3.15, awayOdds: 3.30 }
      },
      {
        homeTeam: 'Atlético-MG',
        awayTeam: 'Cruzeiro',
        dateOffsetDays: 2,
        hour: 16,
        oddsA: { homeOdds: 1.75, drawOdds: 3.50, awayOdds: 4.20 },
        oddsB: { homeOdds: 1.80, drawOdds: 3.40, awayOdds: 4.10 }
      },
      {
        homeTeam: 'Grêmio',
        awayTeam: 'Internacional',
        dateOffsetDays: 2,
        hour: 19,
        oddsA: { homeOdds: 2.25, drawOdds: 3.20, awayOdds: 3.00 },
        oddsB: { homeOdds: 2.30, drawOdds: 3.10, awayOdds: 2.90 }
      },
      {
        homeTeam: 'Fluminense',
        awayTeam: 'Vasco',
        dateOffsetDays: 3,
        hour: 18,
        oddsA: { homeOdds: 1.95, drawOdds: 3.30, awayOdds: 3.60 },
        oddsB: { homeOdds: 1.90, drawOdds: 3.25, awayOdds: 3.70 }
      }
    ];
  } else if (league === 'premier-league') {
    mockList = [
      {
        homeTeam: 'Manchester City',
        awayTeam: 'Arsenal',
        dateOffsetDays: 1,
        hour: 16,
        oddsA: { homeOdds: 2.10, drawOdds: 3.40, awayOdds: 3.20 },
        oddsB: { homeOdds: 2.15, drawOdds: 3.30, awayOdds: 3.15 }
      },
      {
        homeTeam: 'Liverpool',
        awayTeam: 'Chelsea',
        dateOffsetDays: 1,
        hour: 19,
        oddsA: { homeOdds: 1.95, drawOdds: 3.45, awayOdds: 3.80 },
        oddsB: { homeOdds: 2.00, drawOdds: 3.35, awayOdds: 3.75 }
      },
      {
        homeTeam: 'Manchester United',
        awayTeam: 'Tottenham',
        dateOffsetDays: 2,
        hour: 16,
        oddsA: { homeOdds: 2.30, drawOdds: 3.30, awayOdds: 2.95 },
        oddsB: { homeOdds: 2.35, drawOdds: 3.20, awayOdds: 3.00 }
      }
    ];
  } else if (league === 'la-liga') {
    mockList = [
      {
        homeTeam: 'Real Madrid',
        awayTeam: 'Atletico Madrid',
        dateOffsetDays: 1,
        hour: 17,
        oddsA: { homeOdds: 1.90, drawOdds: 3.30, awayOdds: 4.10 },
        oddsB: { homeOdds: 1.95, drawOdds: 3.25, awayOdds: 4.00 }
      },
      {
        homeTeam: 'Barcelona',
        awayTeam: 'Sevilla',
        dateOffsetDays: 2,
        hour: 16,
        oddsA: { homeOdds: 1.72, drawOdds: 3.70, awayOdds: 4.80 },
        oddsB: { homeOdds: 1.75, drawOdds: 3.60, awayOdds: 4.70 }
      },
      {
        homeTeam: 'Athletic Club',
        awayTeam: 'Villarreal',
        dateOffsetDays: 2,
        hour: 19,
        oddsA: { homeOdds: 2.05, drawOdds: 3.20, awayOdds: 3.60 },
        oddsB: { homeOdds: 2.10, drawOdds: 3.15, awayOdds: 3.50 }
      }
    ];
  } else if (league === 'fifa-world-cup') {
    mockList = [
      {
        homeTeam: 'Turkey',
        awayTeam: 'USA',
        dateOffsetDays: 1,
        hour: 16,
        oddsA: { homeOdds: 2.30, drawOdds: 3.20, awayOdds: 2.80 },
        oddsB: { homeOdds: 2.35, drawOdds: 3.10, awayOdds: 2.85 }
      },
      {
        homeTeam: 'Saudi Arabia',
        awayTeam: 'Uruguay',
        dateOffsetDays: 1,
        hour: 19,
        oddsA: { homeOdds: 4.80, drawOdds: 3.60, awayOdds: 1.65 },
        oddsB: { homeOdds: 4.90, drawOdds: 3.70, awayOdds: 1.62 }
      },
      {
        homeTeam: 'Colombia',
        awayTeam: 'DR Congo',
        dateOffsetDays: 2,
        hour: 23,
        oddsA: { homeOdds: 1.50, drawOdds: 3.90, awayOdds: 6.00 },
        oddsB: { homeOdds: 1.48, drawOdds: 4.00, awayOdds: 6.20 }
      },
      {
        homeTeam: 'Brazil',
        awayTeam: 'Germany',
        dateOffsetDays: 3,
        hour: 16,
        oddsA: { homeOdds: 2.05, drawOdds: 3.30, awayOdds: 3.30 },
        oddsB: { homeOdds: 2.10, drawOdds: 3.25, awayOdds: 3.20 }
      },
      {
        homeTeam: 'Argentina',
        awayTeam: 'France',
        dateOffsetDays: 3,
        hour: 19,
        oddsA: { homeOdds: 2.60, drawOdds: 3.00, awayOdds: 2.60 },
        oddsB: { homeOdds: 2.55, drawOdds: 3.10, awayOdds: 2.65 }
      }
    ];
  } else if (league === 'soccer_uefa_champions_league' || league === 'uefa-champions-league') {
    mockList = [
      {
        homeTeam: 'Real Madrid',
        awayTeam: 'Manchester City',
        dateOffsetDays: 1,
        hour: 20,
        oddsA: { homeOdds: 2.40, drawOdds: 3.50, awayOdds: 2.60 },
        oddsB: { homeOdds: 2.45, drawOdds: 3.40, awayOdds: 2.65 }
      },
      {
        homeTeam: 'Bayern Munich',
        awayTeam: 'Arsenal',
        dateOffsetDays: 2,
        hour: 20,
        oddsA: { homeOdds: 2.15, drawOdds: 3.30, awayOdds: 3.10 },
        oddsB: { homeOdds: 2.20, drawOdds: 3.25, awayOdds: 3.05 }
      },
      {
        homeTeam: 'PSG',
        awayTeam: 'Barcelona',
        dateOffsetDays: 3,
        hour: 20,
        oddsA: { homeOdds: 1.95, drawOdds: 3.60, awayOdds: 3.30 },
        oddsB: { homeOdds: 2.00, drawOdds: 3.50, awayOdds: 3.40 }
      }
    ];
  }

  for (const item of mockList) {
    const eventDate = new Date();
    eventDate.setDate(baseDate.getDate() + item.dateOffsetDays);
    eventDate.setHours(item.hour, 0, 0, 0);

    const normHome = normalizeTeamName(item.homeTeam);
    const normAway = normalizeTeamName(item.awayTeam);

    await saveOrUpdateOdds({
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
      normalizedHome: normHome,
      normalizedAway: normAway,
      source: 'sportsbookA',
      homeOdds: item.oddsA.homeOdds,
      drawOdds: item.oddsA.drawOdds,
      awayOdds: item.oddsA.awayOdds,
      eventDate: eventDate,
      league: league
    });

    await saveOrUpdateOdds({
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
      normalizedHome: normHome,
      normalizedAway: normAway,
      source: 'sportsbookB',
      homeOdds: item.oddsB.homeOdds,
      drawOdds: item.oddsB.drawOdds,
      awayOdds: item.oddsB.awayOdds,
      eventDate: eventDate,
      league: league
    });
  }
  console.log(`[Database Fallback] Dados simulados ricos gravados para a liga: ${league}`);
}

/**
 * Função cíclica que busca odds reais de múltiplas ligas usando The Odds API (v4) e salva no MongoDB.
 */
async function runSingleApiCycle() {
  try {
    console.log('[API Background] Iniciando sincronização programada com a The Odds API (v4)...');

    const leaguesToIngest = [
      { key: process.env.THE_ODDS_SPORT_BRAZIL_SERIE_A || process.env.THE_ODDS_SPORT_BRAZIL || 'soccer_brazil_campeonato', label: 'Campeonato Brasileiro (Série A)', dbLeague: 'brazil-serie-a' },
      { key: process.env.THE_ODDS_SPORT_PREMIER_LEAGUE || 'soccer_epl', label: 'Premier League', dbLeague: 'premier-league' },
      { key: process.env.THE_ODDS_SPORT_LA_LIGA || 'soccer_spain_la_liga', label: 'La Liga', dbLeague: 'la-liga' },
      { key: process.env.THE_ODDS_SPORT_LIBERTADORES || 'soccer_conmebol_copa_libertadores', label: 'Copa Libertadores', dbLeague: 'copa-libertadores' },
      { key: process.env.THE_ODDS_SPORT_SULAMERICANA || 'soccer_conmebol_copa_sudamericana', label: 'Copa Sudamericana', dbLeague: 'copa-sudamericana' },
      { key: process.env.THE_ODDS_SPORT_WORLD_CUP || 'soccer_fifa_world_cup', label: 'Copa do Mundo FIFA', dbLeague: 'fifa-world-cup' },
    ];

    for (const league of leaguesToIngest) {
      console.log(`[API Background] Carregando odds reais de: ${league.label} (${league.key})...`);
      const matches = await OddsBlazeService.fetchOdds(league.key);

      if (matches.length > 0) {
        for (const match of matches) {
          const normHome = normalizeTeamName(match.homeTeam);
          const normAway = normalizeTeamName(match.awayTeam);

          // Salva a perna A no MongoDB
          await saveOrUpdateOdds({
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            normalizedHome: normHome,
            normalizedAway: normAway,
            source: 'sportsbookA',
            homeOdds: match.sportsbookA.homeOdds,
            drawOdds: match.sportsbookA.drawOdds,
            awayOdds: match.sportsbookA.awayOdds,
            bookmakerKey: match.sportsbookA.bookmakerKey,
            bookmakerName: match.sportsbookA.bookmakerName,
            sharpOdds: match.sharpOdds || null,
            eventDate: match.eventDate,
            league: league.dbLeague
          });

          // Salva a perna B no MongoDB
          await saveOrUpdateOdds({
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            normalizedHome: normHome,
            normalizedAway: normAway,
            source: 'sportsbookB',
            homeOdds: match.sportsbookB.homeOdds,
            drawOdds: match.sportsbookB.drawOdds,
            awayOdds: match.sportsbookB.awayOdds,
            bookmakerKey: match.sportsbookB.bookmakerKey,
            bookmakerName: match.sportsbookB.bookmakerName,
            eventDate: match.eventDate,
            league: league.dbLeague
          });
        }
        console.log(`[API Background] Sincronização em tempo real de ${league.label} concluída no MongoDB.`);
      } else {
        if (process.env.ALLOW_MOCK_FALLBACK === 'true') {
          console.warn(`[API Background] Nenhum dado obtido para: ${league.label}. ALLOW_MOCK_FALLBACK=true — injetando dados simulados...`);
          await injectMockMatches(league.dbLeague);
        } else {
          console.warn(`[API Background] Nenhum dado obtido para: ${league.label}. ALLOW_MOCK_FALLBACK=false — nenhum dado simulado será gravado.`);
        }
      }
    }
  } catch (error) {
    console.error('[API Background] Erro crítico na sincronização cíclica:', error.message);
  }
}

/**
 * Inicialização principal do Servidor Web e do Scanner programado (sem Playwright).
 */
async function startSystem() {
  console.log('\n\x1b[1m\x1b[32m==================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m    INICIANDO SERVIDOR WEB (EXPRESS) + SCANNER PROGRAMADO API     \x1b[0m');
  console.log('\x1b[1m\x1b[32m==================================================================\x1b[0m\n');

  // Conecta ao MongoDB de forma persistente
  await connectDatabase();

  // Inicia a escuta da API Express em todas as interfaces locais de rede (0.0.0.0)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\x1b[1m\x1b[32m[API] Servidor Express escutando na porta ${PORT} (http://192.168.0.64:${PORT})\x1b[0m`);
  });

  // O orquestrador roda 3 vezes ao dia (a cada 8 horas)
  const intervalMs = 8 * 60 * 60 * 1000;

  // Dispara a rotina em background de forma assíncrona
  (async () => {
    // Primeira execução imediata para popular o banco de dados na inicialização do app
    console.log('\n\x1b[1m\x1b[34m[API Background] === INICIANDO POPULAÇÃO INICIAL DE ODDS ===\x1b[0m');
    await runSingleApiCycle();

    while (true) {
      console.log(`[API Background] Aguardando 8 horas (próxima coleta às ${new Date(Date.now() + intervalMs).toLocaleTimeString('pt-BR')})...`);
      await wait(intervalMs);
      console.log(`\n\x1b[1m\x1b[34m[API Background] === NOVO CICLO PROGRAMADO INICIADO: ${new Date().toLocaleTimeString()} ===\x1b[0m`);
      await runSingleApiCycle();
    }
  })().catch(err => {
    console.error('[API Background] Erro crítico no loop de sincronização:', err.message);
  });
}

// Inicializa o sistema completo
startSystem();

