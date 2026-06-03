/**
 * Limpa e normaliza os nomes de times esportivos para melhorar a precisão do matching.
 * @param {string} name Nome do time
 * @returns {string} Nome normalizado
 */
export function normalizeTeamName(name) {
  if (!name || typeof name !== 'string') return '';

  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, ' ') // Substitui caracteres especiais/hifens por espaços
    .replace(/\b(fc|f\.c\.|sc|s\.c\.|ad|a\.d\.|clube|club|deportivo|rj|sp|mg|rs|ba|pr|pe|ce|go|regatas|sociedade|esportiva)\b/gi, '') // Remove abreviações comuns de futebol
    .replace(/\s+/g, ' ') // Remove espaços extras
    .trim();
}

/**
 * Calcula a similaridade entre duas strings usando o Coeficiente Sørensen-Dice.
 * @param {string} first Primeira string
 * @param {string} second Segunda string
 * @returns {number} Score de similaridade entre 0 e 1
 */
export function diceCoefficient(first, second) {
  const cleanFirst = first.replace(/\s+/g, '');
  const cleanSecond = second.replace(/\s+/g, '');

  if (cleanFirst === cleanSecond) return 1.0;
  if (cleanFirst.length < 2 || cleanSecond.length < 2) return 0.0;

  const firstBigrams = new Map();
  for (let i = 0; i < cleanFirst.length - 1; i++) {
    const bigram = cleanFirst.substring(i, i + 2);
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;
    firstBigrams.set(bigram, count);
  }

  let intersectionSize = 0;
  for (let i = 0; i < cleanSecond.length - 1; i++) {
    const bigram = cleanSecond.substring(i, i + 2);
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) : 0;

    if (count > 0) {
      firstBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (cleanFirst.length + cleanSecond.length - 2);
}

/**
 * Verifica se os dois times coincidem acima de um limiar de similaridade especificado.
 * @param {string} teamA Nome do time no primeiro sportsbook
 * @param {string} teamB Nome do time no segundo sportsbook
 * @param {number} threshold Limiar mínimo de similaridade (padrão: 0.60)
 * @returns {boolean}
 */
export function areTeamsMatching(teamA, teamB, threshold = 0.60) {
  const normA = normalizeTeamName(teamA);
  const normB = normalizeTeamName(teamB);

  // Match exato após normalização básica
  if (normA === normB && normA.length > 0) return true;

  const similarity = diceCoefficient(normA, normB);
  return similarity >= threshold;
}

// Bloco para execução rápida de testes (node src/utils/matchEngine.js)
if (process.argv[1] && process.argv[1].endsWith('matchEngine.js')) {
  console.log('--- Executando Testes Unitários do Motor de Matching ---');
  
  const testCases = [
    { a: 'São Paulo FC', b: 'Sao Paulo', expected: true },
    { a: 'Ponte Preta', b: 'AA Ponte Preta', expected: true },
    { a: 'Atlético Mineiro', b: 'Atletico-MG', expected: true },
    { a: 'Palmeiras', b: 'Corinthians', expected: false },
    { a: 'Athletico Paranaense', b: 'Athletico-PR', expected: true },
    { a: 'Cruzeiro EC', b: 'Cruzeiro', expected: true }
  ];

  testCases.forEach(({ a, b, expected }) => {
    const result = areTeamsMatching(a, b);
    const score = diceCoefficient(normalizeTeamName(a), normalizeTeamName(b));
    console.log(`[Dice: ${score.toFixed(2)}] "${a}" vs "${b}" -> Match: ${result} (Esperado: ${expected})`);
  });
}

/**
 * Intercepta e sanitiza o payload bruto vindo da The Odds API antes de qualquer processamento ou inserção no banco de dados.
 * Remove jogos com termos de e-sports, jogos passados, jogos sem bookmakers/mercados H2H válidos ou com odds inválidas.
 * 
 * @param {Array} events Array de eventos brutos da The Odds API
 * @returns {Array} Array de eventos sanitizados e válidos
 */
export function interceptAndSanitizeOddsPayload(events) {
  if (!Array.isArray(events)) return [];

  const forbiddenTerms = ['esports', 'cyber', 'srl', 'e-sports', 'e-soccer', 'efootball', 'virtual', 'fifa efoot', 'fifa online', 'ea sports fc'];
  const now = Date.now();

  return events.filter(event => {
    // 1. Validação de estrutura básica
    if (!event || typeof event !== 'object') return false;
    
    const homeTeam = event.home_team;
    const awayTeam = event.away_team;
    const sportTitle = event.sport_title || '';
    const sportKey = event.sport_key || '';
    const commenceTime = event.commence_time;

    if (!homeTeam || !awayTeam || !commenceTime) return false;

    // 2. Filtro de Status / e-Sports e Termos Proibidos
    const checkTextForForbiddenTerms = (text) => {
      if (!text) return false;
      const lowerText = String(text).toLowerCase();
      return forbiddenTerms.some(term => lowerText.includes(term));
    };

    if (
      checkTextForForbiddenTerms(homeTeam) ||
      checkTextForForbiddenTerms(awayTeam) ||
      checkTextForForbiddenTerms(sportTitle) ||
      checkTextForForbiddenTerms(sportKey)
    ) {
      return false; // Descarta e-sports, cyber, srl, fifa
    }

    // 3. Validação do commence_time (Remover jogos que já iniciaram/passaram no horário UTC/Local)
    const matchTime = new Date(commenceTime).getTime();
    if (isNaN(matchTime) || matchTime < now) {
      return false; // Descarta jogos no passado
    }

    // 4. Garantir que a partida tenha casas de apostas (bookmakers) e mercados válidos
    if (!Array.isArray(event.bookmakers) || event.bookmakers.length === 0) {
      return false; // Sem bookmakers
    }

    // Função auxiliar para fazer o casting de odds com suporte a vírgulas
    const parsePrice = (price) => {
      if (price === null || price === undefined) return 0;
      if (typeof price === 'number') return price;
      if (typeof price === 'string') {
        const cleanStr = price.trim().replace(',', '.');
        const parsed = parseFloat(cleanStr);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    // Filtramos os bookmakers para garantir que tenham mercados H2H válidos com odds maiores que 1.0
    const validBookmakers = [];

    for (const bm of event.bookmakers) {
      if (!bm || !Array.isArray(bm.markets)) continue;

      const h2hMarket = bm.markets.find(m => m.key === 'h2h');
      if (!h2hMarket || !Array.isArray(h2hMarket.outcomes) || h2hMarket.outcomes.length < 2) continue;

      // Sanitiza e valida cada outcome do mercado H2H
      let hasInvalidOdds = false;
      const sanitizedOutcomes = [];

      for (const outcome of h2hMarket.outcomes) {
        if (!outcome || outcome.price === undefined || outcome.price === null) {
          hasInvalidOdds = true;
          break;
        }

        const price = parsePrice(outcome.price);
        if (price <= 1.0) {
          hasInvalidOdds = true;
          break;
        }

        sanitizedOutcomes.push({
          ...outcome,
          price: price // Casting garantido
        });
      }

      if (!hasInvalidOdds && sanitizedOutcomes.length > 0) {
        // Atualiza outcomes no mercado h2h
        const updatedMarket = { ...h2hMarket, outcomes: sanitizedOutcomes };
        const updatedMarkets = bm.markets.map(m => m.key === 'h2h' ? updatedMarket : m);
        validBookmakers.push({
          ...bm,
          markets: updatedMarkets
        });
      }
    }

    // Se nenhum bookmaker com odds H2H válidas sobrou, descarta o jogo
    if (validBookmakers.length === 0) {
      return false;
    }

    // Atualiza o objeto bruto com os bookmakers e odds totalmente sanitizados
    event.bookmakers = validBookmakers;
    return true;
  });
}
