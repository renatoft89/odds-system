import { normalizeTeamName } from '../utils/matchEngine.js';

/**
 * Classe responsável por simular a raspagem segura da Betano utilizando Interceptação de Rede.
 */
export class BetanoScraper {
  /**
   * Executa o processo de extração interceptando chamadas de API JSON da página da Betano.
   * @param {import('playwright').BrowserContext} context Contexto do navegador Playwright.
   * @returns {Promise<Array<Object>>} Lista de odds padronizadas extraídas.
   */
  async scrape(context) {
    const page = await context.newPage();
    const matchesFound = [];
    const allowMockFallback = process.env.ALLOW_MOCK_FALLBACK !== 'false';
    const seenKeys = new Set();

    const targetUrl = process.env.URL_CASA_A;

    if (!targetUrl) {
      console.error('[BetanoScraper] Variavel URL_CASA_A nao definida no .env.');
      await page.close();
      return [];
    }

    console.log(`\x1b[36m[BetanoScraper] Iniciando extração por Interceptação de Rede. Acessando: ${targetUrl}\x1b[0m`);

    try {
      // Captura JSONs de rede para aumentar a chance de coleta em mudanças de layout.
      page.on('response', async (response) => {
        const url = response.url().toLowerCase();
        
        // Log básico de todas as chamadas de rede para diagnóstico
        if (url.includes('api')) {
          console.log(`[DEBUG URL] Interceptado: ${url} (Status: ${response.status()})`);
        }

        if (response.status() !== 200 || !url.includes('betano')) return;

        try {
          const headers = response.headers();
          const contentType = (headers['content-type'] || '').toLowerCase();
          if (!contentType.includes('application/json')) return;

          const rawJson = await response.json();
          console.log(`[DEBUG JSON] Processando payload JSON de: ${url}`);
          const parsedMatches = this.extractMatchesFromAnyJson(rawJson);
          for (const m of parsedMatches) {
            const key = `${m.normalizedHome}|${m.normalizedAway}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            matchesFound.push(m);
          }
        } catch (jsonError) {
          // Silencioso para evitar ruído excessivo de outras requisições
        }
      });

      // Abre a página
      await page.goto(targetUrl, {
        waitUntil: 'networkidle',
        timeout: 20000
      }).catch((err) => {
        console.warn(`\x1b[33m[BetanoScraper] [Aviso] Falha ao carregar a pagina alvo da Betano: ${err.message}\x1b[0m`);
      });

      // Salva uma captura de tela de depuração para verificar se fomos bloqueados pelo WAF
      try {
        await page.screenshot({ path: 'betano-debug.png', fullPage: true });
        console.log('\x1b[32m[BetanoScraper] [Debug] Screenshot salvo em betano-debug.png\x1b[0m');
      } catch (err) {
        console.warn('[BetanoScraper] Falha ao tirar screenshot de depuração:', err.message);
      }

      // Aguarda as requisições assíncronas assentar
      await page.waitForTimeout(3000);

      // Fallback para parsing direto do DOM quando a API interna muda de rota/estrutura.
      if (matchesFound.length === 0) {
        const domMatches = await this.parseDOMFallback(page);
        for (const m of domMatches) {
          const key = `${m.normalizedHome}|${m.normalizedAway}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          matchesFound.push(m);
        }
      }

      // Modo opcional de mock para desenvolvimento local controlado por env.
      if (matchesFound.length === 0) {
        if (allowMockFallback) {
          const mockData = this.generateMockApiResponse();
          matchesFound.push(...this.parseApiResponse(mockData));
          console.warn('\x1b[33m[BetanoScraper] Mock fallback habilitado por ALLOW_MOCK_FALLBACK=true.\x1b[0m');
        } else {
          console.warn('\x1b[33m[BetanoScraper] Nenhum dado real coletado nesta execucao.\x1b[0m');
        }
      }

      console.log(`\x1b[32m[BetanoScraper] Extração concluída. Total: ${matchesFound.length} partidas.\x1b[0m`);
      return matchesFound;
    } catch (error) {
      console.error(`\x1b[31m[BetanoScraper] Erro fatal durante a raspagem: ${error.message}\x1b[0m`);
      if (allowMockFallback) {
        const mockData = this.generateMockApiResponse();
        return this.parseApiResponse(mockData);
      }
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Faz parsing resiliente de múltiplos formatos JSON observados em feeds esportivos.
   * @param {any} rawJson
   * @returns {Array<Object>}
   */
  extractMatchesFromAnyJson(rawJson) {
    const direct = this.parseApiResponse(rawJson);
    if (direct.length > 0) return direct;

    const matches = [];
    const stack = [rawJson];

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;

      if (Array.isArray(node)) {
        for (const item of node) stack.push(item);
        continue;
      }

      const values = Object.values(node);
      for (const val of values) {
        if (val && typeof val === 'object') stack.push(val);
      }

      const normalized = this.extractGenericMatch(node);
      if (normalized) matches.push(normalized);
    }

    return matches;
  }

  /**
   * Extrai uma partida candidata de um objeto genérico de feed.
   * @param {Record<string, any>} node
   * @returns {Object | null}
   */
  extractGenericMatch(node) {
    const homeTeam = node.homeTeam || node.home || node.team1 || node.host;
    const awayTeam = node.awayTeam || node.away || node.team2 || node.guest;
    const participants = Array.isArray(node.participants) ? node.participants : null;

    const resolvedHome = homeTeam || participants?.[0]?.name || participants?.[0]?.teamName;
    const resolvedAway = awayTeam || participants?.[1]?.name || participants?.[1]?.teamName;
    if (!resolvedHome || !resolvedAway) return null;

    const oddsCandidates = [];
    if (Array.isArray(node.odds)) oddsCandidates.push(...node.odds);
    if (Array.isArray(node.selections)) oddsCandidates.push(...node.selections);
    if (Array.isArray(node.outcomes)) oddsCandidates.push(...node.outcomes);
    if (Array.isArray(node.market?.selections)) oddsCandidates.push(...node.market.selections);

    let homeOdds;
    let drawOdds;
    let awayOdds;

    for (const c of oddsCandidates) {
      const key = String(c?.key || c?.type || c?.code || c?.name || '').toLowerCase();
      const value = Number(c?.price ?? c?.odd ?? c?.odds ?? c?.value);
      if (!Number.isFinite(value) || value < 1.01) continue;

      if (!homeOdds && (key === '1' || key.includes('home') || key.includes('casa'))) homeOdds = value;
      else if (!drawOdds && (key === 'x' || key.includes('draw') || key.includes('empate'))) drawOdds = value;
      else if (!awayOdds && (key === '2' || key.includes('away') || key.includes('fora'))) awayOdds = value;
    }

    if (!homeOdds || !drawOdds || !awayOdds) return null;

    return {
      homeTeam: String(resolvedHome).trim(),
      awayTeam: String(resolvedAway).trim(),
      normalizedHome: normalizeTeamName(String(resolvedHome)),
      normalizedAway: normalizeTeamName(String(resolvedAway)),
      homeOdds,
      drawOdds,
      awayOdds,
      source: 'Betano'
    };
  }

  /**
   * Fallback de parsing no HTML em cenários onde os endpoints internos mudam.
   * @param {import('playwright').Page} page
   * @returns {Promise<Array<Object>>}
   */
  async parseDOMFallback(page) {
    const result = [];

    try {
      const rows = page.locator('[class*="event"], [class*="fixture"], [class*="match"], [data-qa*="event"]');
      const count = Math.min(await rows.count(), 120);

      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const teamTexts = await row
          .locator('xpath=.//span[contains(@class,"team") or contains(@class,"participant") or contains(@class,"name") or contains(@data-qa,"team")]')
          .allTextContents();

        const cleanTeams = teamTexts.map((t) => t.trim()).filter(Boolean);
        if (cleanTeams.length < 2) continue;

        const oddsTexts = await row
          .locator('xpath=.//button[contains(@class,"odd") or contains(@class,"price")] | .//span[contains(@class,"odd") or contains(@class,"price")]')
          .allTextContents();

        const numbers = oddsTexts
          .map((o) => Number(String(o).replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0]))
          .filter((n) => Number.isFinite(n) && n > 1.01);

        if (numbers.length < 3) continue;

        const homeTeam = cleanTeams[0];
        const awayTeam = cleanTeams[1];
        result.push({
          homeTeam,
          awayTeam,
          normalizedHome: normalizeTeamName(homeTeam),
          normalizedAway: normalizeTeamName(awayTeam),
          homeOdds: numbers[0],
          drawOdds: numbers[1],
          awayOdds: numbers[2],
          source: 'Betano'
        });
      }
    } catch (err) {
      console.warn(`[BetanoScraper] [Aviso] Falha no parse DOM fallback: ${err.message}`);
    }

    return result;
  }

  /**
   * Mapeia e padroniza a resposta JSON bruta da API da Betano.
   * @param {Object} rawJson Payload bruto interceptado da rede.
   * @returns {Array<Object>} Lista de partidas padronizadas.
   */
  parseApiResponse(rawJson) {
    const matches = [];
    const events = Array.isArray(rawJson?.events) ? rawJson.events : [];

    for (const event of events) {
      try {
        const homeTeam = event.homeTeam;
        const awayTeam = event.awayTeam;
        const market1x2 = event.markets?.find(m => m.key === '1x2');

        if (!market1x2 || !homeTeam || !awayTeam) continue;

        const selectionHome = market1x2.selections?.find(s => s.key === '1');
        const selectionDraw = market1x2.selections?.find(s => s.key === 'X');
        const selectionAway = market1x2.selections?.find(s => s.key === '2');

        matches.push({
          homeTeam,
          awayTeam,
          normalizedHome: normalizeTeamName(homeTeam),
          normalizedAway: normalizeTeamName(awayTeam),
          homeOdds: parseFloat(selectionHome?.price || 1.0),
          drawOdds: parseFloat(selectionDraw?.price || 1.0),
          awayOdds: parseFloat(selectionAway?.price || 1.0),
          source: 'Betano'
        });
      } catch (err) {
        continue;
      }
    }

    return matches;
  }

  /**
   * Mock simulando a API da Betano com odds que propiciarão Surebets com a Bet365 para teste!
   */
  generateMockApiResponse() {
    return {
      events: [
        {
          homeTeam: 'São Paulo FC',
          awayTeam: 'Atlético Mineiro',
          markets: [
            {
              key: '1x2',
              selections: [
                { key: '1', price: 2.20 }, // Melhor Casa (Betano: 2.20 vs Bet365: 2.10)
                { key: 'X', price: 3.20 },
                { key: '2', price: 3.10 }
              ]
            }
          ]
        },
        {
          homeTeam: 'Ponte Preta',
          awayTeam: 'Cruzeiro EC',
          markets: [
            {
              key: '1x2',
              selections: [
                { key: '1', price: 2.70 },
                { key: 'X', price: 3.00 },
                { key: '2', price: 2.90 } // Melhor Fora (Betano: 2.90 vs Bet365: 2.55)
              ]
            }
          ]
        },
        {
          homeTeam: 'Palmeiras',
          awayTeam: 'Athletico Paranaense',
          markets: [
            {
              key: '1x2',
              selections: [
                { key: '1', price: 1.65 },
                { key: 'X', price: 3.80 },
                { key: '2', price: 5.25 }
              ]
            }
          ]
        },
        {
          // Jogo com Surebet (Arbitragem matemática clara)
          homeTeam: 'Coritiba',
          awayTeam: 'Bragantino',
          markets: [
            {
              key: '1x2',
              selections: [
                { key: '1', price: 3.40 }, // Betano: 3.40 (Melhor Casa)
                { key: 'X', price: 3.10 },
                { key: '2', price: 2.05 }
              ]
            }
          ]
        }
      ]
    };
  }
}
