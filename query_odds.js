import mongoose from 'mongoose';
import { connectDatabase, MatchOdds, disconnectDatabase } from './src/database/dbService.js';

async function run() {
  console.log('[Query] Conectando ao MongoDB...');
  await connectDatabase();

  try {
    console.log('[Query] Buscando jogo Santos vs Vitória...');
    // Busca registros usando expressão regular insensível a maiúsculas/minúsculas
    const match = await MatchOdds.findOne({
      $or: [
        {
          homeTeam: /Santos/i,
          awayTeam: /Vitória/i
        },
        {
          homeTeam: /Vitória/i,
          awayTeam: /Santos/i
        }
      ]
    });

    if (!match) {
      console.log('[Query] Nenhuma partida encontrada entre Santos e Vitória.');
      return;
    }

    console.log('\n========================================');
    console.log(`Partida: ${match.homeTeam} vs ${match.awayTeam}`);
    console.log(`Data do Evento: ${match.eventDate ? match.eventDate.toLocaleString('pt-BR') : 'Não cadastrada'}`);
    console.log('----------------------------------------');

    if (match.sportsbookA) {
      console.log('Casa A - DraftKings (API OddsBlaze):');
      console.log(`  Santos para Vencer (Casa): ${match.sportsbookA.homeOdds}`);
      console.log(`  Empate: ${match.sportsbookA.drawOdds}`);
      console.log(`  Vitória para Vencer (Fora): ${match.sportsbookA.awayOdds}`);
      console.log(`  Atualizado em: ${match.sportsbookA.scrapedAt.toLocaleString('pt-BR')}`);
    } else {
      console.log('Casa A - DraftKings: Não disponível');
    }

    console.log('----------------------------------------');

    if (match.sportsbookB) {
      console.log('Casa B - Betano/Bet365 (Simulação Arbitragem):');
      console.log(`  Santos para Vencer (Casa): ${match.sportsbookB.homeOdds}`);
      console.log(`  Empate: ${match.sportsbookB.drawOdds}`);
      console.log(`  Vitória para Vencer (Fora): ${match.sportsbookB.awayOdds}`);
      console.log(`  Atualizado em: ${match.sportsbookB.scrapedAt.toLocaleString('pt-BR')}`);
    } else {
      console.log('Casa B - Betano/Bet365: Não disponível');
    }
    console.log('========================================\n');

  } catch (error) {
    console.error('[Query] Erro ao consultar banco:', error.message);
  } finally {
    await disconnectDatabase();
  }
}

run();
