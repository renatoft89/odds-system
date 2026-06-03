import { MatchOdds } from '../database/dbService.js';

export class LeverageService {
  /**
   * Constrói o pipeline da estratégia de Soros a partir dos dados do MongoDB.
   * @param {number} initialStake Banca de entrada inicial (padrão: R$ 10,00).
   * @param {number} steps Quantidade de passos de Soros (padrão: 3).
   * @returns {Promise<Array<Object>>} Pipeline composto de apostas sequenciais.
   */
  async generateSorosPipeline(initialStake = 10, steps = 3, league = 'brazil-serie-a') {
    console.log(`[LeverageService] Gerando pipeline de Soros com banca inicial de R$ ${initialStake} para ${steps} passos da liga "${league}"...`);

    try {
      // 1. Busca partidas futuras (data de início maior ou igual a hoje com 5 min de tolerância)
      const nowLimit = new Date(Date.now() - 5 * 60 * 1000);
      let matches = await MatchOdds.find({
        league: league,
        eventDate: { $gte: nowLimit },
        sportsbookA: { $ne: null },
        sportsbookB: { $ne: null }
      });

      // REGRA DE NEGÓCIO / DX FALLBACK: Se a grade de jogos futuros reais no Brasileirão/Copa estiver vazia
      // (ex: pausa de campeonatos no meio de semana), relaxa o filtro de data para fins de demonstração rica
      if (matches.length < 2) {
        console.log(`[LeverageService] Grade de eventos futuros da liga "${league}" com apenas ${matches.length} partidas. Usando dados cadastrados para demonstração.`);
        matches = await MatchOdds.find({
          league: league,
          sportsbookA: { $ne: null },
          sportsbookB: { $ne: null }
        });
      }

      if (matches.length === 0) {
        console.warn('[LeverageService] Nenhuma partida encontrada no banco de dados.');
        return [];
      }

      // Tentativas adaptativas de relaxamento de filtros (Tiers)
      // Tenta primeiro a faixa estrita de 1.45 - 1.55 com 150m de intervalo.
      // Se não preencher todos os steps necessários, relaxa as odds e depois a janela de tempo.
      const filterTiers = [
        { minOdd: 1.45, maxOdd: 1.55, timeMarginMin: 150 },
        { minOdd: 1.35, maxOdd: 1.65, timeMarginMin: 150 },
        { minOdd: 1.25, maxOdd: 1.85, timeMarginMin: 150 },
        { minOdd: 1.15, maxOdd: 2.20, timeMarginMin: 90 },  // Relaxa tempo para 90 min se necessário
        { minOdd: 1.05, maxOdd: 3.50, timeMarginMin: 30 },  // Relaxa tempo para 30 min se necessário
        { minOdd: 1.01, maxOdd: 10.00, timeMarginMin: 0 }   // Fallback total para demonstração rica
      ];

      let finalPipeline = [];

      for (const tier of filterTiers) {
        const candidates = [];

        for (const match of matches) {
          const oA = match.sportsbookA;
          const oB = match.sportsbookB;
          const nameA = oA?.bookmakerName || 'Casa A';
          const nameB = oB?.bookmakerName || 'Casa B';

          const eventDate = match.eventDate || match.lastUpdated || new Date();

          const getDCOdd = (o1, o2) => {
            if (!o1 || !o2) return 0;
            const rawDC = (o1 * o2) / (o1 + o2);
            return Number((rawDC * 0.95).toFixed(2));
          };

          const oddA_1X = getDCOdd(oA.homeOdds, oA.drawOdds);
          const oddB_1X = getDCOdd(oB.homeOdds, oB.drawOdds);

          const oddA_X2 = getDCOdd(oA.awayOdds, oA.drawOdds);
          const oddB_X2 = getDCOdd(oB.awayOdds, oB.drawOdds);

          const outcomes = [
            { selection: `Vitória Casa (1) — ${match.homeTeam}`, oddA: oA.homeOdds, oddB: oB.homeOdds },
            { selection: 'Empate (X)', oddA: oA.drawOdds, oddB: oB.drawOdds },
            { selection: `Vitória Fora (2) — ${match.awayTeam}`, oddA: oA.awayOdds, oddB: oB.awayOdds },
            { selection: `Dupla Chance: ${match.homeTeam} ou Empate (1X)`, oddA: oddA_1X, oddB: oddB_1X },
            { selection: `Dupla Chance: ${match.awayTeam} ou Empate (X2)`, oddA: oddA_X2, oddB: oddB_X2 }
          ];

          for (const outcome of outcomes) {
            const chosenOdd = Math.max(outcome.oddA, outcome.oddB);
            const lowerOdd = Math.min(outcome.oddA, outcome.oddB);
            const bookmaker = outcome.oddA >= outcome.oddB ? nameA : nameB;

            // Hard cap absoluto: odds acima de 10.0 são azarões e não servem para Soros
            if (chosenOdd > 10.0) continue;

            if (chosenOdd >= tier.minOdd && chosenOdd <= tier.maxOdd) {
              const ev = lowerOdd > 0 ? (chosenOdd / lowerOdd - 1.0) : 0.0;
              const refOdd = lowerOdd > 1.0 ? lowerOdd : chosenOdd;
              const winProb = (1 / refOdd) * 100;

              candidates.push({
                matchId: match._id,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                confronto: `${match.homeTeam} vs ${match.awayTeam}`,
                eventDate: new Date(eventDate),
                selection: outcome.selection,
                odd: chosenOdd,
                bookmaker: bookmaker,
                oddA: outcome.oddA,
                oddB: outcome.oddB,
                ev: Number(ev.toFixed(4)),
                winProbabilityPercentage: Number(winProb.toFixed(2))
              });
            }
          }
        }

        if (candidates.length === 0) continue;

        // 1. Ordenação cronológica estrita (ascendente), com desempate por maior probabilidade de green e maior EV+
        candidates.sort((a, b) => {
          const timeDiff = a.eventDate.getTime() - b.eventDate.getTime();
          if (timeDiff !== 0) return timeDiff;
          
          if (b.winProbabilityPercentage !== a.winProbabilityPercentage) {
            return b.winProbabilityPercentage - a.winProbabilityPercentage;
          }
          
          return b.ev - a.ev;
        });

        const pipeline = [];

        for (const cand of candidates) {
          if (pipeline.length >= steps) break;

          // Previne duplicidade do mesmo jogo em passos diferentes
          const alreadyUsed = pipeline.some(step => step.matchId.toString() === cand.matchId.toString());
          if (alreadyUsed) {
            continue;
          }

          // Valida a margem de tempo de liquidação em relação ao passo anterior
          if (pipeline.length > 0) {
            const lastStep = pipeline[pipeline.length - 1];
            const timeDiffMin = (cand.eventDate.getTime() - lastStep.eventDate.getTime()) / (60 * 1000);
            
            if (timeDiffMin < tier.timeMarginMin) {
              // Conflito de horário ou margem menor que a exigida pelo Tier, pula este candidato
              continue;
            }
          }

          pipeline.push(cand);
        }

        // Se conseguimos montar uma sequência completa para a quantidade de passos requeridos
        if (pipeline.length >= steps) {
          console.log(`[LeverageService] Sucesso na montagem do pipeline utilizando o Tier com Odds [${tier.minOdd} - ${tier.maxOdd}] e intervalo de ${tier.timeMarginMin} min.`);
          
          let currentStake = Number(initialStake);
          for (let i = 0; i < pipeline.length; i++) {
            const stepMatch = pipeline[i];
            const stepOdd = stepMatch.odd;
            const entryStake = currentStake;
            const projectedReturn = entryStake * stepOdd;
            const profit = projectedReturn - entryStake;

            finalPipeline.push({
              step: i + 1,
              matchId: stepMatch.matchId,
              homeTeam: stepMatch.homeTeam,
              awayTeam: stepMatch.awayTeam,
              confronto: stepMatch.confronto,
              eventDate: stepMatch.eventDate,
              selection: stepMatch.selection,
              odd: stepOdd,
              bookmaker: stepMatch.bookmaker,
              oddA: stepMatch.oddA,
              oddB: stepMatch.oddB,
              ev: stepMatch.ev,
              winProbabilityPercentage: stepMatch.winProbabilityPercentage,
              stake: Number(entryStake.toFixed(2)),
              retorno: Number(projectedReturn.toFixed(2)),
              lucro: Number(profit.toFixed(2))
            });

            currentStake = projectedReturn;
          }
          break; // Concluiu a geração com sucesso
        } else {
          finalPipeline = []; // Limpa para tentar o próximo tier mais flexível
        }
      }

      // Fallback parcial irrestrito caso o banco possua pouquíssimas partidas
      if (finalPipeline.length === 0) {
        console.log('[LeverageService] Ingressando em fallback parcial irrestrito por escassez extrema...');
        const candidates = [];

        for (const match of matches) {
          const oA = match.sportsbookA;
          const oB = match.sportsbookB;
          const nameA = oA?.bookmakerName || 'Casa A';
          const nameB = oB?.bookmakerName || 'Casa B';
          const eventDate = match.eventDate || match.lastUpdated || new Date();

          const getDCOdd = (o1, o2) => {
            if (!o1 || !o2) return 0;
            const rawDC = (o1 * o2) / (o1 + o2);
            return Number((rawDC * 0.95).toFixed(2));
          };

          const oddA_1X = getDCOdd(oA.homeOdds, oA.drawOdds);
          const oddB_1X = getDCOdd(oB.homeOdds, oB.drawOdds);

          const oddA_X2 = getDCOdd(oA.awayOdds, oA.drawOdds);
          const oddB_X2 = getDCOdd(oB.awayOdds, oB.drawOdds);

          const outcomes = [
            { selection: `Vitória Casa (1) — ${match.homeTeam}`, oddA: oA.homeOdds, oddB: oB.homeOdds },
            { selection: 'Empate (X)', oddA: oA.drawOdds, oddB: oB.drawOdds },
            { selection: `Vitória Fora (2) — ${match.awayTeam}`, oddA: oA.awayOdds, oddB: oB.awayOdds },
            { selection: `Dupla Chance: ${match.homeTeam} ou Empate (1X)`, oddA: oddA_1X, oddB: oddB_1X },
            { selection: `Dupla Chance: ${match.awayTeam} ou Empate (X2)`, oddA: oddA_X2, oddB: oddB_X2 }
          ];

          for (const outcome of outcomes) {
            const chosenOdd = Math.max(outcome.oddA, outcome.oddB);
            const lowerOdd = Math.min(outcome.oddA, outcome.oddB);
            const bookmaker = outcome.oddA >= outcome.oddB ? nameA : nameB;

            // Hard cap absoluto: odds acima de 10.0 são azarões e não servem para Soros
            if (chosenOdd > 10.0) continue;

            const ev = lowerOdd > 0 ? (chosenOdd / lowerOdd - 1.0) : 0.0;
            const refOdd = lowerOdd > 1.0 ? lowerOdd : chosenOdd;
            const winProb = (1 / refOdd) * 100;

            candidates.push({
              matchId: match._id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              confronto: `${match.homeTeam} vs ${match.awayTeam}`,
              eventDate: new Date(eventDate),
              selection: outcome.selection,
              odd: chosenOdd,
              bookmaker: bookmaker,
              oddA: outcome.oddA,
              oddB: outcome.oddB,
              ev: Number(ev.toFixed(4)),
              winProbabilityPercentage: Number(winProb.toFixed(2))
            });
          }
        }

        // 1. Ordenação cronológica estrita (ascendente) com desempates
        candidates.sort((a, b) => {
          const timeDiff = a.eventDate.getTime() - b.eventDate.getTime();
          if (timeDiff !== 0) return timeDiff;
          
          if (b.winProbabilityPercentage !== a.winProbabilityPercentage) {
            return b.winProbabilityPercentage - a.winProbabilityPercentage;
          }
          
          return b.ev - a.ev;
        });

        // 2. Busca adaptativa com margens temporais regressivas em caso de escassez
        let pipeline = [];
        const fallbackMargins = [150, 90, 30, 0];

        for (const margin of fallbackMargins) {
          pipeline = [];
          for (const cand of candidates) {
            if (pipeline.length >= steps) break;

            const alreadyUsed = pipeline.some(step => step.matchId.toString() === cand.matchId.toString());
            if (alreadyUsed) continue;

            if (pipeline.length > 0) {
              const lastStep = pipeline[pipeline.length - 1];
              const timeDiffMin = (cand.eventDate.getTime() - lastStep.eventDate.getTime()) / (60 * 1000);
              if (timeDiffMin < margin) {
                // Pula se não respeitar o intervalo mínimo atual
                continue;
              }
            }

            pipeline.push(cand);
          }

          if (pipeline.length >= steps) {
            console.log(`[LeverageService] Fallback bem sucedido com margem de ${margin} minutos.`);
            break;
          }
        }

        // Se mesmo com margem 0 não conseguirmos preencher todos os passos, apenas pega o que foi possível
        if (pipeline.length === 0 && candidates.length > 0) {
          pipeline = candidates.slice(0, steps);
        }

        let currentStake = Number(initialStake);
        for (let i = 0; i < pipeline.length; i++) {
          const stepMatch = pipeline[i];
          const stepOdd = stepMatch.odd;
          const entryStake = currentStake;
          const projectedReturn = entryStake * stepOdd;
          const profit = projectedReturn - entryStake;

          finalPipeline.push({
            step: i + 1,
            matchId: stepMatch.matchId,
            homeTeam: stepMatch.homeTeam,
            awayTeam: stepMatch.awayTeam,
            confronto: stepMatch.confronto,
            eventDate: stepMatch.eventDate,
            selection: stepMatch.selection,
            odd: stepOdd,
            bookmaker: stepMatch.bookmaker,
            oddA: stepMatch.oddA,
            oddB: stepMatch.oddB,
            ev: stepMatch.ev,
            winProbabilityPercentage: stepMatch.winProbabilityPercentage,
            stake: Number(entryStake.toFixed(2)),
            retorno: Number(projectedReturn.toFixed(2)),
            lucro: Number(profit.toFixed(2))
          });

          currentStake = projectedReturn;
        }
      }

      console.log(`[LeverageService] Pipeline de Soros montado com sucesso contendo ${finalPipeline.length} passos.`);
      return finalPipeline;
    } catch (error) {
      console.error('[LeverageService] Erro ao construir pipeline Soros:', error.message);
      return [];
    }
  }
}

export default new LeverageService();
