import mongoose from 'mongoose';
import { sanitizeOddsValue } from '../utils/dataSanitizer.js';

// Configura o Mongoose para usar strictQuery para proteção adicional de injeção
mongoose.set('strictQuery', true);

const OddsSchema = new mongoose.Schema({
  homeOdds: { type: Number, required: true, min: 1.0 },
  drawOdds: { type: Number, required: true, min: 1.0 },
  awayOdds: { type: Number, required: true, min: 1.0 },
  bookmakerKey: { type: String, default: null },   // ex: 'unibet_nl', 'ladbrokes_uk'
  bookmakerName: { type: String, default: null },  // ex: 'Unibet', 'Ladbrokes'
  scrapedAt: { type: Date, default: Date.now }
});

const SharpOddsSchema = new mongoose.Schema({
  homeOdds: { type: Number, required: true, min: 1.0 },
  drawOdds: { type: Number, required: true, min: 1.0 },
  awayOdds: { type: Number, required: true, min: 1.0 },
  bookmakerKey: { type: String, default: null },   // ex: 'marathonbet', 'betfair_sb_uk'
  bookmakerName: { type: String, default: null }
});

const MatchOddsSchema = new mongoose.Schema({
  homeTeam: { type: String, required: true, trim: true },
  awayTeam: { type: String, required: true, trim: true },
  normalizedHomeTeam: { type: String, required: true, trim: true },
  normalizedAwayTeam: { type: String, required: true, trim: true },
  sportsbookA: { type: OddsSchema, default: null },
  sportsbookB: { type: OddsSchema, default: null },
  sharpOdds: { type: SharpOddsSchema, default: null }, // Odds de referência sharp (Marathonbet, Betfair, etc.)
  eventDate: { type: Date, default: Date.now },
  league: { type: String, default: 'brazil-serie-a', trim: true },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Adiciona índices para buscas rápidas e garantia de performance
MatchOddsSchema.index({ normalizedHomeTeam: 1, normalizedAwayTeam: 1 });

const MatchOdds = mongoose.model('MatchOdds', MatchOddsSchema);

let isConnected = false;

/**
 * Conecta com segurança ao MongoDB.
 * @param {string} uri URI de conexão do MongoDB
 */
export async function connectDatabase(uri = process.env.MONGO_URI) {
  if (!uri) {
    const defaultUri = 'mongodb://127.0.0.1:27017/odds_db';
    console.warn(`[Database] MONGO_URI não definida. Utilizando fallback local seguro: ${defaultUri}`);
    uri = defaultUri;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000 // Timeout curto para desenvolvimento ágil
    });
    isConnected = true;
    console.log('[Database] Conexão com MongoDB estabelecida com sucesso.');
  } catch (error) {
    console.warn(`[Database] [Aviso] Falha ao conectar ao MongoDB (${error.message}). Rodando em modo de simulação (Log fallback).`);
    isConnected = false;
  }
}

/**
 * Desconecta a conexão atual com o MongoDB.
 */
export async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    console.log('[Database] Conexão com MongoDB encerrada.');
  } else {
    console.log('[Database] Encerrando simulador de banco de dados.');
  }
}

/**
 * Sanitiza inputs de strings para prevenir tentativas básicas de NoSQL Injection.
 * @param {any} val Valor de entrada
 * @returns {string} String limpa
 */
function sanitizeInput(val) {
  if (typeof val !== 'string') return String(val || '');
  // Remove operadores comuns do MongoDB para evitar manipulação de queries
  return val.replace(/[\$]/g, '').trim();
}

/**
 * Salva ou atualiza odds de forma consolidada no MongoDB.
 * @param {Object} data Dados da partida e odds extraídas.
 * @param {string} data.homeTeam Nome do time da casa.
 * @param {string} data.awayTeam Nome do time visitante.
 * @param {string} data.normalizedHome Nome normalizado do time da casa.
 * @param {string} data.normalizedAway Nome normalizado do time visitante.
 * @param {string} data.source Origem dos dados ('sportsbookA' ou 'sportsbookB').
 * @param {number} data.homeOdds Odds vitória casa.
 * @param {number} data.drawOdds Odds empate.
 * @param {number} data.awayOdds Odds vitória visitante.
 * @param {Date|string} data.eventDate Data real do início do jogo.
 */
export async function saveOrUpdateOdds({
  homeTeam,
  awayTeam,
  normalizedHome,
  normalizedAway,
  source,
  homeOdds,
  drawOdds,
  awayOdds,
  bookmakerKey,
  bookmakerName,
  sharpOdds,    // { homeOdds, drawOdds, awayOdds, bookmakerKey, bookmakerName } | null
  eventDate,
  league
}) {
  // Sanitiza rigorosamente as strings de entrada (Proteção NoSQL Injection)
  const cleanHome = sanitizeInput(homeTeam);
  const cleanAway = sanitizeInput(awayTeam);
  const cleanNormHome = sanitizeInput(normalizedHome);
  const cleanNormAway = sanitizeInput(normalizedAway);
  const cleanSource = sanitizeInput(source);
  const cleanLeague = sanitizeInput(league || 'brazil-serie-a');

  if (cleanSource !== 'sportsbookA' && cleanSource !== 'sportsbookB') {
    throw new Error(`[Database] Fonte de odds inválida fornecida: ${cleanSource}`);
  }

  const numericHomeOdds = sanitizeOddsValue(homeOdds);
  const numericDrawOdds = sanitizeOddsValue(drawOdds);
  const numericAwayOdds = sanitizeOddsValue(awayOdds);

  if (isNaN(numericHomeOdds) || isNaN(numericDrawOdds) || isNaN(numericAwayOdds)) {
    throw new Error('[Database] Os valores das odds devem ser numéricos.');
  }

  const oddsData = {
    homeOdds: numericHomeOdds,
    drawOdds: numericDrawOdds,
    awayOdds: numericAwayOdds,
    bookmakerKey: bookmakerKey || null,
    bookmakerName: bookmakerName || null,
    scrapedAt: new Date()
  };

  // Se não estiver conectado, simula a persistência exibindo nos logs
  if (!isConnected) {
    console.log(`[Database SIMULADO] Salvo com sucesso (${cleanSource}) [${cleanLeague}]: ${cleanHome} (${numericHomeOdds}) vs ${cleanAway} (${numericAwayOdds}) | Empate: ${numericDrawOdds}`);
    return;
  }

  try {
    // Tenta encontrar um registro existente utilizando os nomes normalizados e a liga correspondente
    let match = await MatchOdds.findOne({
      normalizedHomeTeam: cleanNormHome,
      normalizedAwayTeam: cleanNormAway,
      league: cleanLeague
    });

    if (match) {
      match[cleanSource] = oddsData;
      match.lastUpdated = new Date();
      if (eventDate) match.eventDate = new Date(eventDate);
      if (sharpOdds) match.sharpOdds = sharpOdds;
      await match.save();
      console.log(`[Database] Odds atualizadas para: ${cleanHome} vs ${cleanAway} (${cleanSource}) [${cleanLeague}]`);
    } else {
      const newMatch = new MatchOdds({
        homeTeam: cleanHome,
        awayTeam: cleanAway,
        normalizedHomeTeam: cleanNormHome,
        normalizedAwayTeam: cleanNormAway,
        [cleanSource]: oddsData,
        sharpOdds: sharpOdds || null,
        league: cleanLeague,
        eventDate: eventDate ? new Date(eventDate) : new Date(),
        lastUpdated: new Date()
      });
      await newMatch.save();
      console.log(`[Database] Nova partida salva: ${cleanHome} vs ${cleanAway} (${cleanSource}) [${cleanLeague}]`);
    }
  } catch (error) {
    console.error('[Database] Erro ao gravar odds no MongoDB:', error.message);
    throw error;
  }
}

export { MatchOdds };
