import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, MatchOdds, disconnectDatabase } from './src/database/dbService.js';

async function run() {
  console.log('[Export] Conectando ao MongoDB...');
  await connectDatabase();

  // Verifica se o mongoose conseguiu se conectar com sucesso
  // (readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting)
  if (mongoose.connection.readyState !== 1) {
    console.error('[Export] Erro: Não foi possível conectar ao MongoDB. Verifique se o serviço do MongoDB está rodando ou se a URL no .env está correta.');
    process.exit(1);
  }

  try {
    console.log('[Export] Buscando registros de partidas (MatchOdds)...');
    const allMatches = await MatchOdds.find({}).lean();
    console.log(`[Export] Total de partidas encontradas no banco: ${allMatches.length}`);

    if (allMatches.length === 0) {
      console.log('[Export] O banco de dados está vazio. Nada para exportar.');
      return;
    }

    // Define o nome do arquivo de saída. Aceita um argumento do terminal para personalizar, sanitizando o input para evitar path traversal.
    let filename = 'odds_db_export.json';
    if (process.argv[2]) {
      const sanitized = path.basename(process.argv[2]);
      if (sanitized && sanitized !== '.' && sanitized !== '..') {
        filename = sanitized;
        if (!filename.endsWith('.json')) {
          filename += '.json';
        }
      }
    }

    const outputPath = path.join(process.cwd(), filename);
    console.log(`[Export] Gravando dados no arquivo: ${outputPath}`);

    // Grava no arquivo com formatação legível
    await fs.writeFile(outputPath, JSON.stringify(allMatches, null, 2), 'utf-8');
    console.log(`[Export] Sucesso! Banco de dados exportado com sucesso para ${filename}`);

  } catch (err) {
    console.error('[Export] Erro durante o processo de exportação:', err.message);
  } finally {
    await disconnectDatabase();
  }
}

run();
