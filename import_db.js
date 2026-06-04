import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, MatchOdds, disconnectDatabase } from './src/database/dbService.js';

async function run() {
  console.log('[Import] Conectando ao MongoDB...');
  await connectDatabase();

  // Verifica se o mongoose conseguiu se conectar com sucesso
  if (mongoose.connection.readyState !== 1) {
    console.error('[Import] Erro: Não foi possível conectar ao MongoDB. Verifique se o serviço do MongoDB está rodando ou se a URL no .env está correta.');
    process.exit(1);
  }

  try {
    // Define o nome do arquivo de entrada. Aceita um argumento do terminal para personalizar, sanitizando o input para evitar path traversal.
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

    const inputPath = path.join(process.cwd(), filename);
    console.log(`[Import] Lendo dados do arquivo: ${inputPath}`);

    let fileContent;
    try {
      fileContent = await fs.readFile(inputPath, 'utf-8');
    } catch (readErr) {
      console.error(`[Import] Erro: Não foi possível ler o arquivo ${filename}. Verifique se o arquivo existe.`);
      return;
    }

    const matches = JSON.parse(fileContent);

    if (!Array.isArray(matches)) {
      console.error('[Import] Erro: O formato do arquivo JSON de backup é inválido (deve ser um array de partidas).');
      return;
    }

    console.log(`[Import] Encontrados ${matches.length} registros no arquivo de backup.`);

    // Limpa a coleção atual antes de importar para evitar duplicatas ou dados antigos conflitantes
    console.log('[Import] Limpando registros antigos da coleção MatchOdds...');
    const deleteResult = await MatchOdds.deleteMany({});
    console.log(`[Import] ${deleteResult.deletedCount} registros antigos removidos.`);

    // Insere os novos dados
    console.log('[Import] Inserindo registros do backup...');
    const insertResult = await MatchOdds.insertMany(matches);
    console.log(`[Import] Sucesso! ${insertResult.length} partidas importadas com sucesso no MongoDB.`);

  } catch (err) {
    console.error('[Import] Erro durante o processo de importação:', err.message);
  } finally {
    await disconnectDatabase();
  }
}

run();
