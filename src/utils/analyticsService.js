import { MatchOdds } from '../database/dbService.js';
import { getSimilarityRatio, removeVigAndGetTrueProbabilities } from './mathUtils.js';
import pinnacleService from './pinnacleService.js';

export class AnalyticsService {
  getBrazilDateKey(date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  getBrazilDateLabel(date) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  /**
   * Calcula analiticamente "A Boa do Dia" a partir de todas as partidas no banco de dados,
   * cruzando com as linhas da Pinnacle (corretora sharp) para extrair o valor esperado real (EV+).
   * 
   * @param {number} defaultStake Banca de referência para cálculo dos bilhetes (padrão: R$ 10,00).
   * @returns {Promise<Object>} Estrutura contendo a Boa Segura, EV Máximo e a Tripla de Ouro.
   */
  async calculateBoaDoDia(defaultStake = 10) {
    console.log('[AnalyticsService] Iniciando processamento de "A Boa do Dia" multiliga com matemática sharp...');

    try {
      const now = new Date();
      const todayBrazilKey = this.getBrazilDateKey(now);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowBrazilKey = this.getBrazilDateKey(tomorrow);
      const MIN_MATCHES_FOR_TRIPLE = 3;
      let selectedDateKey = todayBrazilKey;
      let selectedDateRef = now;
      let isNextDayFallback = false;
      let fallbackMode = 'today';

      // 1. Busca as odds da Pinnacle (Sharp) via Rapid API ou Fallback local
      const pinnacleMatches = await pinnacleService.fetchPinnacleOdds();

      // 2. Busca todas as partidas ativas no banco de dados
      // Tolera até 5 min no passado para jogos iniciando agora
      const nowLimit = new Date(Date.now() - 5 * 60 * 1000);
      let matches = await MatchOdds.find({
        eventDate: { $gte: nowLimit },
        sportsbookA: { $ne: null },
        sportsbookB: { $ne: null }
      });

      const todayMatches = matches.filter((match) => {
        if (!match.eventDate) return false;
        return this.getBrazilDateKey(new Date(match.eventDate)) === todayBrazilKey;
      });

      if (todayMatches.length >= MIN_MATCHES_FOR_TRIPLE) {
        matches = todayMatches;
      } else {
        const futureByDate = new Map();
        for (const match of matches) {
          if (!match.eventDate) continue;
          const dateKey = this.getBrazilDateKey(new Date(match.eventDate));
          if (dateKey <= todayBrazilKey) continue;
          const list = futureByDate.get(dateKey) || [];
          list.push(match);
          futureByDate.set(dateKey, list);
        }

        // Janela progressiva: usa hoje + próximas datas até conseguir base mínima para tripla.
        const windowMatches = [...todayMatches];
        const sortedDates = [...futureByDate.keys()].sort();
        for (const dateKey of sortedDates) {
          if (windowMatches.length >= MIN_MATCHES_FOR_TRIPLE) break;
          const daily = futureByDate.get(dateKey) || [];
          windowMatches.push(...daily);
        }

        if (windowMatches.length > 0) {
          matches = windowMatches;
          const earliest = [...windowMatches].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
          selectedDateRef = new Date(earliest?.eventDate || tomorrow);
          selectedDateKey = this.getBrazilDateKey(selectedDateRef);
          isNextDayFallback = selectedDateKey === tomorrowBrazilKey;

          if (todayMatches.length > 0 && windowMatches.length >= MIN_MATCHES_FOR_TRIPLE) {
            fallbackMode = 'today+window';
          } else if (todayMatches.length === 0 && windowMatches.length >= MIN_MATCHES_FOR_TRIPLE) {
            fallbackMode = isNextDayFallback ? 'tomorrow+window' : 'next-available+window';
          } else if (todayMatches.length > 0) {
            fallbackMode = 'today';
          } else {
            fallbackMode = isNextDayFallback ? 'tomorrow' : 'next-available';
          }

          console.log(`[AnalyticsService] Janela de jogos selecionada para tripla: ${windowMatches.length} partidas (modo: ${fallbackMode}).`);
        } else {
          matches = [];
        }
      }

      if (matches.length === 0) {
        console.warn('[AnalyticsService] Nenhuma partida futura encontrada no banco de dados.');
        return {
          success: false,
          message: 'Nenhuma aposta segura disponível para os próximos dias. Aguarde a próxima atualização da API.',
          analyzedMatchesCount: 0,
          analyzedOutcomesCount: 0,
          isNextDayFallback: false,
          fallbackMode: 'none',
          referenceDate: todayBrazilKey,
          referenceDateLabel: this.getBrazilDateLabel(now)
        };
      }

      const allOutcomes = [];

      // 3. Transforma cada partida e seus mercados em candidatos analíticos individuais (Outcomes)
      for (const match of matches) {
        const oA = match.sportsbookA;
        const oB = match.sportsbookB;
        const nameA = oA?.bookmakerName || 'Casa A';
        const nameB = oB?.bookmakerName || 'Casa B';
        const eventDate = match.eventDate || match.lastUpdated || new Date();
        const leagueLabel = this.getLeagueLabel(match.league);

        // 3.1. Matchmaker Nativo (Levenshtein Distance)
        const pinMatch = pinnacleMatches.find(pin => {
          const homeSim = getSimilarityRatio(match.homeTeam, pin.homeTeam);
          const awaySim = getSimilarityRatio(match.awayTeam, pin.awayTeam);
          const swappedHomeSim = getSimilarityRatio(match.homeTeam, pin.awayTeam);
          const swappedAwaySim = getSimilarityRatio(match.awayTeam, pin.homeTeam);
          return (homeSim >= 0.75 && awaySim >= 0.75) || (swappedHomeSim >= 0.75 && swappedAwaySim >= 0.75);
        });

        let homeProb = 0;
        let drawProb = 0;
        let awayProb = 0;
        let hasSharpLines = false;

        if (pinMatch) {
          const { homeProb: hp, drawProb: dp, awayProb: ap } = removeVigAndGetTrueProbabilities(
            pinMatch.sharpOdds.homeOdds,
            pinMatch.sharpOdds.drawOdds,
            pinMatch.sharpOdds.awayOdds
          );
          homeProb = hp;
          drawProb = dp;
          awayProb = ap;
          hasSharpLines = true;
        }

        const getDCOdd = (o1, o2) => {
          if (!o1 || !o2) return 0;
          const rawDC = (o1 * o2) / (o1 + o2);
          return Number((rawDC * 0.95).toFixed(2));
        };

        const oddA_1X = getDCOdd(oA.homeOdds, oA.drawOdds);
        const oddB_1X = getDCOdd(oB.homeOdds, oB.drawOdds);
        const oddA_X2 = getDCOdd(oA.awayOdds, oA.drawOdds);
        const oddB_X2 = getDCOdd(oB.awayOdds, oB.drawOdds);

        // Mercados sintéticos para múltipla temática (resultado + gols/escanteios)
        // Observação: The Odds API consumida aqui fornece apenas 1X2 neste endpoint,
        // então os componentes de gols/escanteios são estimados para enriquecer a tripla.
        const OVER_15_EST = 1.22;
        const CORNERS_85_EST = 1.55;
        const COMBO_DISCOUNT_G15 = 0.92;
        const COMBO_DISCOUNT_C85 = 0.90;

        const comboOdd = (baseOdd, addonOdd, discount) => {
          if (!baseOdd || baseOdd <= 1.0) return 0;
          return Number((baseOdd * addonOdd * discount).toFixed(2));
        };

        const markets = [
          { selection: 'Vitória Casa (1)', oddA: oA.homeOdds, oddB: oB.homeOdds, type: 'H' },
          { selection: 'Empate (X)', oddA: oA.drawOdds, oddB: oB.drawOdds, type: 'D' },
          { selection: 'Vitória Fora (2)', oddA: oA.awayOdds, oddB: oB.awayOdds, type: 'A' },
          { selection: 'Dupla Chance: Casa ou Empate (1X)', oddA: oddA_1X, oddB: oddB_1X, type: 'HD' },
          { selection: 'Dupla Chance: Fora ou Empate (X2)', oddA: oddA_X2, oddB: oddB_X2, type: 'AD' },

          { selection: 'Vitória Casa (1) + Mais de 1.5 Gols', oddA: comboOdd(oA.homeOdds, OVER_15_EST, COMBO_DISCOUNT_G15), oddB: comboOdd(oB.homeOdds, OVER_15_EST, COMBO_DISCOUNT_G15), type: 'H_G15' },
          { selection: 'Empate (X) + Mais de 1.5 Gols', oddA: comboOdd(oA.drawOdds, OVER_15_EST, COMBO_DISCOUNT_G15), oddB: comboOdd(oB.drawOdds, OVER_15_EST, COMBO_DISCOUNT_G15), type: 'D_G15' },
          { selection: 'Vitória Fora (2) + Mais de 1.5 Gols', oddA: comboOdd(oA.awayOdds, OVER_15_EST, COMBO_DISCOUNT_G15), oddB: comboOdd(oB.awayOdds, OVER_15_EST, COMBO_DISCOUNT_G15), type: 'A_G15' },

          { selection: 'Vitória Casa (1) + Escanteios +8.5', oddA: comboOdd(oA.homeOdds, CORNERS_85_EST, COMBO_DISCOUNT_C85), oddB: comboOdd(oB.homeOdds, CORNERS_85_EST, COMBO_DISCOUNT_C85), type: 'H_C85' },
          { selection: 'Empate (X) + Escanteios +8.5', oddA: comboOdd(oA.drawOdds, CORNERS_85_EST, COMBO_DISCOUNT_C85), oddB: comboOdd(oB.drawOdds, CORNERS_85_EST, COMBO_DISCOUNT_C85), type: 'D_C85' },
          { selection: 'Vitória Fora (2) + Escanteios +8.5', oddA: comboOdd(oA.awayOdds, CORNERS_85_EST, COMBO_DISCOUNT_C85), oddB: comboOdd(oB.awayOdds, CORNERS_85_EST, COMBO_DISCOUNT_C85), type: 'A_C85' }
        ];

        for (const mkt of markets) {
          const chosenOdd = Math.max(mkt.oddA, mkt.oddB);
          const lowerOdd = Math.min(mkt.oddA, mkt.oddB);
          const bookmaker = mkt.oddA >= mkt.oddB ? nameA : nameB;

          if (chosenOdd > 1.0) {
            let winProb = 0;
            let evValue = 0;
            let evEdge = 0;

            if (hasSharpLines) {
              if (mkt.type === 'H') winProb = homeProb;
              else if (mkt.type === 'D') winProb = drawProb;
              else if (mkt.type === 'A') winProb = awayProb;
              else if (mkt.type === 'HD') winProb = homeProb + drawProb;
              else if (mkt.type === 'AD') winProb = awayProb + drawProb;
              else if (mkt.type === 'H_G15') winProb = homeProb * 0.82;
              else if (mkt.type === 'D_G15') winProb = drawProb * 0.82;
              else if (mkt.type === 'A_G15') winProb = awayProb * 0.82;
              else if (mkt.type === 'H_C85') winProb = homeProb * 0.68;
              else if (mkt.type === 'D_C85') winProb = drawProb * 0.68;
              else if (mkt.type === 'A_C85') winProb = awayProb * 0.68;

              evValue = winProb * chosenOdd;
              evEdge = evValue - 1.0;
            } else {
              const refOdd = lowerOdd > 1.0 ? lowerOdd : chosenOdd;
              winProb = 1 / refOdd;
              evValue = lowerOdd > 0 ? (chosenOdd / lowerOdd) : 1.0;
              evEdge = evValue - 1.0;
            }

            const valueScore = winProb * evValue * chosenOdd;
            const isComboMarket = mkt.type.endsWith('_G15') || mkt.type.endsWith('_C85');
            const weightedValueScore = isComboMarket ? valueScore * 1.03 : valueScore;

            allOutcomes.push({
              matchId: match._id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              confronto: `${match.homeTeam} vs ${match.awayTeam}`,
              eventDate: new Date(eventDate),
              league: match.league,
              leagueLabel: leagueLabel,
              type: mkt.type,
              selection: mkt.selection,
              odd: chosenOdd,
              bookmaker: bookmaker,
              oddA: mkt.oddA,
              oddB: mkt.oddB,
              ev: Number(evEdge.toFixed(4)),
              evValue: Number(evValue.toFixed(4)),
              isEvPlus: evValue >= 1.03,
              winProbabilityPercentage: Number((winProb * 100).toFixed(2)),
              valueScore: Number(weightedValueScore.toFixed(4)),
              hasSharpLines
            });
          }
        }
      }

      // Mapa de conflitos: dois tipos do mesmo jogo só são compatíveis se um é subconjunto do outro
      // Compatíveis: (H, HD), (H, AD não!), (A, AD), (D, HD), (D, AD)
      // Incompatíveis: quaisquer dois que não possam ocorrer juntos
      const compatiblePairs = new Set(['H|HD', 'HD|H', 'A|AD', 'AD|A', 'D|HD', 'HD|D', 'D|AD', 'AD|D']);
      const typesCompatible = (typeA, typeB) => {
        if (typeA === typeB) return false; // mesma seleção = sem valor
        return compatiblePairs.has(`${typeA}|${typeB}`);
      };

      // --- CÁLCULO 1: A BOA SEGURA (Segurança/Alta probabilidade com odd aceitável) ---
      const boaSeguraCandidates = allOutcomes.filter(o => o.odd >= 1.30 && o.odd <= 1.75);
      boaSeguraCandidates.sort((a, b) => b.winProbabilityPercentage - a.winProbabilityPercentage || b.ev - a.ev);
      const allSortedByProb = [...allOutcomes].sort((a,b) => b.winProbabilityPercentage - a.winProbabilityPercentage);
      const boaSegura = boaSeguraCandidates.length > 0 ? boaSeguraCandidates[0] : allSortedByProb[0];

      // --- CÁLCULO 2: APOSTA DE VALOR MÁXIMO (Maior EV+ ou discrepância) ---
      // Se vier do mesmo jogo da Boa Segura, exclui mercados contraditórios
      const isCompatibleWithBoaSegura = (o) => {
        if (!boaSegura) return true;
        if (o.matchId.toString() !== boaSegura.matchId.toString()) return true;
        return typesCompatible(boaSegura.type, o.type);
      };

      const sharpEvCandidates = allOutcomes.filter(o => o.hasSharpLines && o.isEvPlus && isCompatibleWithBoaSegura(o));
      sharpEvCandidates.sort((a, b) => b.ev - a.ev || b.winProbabilityPercentage - a.winProbabilityPercentage);

      let evMax;
      if (sharpEvCandidates.length > 0) {
        evMax = sharpEvCandidates[0];
        console.log(`[AnalyticsService] [EV+] Selecionada Aposta de Valor Sharp EV Max: ${evMax.confronto} (${evMax.selection}) com EV de +${(evMax.ev * 100).toFixed(2)}%`);
      } else {
        // Fallback para discrepâncias internas recreativas se não houver cobertura sharp
        const evCandidates = allOutcomes.filter(o => o.odd >= 1.30 && o.winProbabilityPercentage >= 40 && isCompatibleWithBoaSegura(o));
        evCandidates.sort((a, b) => b.ev - a.ev || b.winProbabilityPercentage - a.winProbabilityPercentage);
        const allSortedByEv = [...allOutcomes].filter(isCompatibleWithBoaSegura).sort((a,b) => b.ev - a.ev);
        evMax = evCandidates.length > 0 ? evCandidates[0] : (allSortedByEv[0] || null);
      }

      // --- CÁLCULO 3: O BILHETE MULTIPLICADOR (A Tripla de Ouro) ---
      // Monta uma múltipla real com jogos diferentes, buscando a melhor combinação global de 3 partidas.
      const valueScoreCandidates = [...allOutcomes];
      const isComboPreferred = (type) => type.endsWith('_G15') || type.endsWith('_C85');
      valueScoreCandidates.sort((a, b) => {
        const boostA = isComboPreferred(a.type) ? 1 : 0;
        const boostB = isComboPreferred(b.type) ? 1 : 0;
        if (boostB !== boostA) return boostB - boostA;
        return b.valueScore - a.valueScore || a.eventDate.getTime() - b.eventDate.getTime();
      });

      // 1) Melhor palpite por jogo (múltipla real: um pick por partida)
      const bestByMatch = new Map();
      for (const cand of valueScoreCandidates) {
        const matchKey = cand.matchId.toString();
        const current = bestByMatch.get(matchKey);
        if (!current || cand.valueScore > current.valueScore) {
          bestByMatch.set(matchKey, cand);
        }
      }

      const distinctMatchPicks = [...bestByMatch.values()].sort((a, b) => b.valueScore - a.valueScore);

      // 2) Busca combinatória da melhor tripla entre jogos distintos
      const searchPool = distinctMatchPicks.slice(0, 18);
      let bestTripla = null;
      let bestScore = -Infinity;

      for (let i = 0; i < searchPool.length; i++) {
        for (let j = i + 1; j < searchPool.length; j++) {
          for (let k = j + 1; k < searchPool.length; k++) {
            const trio = [searchPool[i], searchPool[j], searchPool[k]]
              .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

            const valueSum = trio[0].valueScore + trio[1].valueScore + trio[2].valueScore;
            const evSum = trio[0].ev + trio[1].ev + trio[2].ev;
            const combinedOdd = trio[0].odd * trio[1].odd * trio[2].odd;

            // Penaliza trios com partidas praticamente simultâneas para melhorar executabilidade
            let overlapPenalty = 0;
            for (let m = 1; m < trio.length; m++) {
              const dtMin = Math.abs(trio[m].eventDate.getTime() - trio[m - 1].eventDate.getTime()) / (60 * 1000);
              if (dtMin < 30) overlapPenalty += 0.12;
            }

            const score = valueSum + (evSum * 2.5) + (Math.log(combinedOdd) * 0.04) - overlapPenalty;
            if (score > bestScore) {
              bestScore = score;
              bestTripla = trio;
            }
          }
        }
      }

      const triplaSteps = bestTripla ? [...bestTripla] : [];

      // 3) Fallback: se não houver 3 jogos distintos suficientes, completa com melhores mercados restantes
      if (triplaSteps.length < 3) {
        const used = new Set(triplaSteps.map(s => `${s.matchId}_${s.type}`));
        for (const cand of valueScoreCandidates) {
          if (triplaSteps.length >= 3) break;
          const key = `${cand.matchId}_${cand.type}`;
          if (used.has(key)) continue;
          triplaSteps.push(cand);
          used.add(key);
        }
      }

      // Ordena o bilhete final de forma cronológica para a jornada do usuário
      triplaSteps.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

      // Cálculos cumulativos da múltipla
      const combinedOdds = Number(triplaSteps.reduce((acc, curr) => acc * curr.odd, 1).toFixed(2));
      const projectedReturn = Number((defaultStake * combinedOdds).toFixed(2));
      const projectedProfit = Number((projectedReturn - defaultStake).toFixed(2));

      // Média da probabilidade composta do bilhete (Win probability composta = produto das probabilidades individuais)
      const compoundProbability = Number((triplaSteps.reduce((acc, curr) => acc * (curr.winProbabilityPercentage / 100), 1) * 100).toFixed(2));

      const triplaDeOuro = {
        stake: defaultStake,
        combinedOdds: combinedOdds,
        retornoProjetado: projectedReturn,
        lucroProjetado: projectedProfit,
        probabilidadeComposta: compoundProbability,
        items: triplaSteps.map((step, idx) => ({
          ordem: idx + 1,
          matchId: step.matchId,
          confronto: step.confronto,
          eventDate: step.eventDate,
          leagueLabel: step.leagueLabel,
          selection: step.selection,
          odd: step.odd,
          bookmaker: step.bookmaker,
          winProbabilityPercentage: step.winProbabilityPercentage
        }))
      };

      return {
        success: true,
        isNextDayFallback,
        fallbackMode,
        referenceDate: selectedDateKey,
        referenceDateLabel: this.getBrazilDateLabel(selectedDateRef),
        analyzedMatchesCount: matches.length,
        analyzedOutcomesCount: allOutcomes.length,
        boaSegura,
        evMax,
        triplaDeOuro
      };
    } catch (error) {
      console.error('[AnalyticsService] Erro ao calcular A Boa do Dia:', error.message);
      return {
        success: false,
        message: 'Erro interno ao realizar os cálculos matemáticos da Boa do Dia.'
      };
    }
  }

  /**
   * Converte a chave da liga em um nome amigável.
   */
  getLeagueLabel(leagueKey) {
    switch (leagueKey) {
      case 'brazil-serie-a':
        return 'Campeonato Brasileiro (Série A)';
      case 'brazil-serie-b':
        return 'Campeonato Brasileiro (Série B)';
      case 'premier-league':
        return 'Premier League';
      case 'la-liga':
        return 'La Liga';
      case 'fifa-world-cup':
        return 'Copa do Mundo FIFA';
      case 'copa-libertadores':
        return 'Copa Libertadores';
      case 'copa-sudamericana':
        return 'Copa Sudamericana';
      case 'soccer_uefa_champions_league':
      case 'uefa-champions-league':
        return 'UEFA Champions League';
      default:
        return leagueKey || 'Liga Internacional';
    }
  }
}

export default new AnalyticsService();
