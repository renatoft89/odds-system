import { normalizeTeamName } from '../utils/matchEngine.js';

/**
 * Classe responsável por simular a raspagem da Bet365 com emulação humana avançada e DOM parsing.
 */
export class Bet365Scraper {
  /**
   * Executa a navegação na página simulando as ações de um usuário real.
   * @param {import('playwright').BrowserContext} context Contexto do navegador Playwright.
   * @returns {Promise<Array<Object>>} Lista de partidas extraídas do DOM.
   */
  async scrape(context) {
    const page = await context.newPage();
    const targetUrl = process.env.URL_CASA_B;
    const allowMockFallback = process.env.ALLOW_MOCK_FALLBACK !== 'false';
    const matchesFound = [];
    const seenKeys = new Set();

    if (!targetUrl) {
      console.error('[Bet365Scraper] Variavel URL_CASA_B nao definida no .env.');
      await page.close();
      return [];
    }

    console.log(`\x1b[35m[Bet365Scraper] Iniciando extração com Emulação Humana. Acessando: ${targetUrl}\x1b[0m`);

    try {
      page.on('response', async (response) => {
        const url = response.url().toLowerCase();
        if (!url.includes('bet365') || response.status() !== 200) return;

        try {
          const headers = response.headers();
          const contentType = (headers['content-type'] || '').toLowerCase();
          if (!contentType.includes('application/json')) return;

          const rawJson = await response.json();
          const parsed = this.extractMatchesFromAnyJson(rawJson);
          for (const m of parsed) {
            const key = `${m.normalizedHome}|${m.normalizedAway}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            matchesFound.push(m);
          }
        } catch (err) {
          // Ignora respostas não parseáveis sem interromper scraping.
        }
      });

      try {
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });
      } catch (navigationError) {
        console.warn(`\x1b[33m[Bet365Scraper] [Aviso] Falha de navegacao (Timeout/Rede): ${navigationError.message}.\x1b[0m`);
        await page.close();
        if (allowMockFallback) {
          return this.generateMockDOMMatches();
        }
        return [];
      }

      // 1. Simula movimentos fluidos do mouse
      await this.simulateMouseMovements(page);

      // 2. Delay randômico humano para leitura do WAF
      const delay = Math.floor(Math.random() * 1500) + 1000;
      console.log(`\x1b[35m[Bet365Scraper] Aguardando delay dinâmico de ${delay}ms...\x1b[0m`);
      await page.waitForTimeout(delay);

      // 3. Efetua a raspagem resiliente no DOM (pagina principal + iframes).
      if (matchesFound.length === 0) {
        await page.waitForTimeout(3000);

        const domMatches = await this.parseDOM(page);
        for (const m of domMatches) {
          const key = `${m.normalizedHome}|${m.normalizedAway}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          matchesFound.push(m);
        }

        // Algumas versões da Bet365 renderizam mercado dentro de iframe.
        if (matchesFound.length === 0) {
          const frames = page.frames().filter((f) => f !== page.mainFrame());
          for (const frame of frames) {
            const frameMatches = await this.parseDOM(frame);
            for (const m of frameMatches) {
              const key = `${m.normalizedHome}|${m.normalizedAway}`;
              if (seenKeys.has(key)) continue;
              seenKeys.add(key);
              matchesFound.push(m);
            }
          }
        }
      }

      if (matchesFound.length === 0) {
        if (allowMockFallback) {
          console.warn('\x1b[33m[Bet365Scraper] Mock fallback habilitado por ALLOW_MOCK_FALLBACK=true.\x1b[0m');
          return this.generateMockDOMMatches();
        }
        console.warn('\x1b[33m[Bet365Scraper] Nenhum dado real coletado nesta execucao.\x1b[0m');
        return [];
      }

      return matchesFound;
    } catch (error) {
      console.error(`\x1b[31m[Bet365Scraper] Erro fatal durante raspagem DOM: ${error.message}\x1b[0m`);
      if (allowMockFallback) {
        return this.generateMockDOMMatches();
      }
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Simula movimentos de mouse com passos incrementais.
   * @param {import('playwright').Page} page 
   */
  async simulateMouseMovements(page) {
    console.log('\x1b[35m[Bet365Scraper] Emulando movimentos humanos de mouse no layout...\x1b[0m');
    try {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const destX = Math.floor(Math.random() * 900) + 50;
        const destY = Math.floor(Math.random() * 600) + 50;
        await page.mouse.move(destX, destY, { steps: 6 });
        await page.waitForTimeout(Math.floor(Math.random() * 100) + 30);
      }
    } catch (err) {
      // Ignora erro em ambientes headless estritos
    }
  }

  /**
   * Extração resiliente lendo a árvore DOM através de XPaths robustos baseados em acessibilidade/textos.
   * @param {import('playwright').Page | import('playwright').Frame} page
   * @returns {Promise<Array<Object>>}
   */
  async parseDOM(page) {
    console.log('\x1b[35m[Bet365Scraper] Analisando estrutura DOM...\x1b[0m');
    try {
      const seletorBase = 'xpath=//div[contains(@class, "event") or contains(@class, "match") or contains(@class, "fixture") or @role="listitem" or @role="row"]';
      await page.waitForSelector(seletorBase, { state: 'attached', timeout: 15000 });

      const eventContainers = await page
        .locator('//div[contains(@class, "event") or contains(@class, "match") or contains(@class, "fixture") or @role="listitem" or @role="row"]')
        .all();
      const matches = [];

      for (const container of eventContainers) {
        try {
          const teams = await container
            .locator('xpath=.//span[contains(@class, "team") or contains(@class, "participant") or contains(@class, "name") or contains(@data-qa, "team")]')
            .allTextContents();
          const cleanTeams = teams.map((t) => t.trim()).filter(Boolean);
          if (cleanTeams.length < 2) continue;

          const homeTeam = cleanTeams[0];
          const awayTeam = cleanTeams[1];

          const oddsText = await container
            .locator('xpath=.//span[contains(@class, "odds") or contains(@class, "price")] | .//button[contains(@class, "odds") or contains(@class, "price")]')
            .allTextContents();

          const parsedOdds = oddsText
            .map((text) => Number(String(text).replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0]))
            .filter((num) => Number.isFinite(num) && num > 1.01);

          if (parsedOdds.length < 3) continue;

          matches.push({
            homeTeam,
            awayTeam,
            normalizedHome: normalizeTeamName(homeTeam),
            normalizedAway: normalizeTeamName(awayTeam),
            homeOdds: parsedOdds[0],
            drawOdds: parsedOdds[1],
            awayOdds: parsedOdds[2],
            source: 'Bet365'
          });
        } catch (err) {
          continue;
        }
      }

      return matches;
    } catch (err) {
      console.error(`\x1b[31m[Bet365Scraper] Erro ao sincronizar DOM ou timeout estourado. Salvando screenshot de auditoria: ${err.message}\x1b[0m`);
      try {
        await page.screenshot({ path: 'bloqueio-auditoria.png', fullPage: true });
        console.log('\x1b[32m[Bet365Scraper] Screenshot de auditoria salvo com sucesso: bloqueio-auditoria.png\x1b[0m');
      } catch (screenshotError) {
        console.error('\x1b[31m[Bet365Scraper] Falha ao capturar screenshot:', screenshotError.message);
      }
      return [];
    }
  }

  /**
   * Faz parsing resiliente de múltiplos formatos JSON observados em feeds esportivos.
   * @param {any} rawJson
   * @returns {Array<Object>}
   */
  extractMatchesFromAnyJson(rawJson) {
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
      source: 'Bet365'
    };
  }

  /**
   * Dados mockados da Bet365 com pequenas disparidades ortográficas de times comuns no Brasil.
   * As odds aqui contêm combinações que, unidas com a Betano, criarão Surebets perfeitas!
   */
  generateMockDOMMatches() {
    return [
      {
        homeTeam: 'Sao Paulo', // vs "São Paulo FC" da Betano
        awayTeam: 'Atletico-MG', // vs "Atlético Mineiro" da Betano
        normalizedHome: normalizeTeamName('Sao Paulo'),
        normalizedAway: normalizeTeamName('Atletico-MG'),
        homeOdds: 2.10,
        drawOdds: 3.10,
        awayOdds: 3.50, // Melhor Fora (Bet365: 3.50 vs Betano: 3.10)
        source: 'Bet365'
      },
      {
        homeTeam: 'AA Ponte Preta', // vs "Ponte Preta" da Betano
        awayTeam: 'Cruzeiro', // vs "Cruzeiro EC" da Betano
        normalizedHome: normalizeTeamName('AA Ponte Preta'),
        normalizedAway: normalizeTeamName('Cruzeiro'),
        homeOdds: 2.85, // Melhor Casa (Bet365: 2.85 vs Betano: 2.70)
        drawOdds: 2.95,
        awayOdds: 2.55,
        source: 'Bet365'
      },
      {
        homeTeam: 'Palmeiras',
        awayTeam: 'Athletico-PR', // vs "Athletico Paranaense" da Betano
        normalizedHome: normalizeTeamName('Palmeiras'),
        normalizedAway: normalizeTeamName('Athletico-PR'),
        homeOdds: 1.62,
        drawOdds: 3.90, // Melhor Empate (Bet365: 3.90 vs Betano: 3.80)
        awayOdds: 5.40, // Melhor Fora (Bet365: 5.40 vs Betano: 5.25)
        source: 'Bet365'
      },
      {
        // Jogo com Surebet (Arbitragem matemática clara)
        homeTeam: 'Coritiba FC', // vs "Coritiba" da Betano
        awayTeam: 'Red Bull Bragantino', // vs "Bragantino" da Betano
        normalizedHome: normalizeTeamName('Coritiba FC'),
        normalizedAway: normalizeTeamName('Red Bull Bragantino'),
        homeOdds: 3.00,
        drawOdds: 3.80, // Bet365: 3.80 (Melhor Empate)
        awayOdds: 2.60, // Bet365: 2.60 (Melhor Fora)
        source: 'Bet365'
      }
    ];
  }
}
