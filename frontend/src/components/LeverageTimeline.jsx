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
  Trophy,
  Check,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.64:3000').replace(/\/$/, '');

export default function LeverageTimeline() {
  const [initialStake, setInitialStake] = useState(10);
  const [steps, setSteps] = useState(3);
  const [league, setLeague] = useState('brazil-serie-a');
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Estados para o Simulador Interativo de Green
  const [completedSteps, setCompletedSteps] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
        // Reseta o simulador sempre que gera um novo pipeline
        setCompletedSteps({});
      } else {
        throw new Error(json.message || 'Falha ao calcular o pipeline de alavancagem.');
      }
    } catch (err) {
      console.error('[LeverageTimeline] Erro ao buscar pipeline:', err.message);
      setError('Não foi possível conectar ao servidor Express para calcular a alavancagem.');
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    fetchPipeline(initialStake, steps, league, false);
  }, [league]);

  const formatDateTime = useDateTimeFormatter();

  const handleGenerate = (e) => {
    if (e) e.preventDefault();
    fetchPipeline(initialStake, steps, league, true);
  };

  const handlePresetClick = (val) => {
    setInitialStake(val);
    fetchPipeline(val, steps, league, true);
    showToast(`Banca definida para R$ ${val.toFixed(2)}`, 'info');
  };

  // Lógica do Simulador Interativo
  const handleStepToggle = (stepNum) => {
    setCompletedSteps(prev => {
      const next = { ...prev };
      if (next[stepNum]) {
        // Se desmarcar, remove esta e todas as pernas posteriores
        for (let i = stepNum; i <= pipeline.length; i++) {
          delete next[i];
        }
        showToast(`Passo ${stepNum} desmarcado.`, 'info');
      } else {
        // Se marcar, garante que todas as pernas anteriores estejam marcadas
        for (let i = 1; i <= stepNum; i++) {
          next[i] = true;
        }
        if (stepNum === pipeline.length) {
          showToast(`🏆 Alavancagem de ${steps} passos concluída com sucesso!`, 'success');
        } else {
          showToast(`Passo ${stepNum} marcado como Green! Passo ${stepNum + 1} desbloqueado.`, 'success');
        }
      }
      return next;
    });
  };

  const handleResetSimulation = () => {
    setCompletedSteps({});
    showToast('Simulação resetada.', 'info');
  };

  // Estatísticas calculadas
  const totalProfit = pipeline.length > 0
    ? pipeline[pipeline.length - 1].retorno - initialStake
    : 0;

  const totalRoi = initialStake > 0
    ? (totalProfit / initialStake) * 100
    : 0;

  const overallGreenProbability = pipeline.length > 0
    ? pipeline.reduce((acc, step) => acc * ((step.winProbabilityPercentage || 0) / 100), 1) * 100
    : 0;

  const allCompleted = pipeline.length > 0 && Object.keys(completedSteps).length === pipeline.length;

  return (
    <div className="space-y-6 reveal-enter relative">
      
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md animate-bounce bg-slate-900/90 text-white">
          {toast.type === 'success' ? (
            <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
              <Check className="h-3 w-3 stroke-[3]" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400">
              <Info className="h-3 w-3" />
            </div>
          )}
          <span className="text-xs font-bold uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      {/* Control Panel */}
      <section className="premium-panel p-6 md:p-8">
        <form onSubmit={handleGenerate} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            
            {/* Liga / Campeonato */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                Campeonato / Liga
              </label>
              <select
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/80 border border-white/10 rounded-2xl text-slate-100 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-sm shadow-inner cursor-pointer"
              >
                <option value="brazil-serie-a">🇧🇷 Campeonato Brasileiro (Série A)</option>
                <option value="premier-league">🏴 Premier League</option>
                <option value="la-liga">🇪🇸 La Liga</option>
                <option value="copa-libertadores">🏆 Copa Libertadores</option>
                <option value="copa-sudamericana">🥈 Copa Sudamericana</option>
                <option value="fifa-world-cup">🌍 Copa do Mundo FIFA 2026</option>
              </select>
            </div>

            {/* Banca / Aposta Inicial */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-400" />
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
                  className="w-full pl-12 pr-4 py-3 bg-slate-950/80 border border-white/10 rounded-2xl text-slate-100 font-bold tracking-wide placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-sm shadow-inner"
                />
              </div>
            </div>

            {/* Níveis de Alavancagem */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-cyan-400" />
                Passos de Alavancagem (Nível)
              </label>
              <select
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-950/80 border border-white/10 rounded-2xl text-slate-100 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-sm shadow-inner cursor-pointer"
              >
                <option value="2">Nível 2 (2 Jogos)</option>
                <option value="3">Nível 3 (3 Jogos) - Recomendado</option>
                <option value="4">Nível 4 (4 Jogos)</option>
                <option value="5">Nível 5 (5 Jogos)</option>
              </select>
            </div>

          </div>

          {/* Quick presets & action button */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-2">Presets Rápidos:</span>
              {[10, 50, 100, 500, 1000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handlePresetClick(val)}
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-black font-mono transition-all cursor-pointer ${
                    initialStake === val
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-inner'
                      : 'border-white/5 bg-slate-950/30 text-slate-400 hover:text-slate-200 hover:bg-slate-950/55'
                  }`}
                >
                  R$ {val}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || isGenerating}
              className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black uppercase text-xs rounded-2xl shadow-xl shadow-amber-500/5 hover:shadow-amber-500/15 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Calcular Alavancagem
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="reveal-enter rounded-2xl border border-red-300/10 bg-red-400/5 p-5 text-red-200 shadow-xl flex items-start gap-4">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display font-bold text-sm">Falha no Processamento</h4>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <section className="premium-panel py-20 text-center flex flex-col items-center justify-center">
          <div className="h-14 w-14 rounded-full border border-amber-400/20 bg-amber-400/5 flex items-center justify-center shadow-lg">
            <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
          </div>
          <p className="mt-5 text-xs uppercase font-extrabold tracking-[0.2em] text-slate-400">Construindo pipeline sequencial de apostas...</p>
        </section>
      ) : pipeline.length === 0 ? (
        <section className="premium-panel py-16 text-center flex flex-col items-center justify-center">
          <div className="h-14 w-14 rounded-full border border-white/5 bg-slate-950/40 flex items-center justify-center mb-4">
            <Hourglass className="h-6 w-6 text-slate-600" />
          </div>
          <h3 className="font-display text-xl font-black text-slate-200">Sem odds qualificadas na grade</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-400 font-semibold leading-relaxed">
            Nenhuma partida da liga selecionada atendeu aos critérios de alavancagem no momento (odds entre <strong>1.45 e 1.55</strong>). Tente outra liga ou aguarde novos jogos serem adicionados pela API.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Stepper Roadmap Vertical */}
          <section className="lg:col-span-2 space-y-6 relative pl-6 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-800">
            {pipeline.map((step, index) => {
              const stepNum = step.step;
              const isLocked = index > 0 && !completedSteps[index]; // O passo anterior precisa estar concluído
              const isCompleted = completedSteps[stepNum];
              const isActive = !isLocked && !isCompleted;

              // Estilos visuais dinâmicos
              let cardStyle = "border-white/5 bg-slate-950/20 opacity-40 scale-[0.98]";
              let dotStyle = "bg-slate-950 border-slate-700 text-slate-500";

              if (isCompleted) {
                cardStyle = "premium-panel-glow-emerald border-emerald-500/20 shadow-emerald-500/5";
                dotStyle = "bg-emerald-500 border-emerald-400 text-slate-950";
              } else if (isActive) {
                cardStyle = "premium-panel-glow-cyan border-cyan-500/20 shadow-cyan-500/5 scale-100 ring-1 ring-cyan-500/20";
                dotStyle = "bg-cyan-500 border-cyan-400 text-slate-950 animate-pulse-slow";
              }

              return (
                <div
                  key={step.step}
                  className="relative flex flex-col gap-3 transition-all duration-300"
                >
                  {/* Stepper Dot */}
                  <button
                    disabled={isLocked}
                    onClick={() => handleStepToggle(stepNum)}
                    className={`absolute -left-[36px] top-2.5 h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs font-black font-mono shadow-md z-10 cursor-pointer transition-all ${dotStyle}`}
                  >
                    {isCompleted ? <Check className="h-3 w-3 stroke-[3.5]" /> : stepNum}
                  </button>

                  <article className={`premium-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden transition-all duration-300 ${cardStyle}`}>
                    
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                          isCompleted
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : isActive
                              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                              : 'border-white/5 bg-white/5 text-slate-500'
                        }`}>
                          Passo #{stepNum}
                        </span>
                        
                        <span className="font-mono text-[9px] font-bold text-slate-400 bg-slate-900/50 border border-white/5 px-2 py-0.5 rounded">
                          {formatDateTime(step.eventDate)}
                        </span>
                        
                        <span className="text-[9px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                          EV: +{(step.ev * 100).toFixed(1)}%
                        </span>
                        
                        {step.winProbabilityPercentage && (
                          <span className="text-[9px] font-black uppercase bg-slate-900/50 border border-white/10 px-2 py-0.5 rounded text-indigo-300">
                            {step.winProbabilityPercentage}% GREEN CHANCE
                          </span>
                        )}
                      </div>

                      <h4 className="font-display text-lg font-bold tracking-tight text-white flex items-center gap-2">
                        {step.confronto}
                      </h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-[10px] font-bold uppercase">PALPITE:</span>
                          <span className="text-amber-400 font-extrabold bg-amber-400/5 border border-amber-400/25 px-2 py-0.5 rounded-lg shadow-sm">
                            {step.selection}
                          </span>
                        </div>
                        <span className="text-slate-700">•</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-[10px] font-bold uppercase">BOOKMAKER:</span>
                          <span className="text-cyan-400 font-black uppercase text-[10px] tracking-wider">
                            {step.bookmaker}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Step values and interactive Toggle */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 min-w-[200px] border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-5">
                      <div className="text-left md:text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Montante da Aposta</p>
                        <p className="font-mono text-sm font-black text-slate-200">
                          R$ {step.stake.toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-400 mt-0.5">
                          Retorno: R$ {step.retorno.toFixed(2)}
                        </p>
                      </div>

                      {/* Interactive simulator toggle button */}
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleStepToggle(stepNum)}
                        className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                          isCompleted
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : isLocked
                              ? 'border-white/5 bg-slate-950/40 text-slate-600 opacity-50 cursor-not-allowed'
                              : 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Simulado (Green)
                          </>
                        ) : isLocked ? (
                          <>
                            <Lock className="h-3 w-3" />
                            Bloqueado
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-3.5 w-3.5" />
                            Simular Green
                          </>
                        )}
                      </button>
                    </div>

                  </article>
                </div>
              );
            })}
          </section>

          {/* Side Panel stats & simulation summary */}
          <section className="space-y-6">

            {/* Congrats Card if all completed */}
            {allCompleted && (
              <article className="premium-panel-glow-gold p-6 text-center space-y-4 animate-bounce relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />
                <div className="mx-auto h-12 w-12 rounded-full bg-amber-400/20 border border-amber-400 flex items-center justify-center text-amber-300">
                  <Trophy className="h-6 w-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">Alavancagem Sucesso!</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">Todas as pernas do plano foram simuladas com vitória (Green).</p>
                </div>
                
                <div className="bg-black/30 border border-white/5 p-4 rounded-2xl text-left space-y-2 font-semibold">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Investimento Inicial:</span>
                    <span className="font-mono text-slate-200">R$ {initialStake.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Capital Acumulado:</span>
                    <span className="font-mono text-emerald-400">R$ {pipeline[pipeline.length - 1].retorno.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Lucro Bruto:</span>
                    <span className="font-mono text-emerald-400">+R$ {totalProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">ROI Final Estimado:</span>
                    <span className="font-mono text-amber-400">+{totalRoi.toFixed(0)}% ROI</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleResetSimulation}
                    className="flex-1 py-3 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-200 cursor-pointer transition-all"
                  >
                    Resetar
                  </button>
                  <button
                    onClick={() => {
                      showToast('Plano salvo localmente.', 'success');
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black uppercase text-xs rounded-xl shadow-lg cursor-pointer transition-all"
                  >
                    Salvar Meta
                  </button>
                </div>
              </article>
            )}

            {/* General ROI Dashboard Panel */}
            <article className="premium-panel p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <h3 className="font-display text-lg font-bold text-slate-100 flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
                <TrendingUp className="h-4.5 w-4.5 text-amber-400" />
                Matemática da Alavancagem
              </h3>

              <div className="space-y-4.5 border-b border-white/5 pb-5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Investimento Inicial:</span>
                  <span className="font-mono text-slate-200 font-bold">R$ {initialStake.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Nível (Passos):</span>
                  <span className="font-mono text-slate-200 font-bold">{pipeline.length} steps</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Odds Limites:</span>
                  <span className="text-cyan-400 font-bold font-mono">1.45 - 1.55</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Retorno Máximo Projetado:</span>
                  <span className="font-mono text-emerald-400 font-extrabold text-sm">
                    R$ {pipeline[pipeline.length - 1].retorno.toFixed(2)}
                  </span>
                </div>

                {/* Compound win probability */}
                <div className="flex flex-col p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl gap-2 mt-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Acerto Composto</p>
                      <p className="text-[8px] font-semibold text-slate-500">Probabilidade geral de green em todos os passos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xl font-black text-emerald-400">
                        {overallGreenProbability.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${overallGreenProbability}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Accum profit and initiation */}
              <div className="pt-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lucro Líquido Esperado</p>
                    <p className="text-[8px] font-semibold text-slate-500">Ao final do plano</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl font-black text-emerald-400">R$ {totalProfit.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">+{totalRoi.toFixed(0)}% ROI</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    showToast('Plano de alavancagem iniciado! Acompanhe as partidas.', 'success');
                  }}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black uppercase text-xs rounded-2xl shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="h-4.5 w-4.5" />
                  Iniciar Alavancagem Real
                </button>
              </div>
            </article>

            {/* Simulated progress tracker */}
            {Object.keys(completedSteps).length > 0 && !allCompleted && (
              <article className="premium-panel p-5 border border-cyan-500/10 bg-slate-950/40 text-xs space-y-3">
                <h5 className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  Progresso da Simulação
                </h5>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Passos Concluídos:</span>
                    <span>{Object.keys(completedSteps).length} de {pipeline.length}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Banca Atual:</span>
                    <span className="font-mono text-emerald-400">
                      R$ {pipeline[Object.keys(completedSteps).length - 1]?.retorno.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Próximo Retorno:</span>
                    <span className="font-mono text-slate-300">
                      R$ {pipeline[Object.keys(completedSteps).length]?.retorno.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleResetSimulation}
                  className="w-full py-2 bg-slate-900 border border-white/5 hover:border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 cursor-pointer hover:text-slate-200 transition-all"
                >
                  Resetar Simulador
                </button>
              </article>
            )}

            {/* Informational help card */}
            <article className="premium-panel p-5 text-xs font-semibold text-slate-400 space-y-3 bg-slate-950/20">
              <h5 className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-cyan-400" />
                Como funciona a Estratégia?
              </h5>
              <p className="leading-relaxed text-[11px] font-medium text-slate-400">
                A estratégia de **Soros** busca acumular lucros reinvestindo o valor inicial + lucros obtidos nas apostas anteriores.
              </p>
              <ul className="list-disc pl-4 space-y-2 text-[10px] font-semibold text-slate-500">
                <li>Priorizamos odds seguras de <span className="text-slate-300">1.45 a 1.55</span> com alta assertividade.</li>
                <li>Mantemos intervalo cronológico de <span className="text-slate-300">150 minutos</span> entre pernas para liquidação.</li>
                <li>A vantagem de valor (EV+) nos protege contra flutuações das bookmakers.</li>
                <li><span className="text-rose-400 font-extrabold uppercase">Aviso</span>: Se qualquer passo falhar, o ciclo é quebrado. Jogue sempre com responsabilidade.</li>
              </ul>
            </article>

          </section>

        </div>
      )}

    </div>
  );
}
