import mongoose from 'mongoose';
import { connectDatabase, MatchOdds, disconnectDatabase } from './src/database/dbService.js';

async function run() {
  console.log('[Inspect] Conectando ao MongoDB...');
  await connectDatabase();

  try {
    const allMatches = await MatchOdds.find({});
    console.log(`[Inspect] Total de partidas no banco: ${allMatches.length}`);
    
    const leagues = [...new Set(allMatches.map(m => m.league))];
    console.log('[Inspect] Ligas presentes no banco:', leagues);

    console.log('\n--- Detalhamento das Partidas no Banco ---');
    for (const match of allMatches) {
      console.log(`- [${match.league}] ${match.homeTeam} vs ${match.awayTeam} (ID: ${match._id})`);
    }

  } catch (err) {
    console.error('[Inspect] Erro:', err.message);
  } finally {
    await disconnectDatabase();
  }
}

run();
