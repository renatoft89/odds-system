import React, { useState, useEffect } from 'react';
import { useDateTimeFormatter } from '../hooks/useDateTimeFormatter';
import {
  Calculator,
  Coins,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  Hourglass,
  Award,
  TrendingUp,
  ShieldCheck,
  PlayCircle,
  HelpCircle,
  Target,
  Trophy
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.64:3000').replace(/\/$/, '');

export default function LeverageTimeline() {
  const [initialStake, setInitialStake] = useState(10); // Padrão R$ 100
  const [steps, setSteps] = useState(3); // Padrão 3 passos
  const [league, setLeague] = useState('brazil-serie-a'); // Liga padrão com dados reais ativos
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Faz o fetch do pipeline Soros a partir do backend
  const fetchPipeline = async (stake = initialStake, numSteps = steps, selectedLeague = league, showState = false) => {
    if (showState) setIsGenerating(true);
    else setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/leverage/pipeline?initialStake=${stake}&steps=${numSteps}&league=${selectedLeague}`
      );
      if (!response.ok) {
        throw new Error('Falha na resposta do servidor.');
      }
      const json = await response.json();
      if (json.success) {
        setPipeline(json.data || []);
        setError(null);
      } else {
        throw new Error(json.message || 'Falha ao calcular o pipeline de Soros.');
      }
    } catch (err) {
      console.error('[LeverageTimeline] Erro ao buscar pipeline:', err.message);
      setError('Não foi possível conectar ao servidor Express para calcular a alavancagem.');
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  // Carrega na montagem e sempre que a liga for alterada (Reativo!)
  useEffect(() => {
    fetchPipeline(initialStake, steps, league, false);
  }, [league]);

  // Formata o horário em PT-BR usando o hook nativo de Timezone São Paulo
  const formatDateTime = useDateTimeFormatter();

  // Manipulações de clique nos controles
  const handleGenerate = (e) => {
    e.preventDefault();
    fetchPipeline(initialStake, steps, league, true);
  };

  // Estatísticas do Soros
  const totalProfit = pipeline.length > 0
    ? pipeline[pipeline.length - 1].retorno - initialStake
    : 0;

  const totalRoi = initialStake > 0
    ? (totalProfit / initialStake) * 100
    : 0;

  const overallGreenProbability = pipeline.length > 0
    ? pipeline.reduce((acc, step) => acc * ((step.winProbabilityPercentage || 0) / 100), 1) * 100
    : 0;

  return (
    <div className="space-y-8 reveal-enter">

      {/* Bloco de Controles e Configurações */}
      <section className="glass-panel p-6 md:p-8 rounded-3xl border border-white/10 bg-slate-900/60 shadow-xl">
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">

          {/* Seleção de Campeonato / Liga */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-emerald-300" />
              Campeonato / Liga
            </label>
            <select
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-slate-100 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-yellow-300/50 text-sm shadow-inner cursor-pointer"
            >
              <option value="brazil-serie-a">🇧🇷 Campeonato Brasileiro (Série A)</option>
              <option value="premier-league">🏴 Premier League</option>
              <option value="la-liga">🇪🇸 La Liga</option>
              <option value="copa-libertadores">🏆 Copa Libertadores</option>
              <option value="copa-sudamericana">🥈 Copa Sudamericana</option>
              <option value="fifa-world-cup">🌍 Copa do Mundo FIFA 2026</option>
            </select>
          </div>

          {/* Banca Inicial */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-yellow-300" />
              Aposta Inicial (Banca)
            </label>
            <div className="relative rounded-2xl shadow-inner">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 font-bold font-mono text-sm">
                R$
              </div>
              <input
                type="number"
                min="10"
                max="100000"
                value={initialStake}
                onChange={(e) => setInitialStake(Math.max(1, Number(e.target.value)))}
                className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-slate-100 font-bold tracking-wide placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-300/50 focus:border-yellow-300/40 text-sm shadow-inner"
              />
            </div>
          </div>

          {/* Passos de Soros */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-cyan-300" />
              Passos de Soros (Nível)
            </label>
            <select
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-slate-100 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-yellow-300/50 text-sm shadow-inner cursor-pointer"
            >
              <option value="2">Nível 2 (2 Jogos)</option>
              <option value="3">Nível 3 (3 Jogos) - Recomendado</option>
              <option value="4">Nível 4 (4 Jogos)</option>
              <option value="5">Nível 5 (5 Jogos)</option>
            </select>
          </div>

          {/* Botão de Disparo */}
          <button
            type="submit"
            disabled={loading || isGenerating}
            className="w-full py-3.5 bg-gradient-to-r from-yellow-300 via-emerald-400 to-cyan-400 hover:from-yellow-400 hover:to-cyan-500 text-slate-950 font-black uppercase text-sm rounded-2xl shadow-xl shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 h-[48px]"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
            ) : (
              <PlayCircle className="h-4.5 w-4.5 text-slate-950" />
            )}
            Gerar Pipeline de Soros
          </button>

        </form>
      </section>

      {error && (
        <div className="reveal-enter rounded-3xl border border-red-300/30 bg-red-400/10 p-6 text-red-100 shadow-2xl">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-300" />
            <div>
              <h4 className="font-display text-lg font-bold">Falha no Processamento</h4>
              <p className="mt-1 text-sm text-red-100/80 leading-relaxed font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <section className="glass-panel py-24 text-center rounded-3xl border border-white/10 shadow-2xl bg-slate-900/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-yellow-300/30 bg-yellow-300/10 shadow-lg">
            <RefreshCw className="h-6 w-6 animate-spin text-yellow-200" />
          </div>
          <p className="mt-6 text-xs uppercase font-bold tracking-[0.2em] text-slate-300">Construindo sequência temporal EV+...</p>
        </section>
      ) : pipeline.length === 0 ? (
        <section className="glass-panel py-20 text-center rounded-3xl border border-white/10 shadow-2xl bg-slate-900/15">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Hourglass className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mt-5 font-display text-2xl font-bold text-slate-100">Sem odds qualificadas na grade</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400 font-semibold leading-relaxed">
            Nenhuma partida da liga selecionada atendeu aos critérios de Soros no momento (odds entre <strong>1.45 e 1.55</strong>). Tente outra liga ou aguarde novos jogos serem adicionados pela API.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Stepper Roadmap Vertical */}
          <section className="lg:col-span-2 space-y-8 relative pl-6 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-[3px] before:bg-gradient-to-b before:from-yellow-400/60 before:via-emerald-400/40 before:to-slate-800">
            {pipeline.map((step, index) => {
              // Os passos futuros têm opacidade reduzida para indicar dependência do sucesso do anterior
              const isFuture = index > 0;
              const opacityClass = isFuture ? 'opacity-55 scale-[0.98] hover:opacity-85' : 'border-yellow-400/30 bg-slate-900/80 shadow-yellow-500/5';
              const dotClass = isFuture
                ? 'bg-slate-950 border-slate-700 text-slate-400'
                : 'bg-gradient-to-r from-yellow-300 to-emerald-400 border-yellow-300 text-slate-950 animate-pulse';

              const isBetano = step.bookmaker === 'Betano';
              const bookmakerBadgeClass = 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300';

              return (
                <div
                  key={step.step}
                  className={`relative flex flex-col gap-4 transition-all duration-300 ${opacityClass}`}
                >
                  {/* Marcador Numérico do Stepper */}
                  <div className={`absolute -left-[37px] top-1.5 h-6.5 w-6.5 rounded-full border-2 flex items-center justify-center text-xs font-black font-mono shadow-md z-10 ${dotClass}`}>
                    {step.step}
                  </div>

                  <article className="glass-panel p-5 md:p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden shadow-xl bg-slate-950/20 backdrop-blur-sm">
                    {isFuture && (
                      <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-slate-700 bg-slate-800/40 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <Hourglass className="h-3 w-3 text-slate-400" />
                        Bloqueado (Passo anterior requerido)
                      </div>
                    )}

                    <div className="space-y-3.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md">
                          Passo #{step.step}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-400 bg-black/30 border border-white/5 px-2 py-0.5 rounded-md">
                          {formatDateTime(step.eventDate)}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          EV+: +{(step.ev * 100).toFixed(2)}%
                        </span>
                        {step.winProbabilityPercentage && (
                          <span className={`text-[10px] font-black uppercase tracking-wider border px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm transition-all duration-300 hover:scale-105 ${
                            step.winProbabilityPercentage >= 70
                              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 shadow-emerald-500/5'
                              : step.winProbabilityPercentage >= 50
                              ? 'bg-yellow-500/15 border-yellow-500/35 text-yellow-300 shadow-yellow-500/5'
                              : 'bg-orange-500/15 border-orange-500/35 text-orange-300 shadow-orange-500/5'
                          }`}>
                            <Target className="h-3.5 w-3.5 animate-pulse" />
                            {step.winProbabilityPercentage}% Chance de Green
                          </span>
                        )}
                      </div>

                      <h4 className="font-display text-xl font-bold tracking-tight text-white group-hover:text-yellow-200 transition-colors">
                        {step.confronto}
                      </h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">Palpite:</span>
                          <span className="text-yellow-300 font-black bg-yellow-300/10 border border-yellow-300/20 px-2.5 py-0.5 rounded-lg shadow-sm">
                            {step.selection}
                          </span>
                        </div>
                        <span className="text-slate-500">•</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">Casa com melhor odd:</span>
                          <span className={`text-[10px] font-black uppercase tracking-[0.14em] border px-2.5 py-1 rounded-xl shadow-inner ${bookmakerBadgeClass}`}>
                            {step.bookmaker}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito do Card (Valores e Odds Comparativas Lado a Lado) */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-5 md:border-l md:border-white/10 md:pl-6 min-w-[280px] justify-between md:justify-end">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] uppercase font-bold tracking-[0.16em] text-slate-500">Valor Entrada</p>
                        <p className="font-mono text-base font-black text-slate-200">R$ {step.stake.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-emerald-400 mt-0.5">Retorno: R$ {step.retorno.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Box Casa A */}
                        <div className={`flex flex-col items-center justify-center rounded-2xl border px-3.5 py-2.5 shadow-lg min-w-[75px] transition-all duration-300 ${
                          step.bookmaker && step.oddA && step.oddA >= step.oddB
                            ? 'border-orange-500/50 bg-orange-500/15 text-orange-200 ring-2 ring-orange-500/20 shadow-orange-500/5 scale-105'
                            : 'border-white/5 bg-black/30 text-slate-500 opacity-50'
                        }`}>
                          <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">
                            {step.bookmaker && step.oddA >= (step.oddB || 0) ? step.bookmaker : 'Casa A'}
                          </span>
                          <span className="font-display text-lg font-black leading-none mt-1.5 tracking-tight">
                            {step.oddA ? step.oddA.toFixed(2) : '-'}
                          </span>
                        </div>

                        {/* Box Casa B */}
                        <div className={`flex flex-col items-center justify-center rounded-2xl border px-3.5 py-2.5 shadow-lg min-w-[75px] transition-all duration-300 ${
                          step.bookmaker && step.oddB && step.oddB > (step.oddA || 0)
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 ring-2 ring-emerald-500/20 shadow-emerald-500/5 scale-105'
                            : 'border-white/5 bg-black/30 text-slate-500 opacity-50'
                        }`}>
                          <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">
                            {step.bookmaker && step.oddB > (step.oddA || 0) ? step.bookmaker : 'Casa B'}
                          </span>
                          <span className="font-display text-lg font-black leading-none mt-1.5 tracking-tight">
                            {step.oddB ? step.oddB.toFixed(2) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                  </article>
                </div>
              );
            })}
          </section>

          {/* Painel Resumo e ROI Acumulado */}
          <section className="space-y-6">

            {/* Bloco Resumo de Pipeline */}
            <article className="glass-panel p-6 rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <h3 className="font-display text-xl font-bold text-slate-100 flex items-center gap-2 mb-6">
                <TrendingUp className="h-5 w-5 text-yellow-300" />
                Resumo da Alavancagem
              </h3>

              <div className="space-y-4 border-b border-white/5 pb-6">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-400">Investimento Inicial:</span>
                  <span className="font-mono text-slate-100 font-bold">R$ {initialStake.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-400">Total de Passos (Nível):</span>
                  <span className="font-mono text-slate-100 font-bold">{pipeline.length} níveis</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-400">Filtro de Odds Alvo:</span>
                  <span className="text-cyan-300 font-bold font-mono">1.45 - 1.55</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-400">Retorno Final Projetado:</span>
                  <span className="font-mono text-emerald-300 font-bold text-base">
                    R$ {pipeline[pipeline.length - 1].retorno.toFixed(2)}
                  </span>
                </div>

                {/* Chance Geral de Green Acumulada */}
                <div className="flex flex-col p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl gap-2 mt-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">Chance Geral de Green</p>
                      <p className="text-[9px] font-semibold text-slate-500 mt-0.5">Probabilidade composta de acerto do plano</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-black text-emerald-400">
                        {overallGreenProbability.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  {/* Barra de Progresso Visual */}
                  <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${overallGreenProbability}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Lucro e ROI */}
              <div className="pt-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lucro Líquido Acumulado</p>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Se todos os passos vencerem</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-3xl font-black text-emerald-300">R$ {totalProfit.toFixed(2)}</p>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5">+{totalRoi.toFixed(2)}% ROI</p>
                  </div>
                </div>

                <button
                  onClick={() => alert('Operação de Soros registrada no feed com sucesso!')}
                  className="w-full mt-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black uppercase text-sm rounded-2xl shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="h-4.5 w-4.5" />
                  Iniciar Plano de Soros
                </button>
              </div>
            </article>

            {/* Banner Educativo Soros */}
            <article className="glass-panel p-5 rounded-3xl border border-white/5 bg-slate-950/40 text-xs font-medium text-slate-400 space-y-3">
              <h5 className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-cyan-300" />
                Como funciona a Estratégia?
              </h5>
              <p className="leading-relaxed">
                A estratégia de **Soros** visa multiplicar lucros reinvestindo o retorno do passo anterior de forma composta.
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-500">
                <li>Odd alvo de <span className="text-slate-300">1.50</span> dobra o capital a cada dois passos.</li>
                <li>O intervalo de <span className="text-slate-300">150 min</span> garante tempo para liquidar e reinvestir.</li>
                <li>EV+ prioriza as odds de maior prêmio contra a média.</li>
                <li><span className="text-rose-400">Atenção</span>: Uma única derrota zera a alavancagem. Jogue com responsabilidade.</li>
              </ul>
            </article>

          </section>

        </div>
      )}

    </div>
  );
}
