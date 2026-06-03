import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Registra o plugin de evasão (stealth)
chromium.use(stealthPlugin());

/**
 * Gerenciador responsável por instanciar o navegador mascarado.
 * Implementa técnicas avançadas de evasão contra detecção de WAFs e Anti-Bots.
 */
export class BrowserManager {
  /**
   * Inicializa uma instância do Chromium com o plugin Stealth e argumentos de evasão.
   * @param {Object} options Configurações de inicialização.
   * @param {boolean} options.headless Indica se o navegador deve rodar em modo oculto.
   * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext}>}
   */
  static async launch({ headless = true } = {}) {
    const defaultArgs = [
      '--disable-blink-features=AutomationControlled',
      '--disable-canvas-aa', // Evasão contra canvas fingerprinting
      '--disable-2d-canvas-clip-aa',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Otimização para containers Docker
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ];

    const proxyServer = process.env.PROXY_SERVER;
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;
    const proxyBypass = process.env.PROXY_BYPASS || 'localhost,127.0.0.1';

    const launchOptions = {
      headless,
      args: defaultArgs,
    };

    if (proxyServer) {
      launchOptions.proxy = {
        server: proxyServer,
        bypass: proxyBypass,
      };

      if (proxyUsername) launchOptions.proxy.username = proxyUsername;
      if (proxyPassword) launchOptions.proxy.password = proxyPassword;
      console.log(`[BrowserManager] Proxy habilitado (${proxyServer}).`);
    }

    console.log(`[BrowserManager] Inicializando Chromium (Headless: ${headless})...`);

    try {
      const browser = await chromium.launch(launchOptions);

      // Lista de User-Agents comuns e reais para randomização
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      ];
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

      const context = await browser.newContext({
        userAgent: randomUserAgent,
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        // Mascara explicitamente o valor de navigator.webdriver (segunda camada)
        extraHTTPHeaders: {
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      });

      // Injeta scripts para forçar evasões adicionais no contexto
      await context.addInitScript(() => {
        // Redefine a propriedade navigator.webdriver para falso
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Simula plugins de navegador reais para evitar detecção
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Configura propriedades de idioma consistentes
        Object.defineProperty(navigator, 'languages', {
          get: () => ['pt-BR', 'pt', 'en-US', 'en'],
        });
      });

      console.log('[BrowserManager] Navegador e contexto configurados com sucesso.');
      return { browser, context };
    } catch (error) {
      console.error('[BrowserManager] Erro fatal ao iniciar o navegador:', error.message);
      throw error;
    }
  }
}
