import 'dotenv/config';
import { BrowserManager } from './config/browserManager.js';
import { connectDatabase, disconnectDatabase, saveOrUpdateOdds } from './database/dbService.js';
import { BetanoScraper } from './scrapers/betanoScraper.js';
import { Bet365Scraper } from './scrapers/bet365Scraper.js';
import { crossMatches } from './utils/matcher.js';

// Função auxiliar de delay para o ciclo de execução
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executa uma rodada individual de raspagem e análise de Surebets.
 */
async function runSingleCycle(contextInst) {
  const betanoScraper = new BetanoScraper();
  const bet365Scraper = new Bet365Scraper();

  let rawBetanoOdds = [];
  let rawBet365Odds = [];

  // Executa o scraping da Betano de forma segura e isolada
  try {
    console.log('\x1b[36m[Orquestrador] Disparando raspagem no canal Betano...\x1b[0m');
    rawBetanoOdds = await betanoScraper.scrape(contextInst);
  } catch (error) {
    console.error('\x1b[31m[Orquestrador] [Erro Betano] Falha ao raspar a Betano neste ciclo:\x1b[0m', error.message);
  }

  // Executa o scraping da Bet365 de forma segura e isolada
  try {
    console.log('\x1b[35m[Orquestrador] Disparando raspagem no canal Bet365...\x1b[0m');
    rawBet365Odds = await bet365Scraper.scrape(contextInst);
  } catch (error) {
    console.error('\x1b[31m[Orquestrador] [Erro Bet365] Falha ao raspar a Bet365 neste ciclo:\x1b[0m', error.message);
  }

  // Só realiza cruzamentos se ambos os scrapers retornarem dados válidos
  if (rawBetanoOdds.length > 0 && rawBet365Odds.length > 0) {
    try {
      console.log(`\n\x1b[1m\x1b[32m[Orquestrador] Coleta Concluída com Sucesso:\x1b[0m`);
      console.log(`   - Partidas Betano extraídas: \x1b[36m${rawBetanoOdds.length}\x1b[0m`);
      console.log(`   - Partidas Bet365 extraídas: \x1b[35m${rawBet365Odds.length}\x1b[0m\n`);

      // 5. Executa cruzamento de dados (Fuzzy Matcher via string-similarity)
      const crossedMatches = crossMatches(rawBetanoOdds, rawBet365Odds);

      // 6. Surebet calculations removed.

      // 8. Grava os dados processados e unificados no MongoDB
      console.log('\x1b[36m[Orquestrador] Gravando dados processados no MongoDB...\x1b[0m');
      for (const match of crossedMatches) {
        // Grava a perna Betano
        await saveOrUpdateOdds({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          normalizedHome: match.normalizedHome,
          normalizedAway: match.normalizedAway,
          source: 'sportsbookA', // Corresponde à Betano
          homeOdds: match.odds_betano[1],
          drawOdds: match.odds_betano['X'],
          awayOdds: match.odds_betano[2]
        });

        // Grava a perna Bet365
        await saveOrUpdateOdds({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          normalizedHome: match.normalizedHome,
          normalizedAway: match.normalizedAway,
          source: 'sportsbookB', // Corresponde à Bet365
          homeOdds: match.odds_bet365[1],
          drawOdds: match.odds_bet365['X'],
          awayOdds: match.odds_bet365[2]
        });
      }

      console.log('\x1b[1m\x1b[32m[Orquestrador] Ciclo finalizado com sucesso! Todos os dados foram unificados e salvos.\x1b[0m\n');
    } catch (processError) {
      console.error('\x1b[31m[Orquestrador] Erro ao processar ou persistir dados consolidados:\x1b[0m', processError.message);
    }
  } else {
    console.warn('\x1b[33m[Orquestrador] Ciclo pulado ou incompleto devido à falha de dados em um dos canais.\x1b[0m\n');
  }
}

/**
 * Entrypoint principal da aplicação de raspagem de odds e análise de Surebets.
 */
async function main() {
  console.log('\n\x1b[1m\x1b[32m==================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m    INICIANDO MOTOR DE ARBITRAGEM ESPORTIVA DE FUTEBOL (PRE-JOGO)   \x1b[0m');
  console.log('\x1b[1m\x1b[32m==================================================================\x1b[0m\n');

  // 1. Inicializa conexão única com o MongoDB com resiliência contra falhas
  await connectDatabase();

  let browserInst = null;
  let contextInst = null;
  let running = true;

  try {
    // 2. Cria instância única do Navegador Mascarado (Evasão Stealth)
    const { browser, context } = await BrowserManager.launch({
      headless: process.env.HEADLESS !== 'false'
    });
    browserInst = browser;
    contextInst = context;

    // Frequência de atualização em milissegundos (padrão: 30 segundos para testes ágeis)
    const intervalMs = Number(process.env.SCRAPE_INTERVAL_MS) || 30000;

    // Laço de repetição cíclica infinita
    while (running) {
      console.log(`\n\x1b[1m\x1b[34m[Orquestrador] === INICIANDO NOVO CICLO DE COLETA: ${new Date().toLocaleTimeString()} ===\x1b[0m`);
      
      await runSingleCycle(contextInst);

      console.log(`\x1b[36m[Orquestrador] Aguardando ${intervalMs / 1000}s para disparar o próximo ciclo...\x1b[0m`);
      await wait(intervalMs);
    }

  } catch (error) {
    console.error('\x1b[31m[Orquestrador] Erro crítico incontrolável na pipeline principal:\x1b[0m', error.message);
  } finally {
    // 9. Garante o encerramento gracioso dos navegadores do Playwright contra processos zumbis
    if (browserInst) {
      console.log('\x1b[36m[Orquestrador] Fechando navegador e liberando recursos de memória...\x1b[0m');
      await browserInst.close();
    }
    // Desconecta do MongoDB
    await disconnectDatabase();
  }
}

// Inicializa a aplicação
main();
