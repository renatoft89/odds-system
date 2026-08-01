import React, { useState, useEffect } from 'react';
import { useDateTimeFormatter } from '../hooks/useDateTimeFormatter';
import {
  Sparkles,
  TrendingUp,
  Target,
  Trophy,
  RefreshCw,
  AlertCircle,
  Coins,
  Copy,
  CheckCircle2,
  Calendar,
  Zap,
  Info,
  Sliders,
  Check
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.64:3000').replace(/\/$/, '');

export default function BoaDoDia() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [stake, setStake] = useState(10);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBoaDoDia = async (targetStake = stake, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/leverage/boa-do-dia?stake=${targetStake}`);
      if (!response.ok) {
        throw new Error('Falha ao conectar com o servidor analítico.');
      }
      const json = await response.json();
      const isNoOpportunitiesWindow =
        json &&
        json.success === false &&
        typeof json.message === 'string' &&
        (
          json.message.toLowerCase().includes('nenhuma aposta segura disponível para hoje') ||
          json.message.toLowerCase().includes('nenhuma aposta segura disponível para hoje nem para amanhã') ||
          json.message.toLowerCase().includes('nenhuma aposta segura disponível para os próximos dias')
        );

      if (json.success) {
        setData(json);
        setError(null);
      } else if (isNoOpportunitiesWindow) {
        setData(json);
        setError(null);
      } else {
        throw new Error(json.message || 'Falha ao processar A Boa do Dia.');
      }
    } catch (err) {
      console.error('[BoaDoDia] Erro ao buscar palpites:', err.message);
      setData(null);
      setError('Não foi possível carregar os cálculos analíticos de "A Boa do Dia". Verifique a conexão com o servidor.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoaDoDia(stake);
  }, []);

  const formatDateTime = useDateTimeFormatter();
  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date());

  const fallbackMode = data?.fallbackMode;

  const handleCopyTicket = () => {
    if (!data || !data.triplaDeOuro) return;
    
    // Calcula os valores atuais com base na stake do Slider (calculada no cliente)
    const combinedOdds = data.triplaDeOuro.combinedOdds;
    const currentRetorno = stake * combinedOdds;
    
    const itemsText = data.triplaDeOuro.items
      .map(item => `- [${item.leagueLabel}] ${item.confronto} | Seleção: ${item.selection} (Odd: ${item.odd}) na ${item.bookmaker}`)
      .join('\n');
    
    const text = `🏆 A TRIPLA DE OURO DO DIA 🏆\n\n${itemsText}\n\nOdds Combinadas: ${combinedOdds}\nStake: R$ ${stake.toFixed(2)}\nRetorno Projetado: R$ ${currentRetorno.toFixed(2)}\nProbabilidade Composta: ${data.triplaDeOuro.probabilidadeComposta}%\n\nGerado por Odds System - A Inteligência Esportiva de Alto Padrão!`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Bilhete de aposta copiado para a área de transferência!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  // Helper para renderizar o círculo de progresso da confiança
  const renderConfidenceCircle = (percentage, strokeColor = 'stroke-emerald-400') => {
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative h-14 w-14 flex items-center justify-center bg-slate-900/50 rounded-full border border-white/5 shadow-inner">
        <svg className="h-full w-full transform -rotate-90">
          <circle 
            cx="28" 
            cy="28" 
            r={radius} 
            className="stroke-slate-800" 
            strokeWidth="3.5" 
            fill="transparent" 
          />
          <circle 
            cx="28" 
            cy="28" 
            r={radius} 
            className={`${strokeColor} transition-all duration-700 ease-out`} 
            strokeWidth="3.5" 
            fill="transparent" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round" 
          />
        </svg>
        <span className="absolute text-[10px] font-black font-mono text-white">{percentage}%</span>
      </div>
    );
  };

  if (loading) {
    return (
      <section className="premium-panel py-20 text-center flex flex-col items-center justify-center">
        <div className="h-14 w-14 rounded-full border border-cyan-400/20 bg-cyan-400/5 flex items-center justify-center shadow-lg">
          <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
        <p className="mt-5 text-xs uppercase font-extrabold tracking-[0.2em] text-slate-400">Processando e ranqueando apostas de valor...</p>
      </section>
    );
  }

  if (error) {
    return (
      <div className="reveal-enter rounded-2xl border border-red-300/10 bg-red-400/5 p-6 text-red-200 shadow-xl flex items-start gap-4">
        <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-400" />
        <div>
          <h4 className="font-display text-lg font-bold">Erro de Análise</h4>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">{error}</p>
          <button
            onClick={() => fetchBoaDoDia(stake)}
            className="mt-4 px-5 py-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-500/20 hover:border-red-500/40 cursor-pointer transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.boaSegura || !data.evMax) {
    return (
      <section className="premium-panel py-16 text-center flex flex-col items-center justify-center">
        <div className="h-14 w-14 rounded-full border border-white/5 bg-slate-950/40 flex items-center justify-center mb-4">
          <Target className="h-6 w-6 text-slate-600" />
        </div>
        <h3 className="font-display text-xl font-bold text-slate-200">Grade de Ligas Vazia</h3>
        <p className="mx-auto mt-2 max-w-md text-xs text-slate-400 font-semibold leading-relaxed">
          {data?.message || `Nenhuma aposta qualificada foi encontrada para hoje (${data?.referenceDateLabel || todayLabel}). Aguarde o próximo ciclo de varredura.`}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          <span className="px-3 py-1 rounded-full border border-white/5 bg-slate-950/30">
            Jogos analisados: {data?.analyzedMatchesCount ?? 0}
          </span>
          <span className="px-3 py-1 rounded-full border border-white/5 bg-slate-950/30">
            Mercados avaliados: {data?.analyzedOutcomesCount ?? 0}
          </span>
        </div>
      </section>
    );
  }

  // Cálculos dinâmicos da Tripla de Ouro no lado do cliente
  const combinedOdds = data.triplaDeOuro.combinedOdds;
  const currentRetorno = stake * combinedOdds;
  const currentLucro = currentRetorno - stake;

  return (
    <div className="space-y-6 reveal-enter relative">
      
      {/* Toast popup */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md animate-bounce bg-slate-900/90 text-white">
          <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
            <Check className="h-3 w-3 stroke-[3]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      {/* Info Header panel */}
      <section className="premium-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-2 border-cyan-400">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-cyan-400" />
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500">Janela de Palpites Reais</p>
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider mt-0.5">
              Grade ativa: {data.referenceDateLabel || todayLabel}
            </h4>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase">
          <span className="px-2.5 py-1 rounded-lg border border-white/5 bg-slate-950/50 text-slate-400">
            Analizados: {data.analyzedMatchesCount ?? 0} jogos
          </span>
          <span className="px-2.5 py-1 rounded-lg border border-white/5 bg-slate-950/50 text-slate-400">
            Mercados: {data.analyzedOutcomesCount ?? 0} odds
          </span>
          <span className="px-2.5 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400">
            {fallbackMode === 'tomorrow'
              ? 'Fallback: amanhã'
              : fallbackMode === 'next-available'
                ? 'Fallback: próxima data'
                : 'Filtro: hoje'}
          </span>
        </div>
      </section>

      {/* Cards de Análises Individuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* A Boa Segura */}
        <article className="premium-panel-glow-emerald p-6 relative overflow-hidden flex flex-col justify-between min-h-[260px]">
          <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <header className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                <Target className="h-3.5 w-3.5" />
                A Boa Segura
              </span>
              <p className="text-[10px] text-slate-500 font-extrabold uppercase mt-1.5">{data.boaSegura.leagueLabel}</p>
            </div>
            {renderConfidenceCircle(data.boaSegura.winProbabilityPercentage, 'stroke-emerald-400')}
          </header>

          <div className="my-4">
            <h3 className="font-display text-xl font-black text-white tracking-tight leading-tight">
              {data.boaSegura.confronto}
            </h3>
          </div>

          <footer className="space-y-4">
            <div className="grid grid-cols-2 gap-4 border border-white/5 bg-slate-950/50 p-3.5 rounded-2xl shadow-inner text-xs font-semibold">
              <div>
                <span className="block text-[8px] uppercase font-bold text-slate-500 tracking-wider mb-1">Palpite</span>
                <span className="text-slate-200 font-extrabold text-sm">{data.boaSegura.selection}</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] uppercase font-bold text-slate-500 tracking-wider mb-1">Cotação Máxima</span>
                <span className="inline-flex items-center gap-1.5 mt-0.5">
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    {data.boaSegura.bookmaker}
                  </span>
                  <span className="font-mono font-black text-amber-400 text-sm">{data.boaSegura.odd}</span>
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold border-t border-white/5 pt-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateTime(data.boaSegura.eventDate)}
              </span>
              <span className="text-emerald-400 font-black uppercase">
                VANTAGEM EV: +{(data.boaSegura.ev * 100).toFixed(1)}%
              </span>
            </div>
          </footer>
        </article>

        {/* Aposta de Valor EV Max */}
        <article className="premium-panel-glow-cyan p-6 relative overflow-hidden flex flex-col justify-between min-h-[260px]">
          <div className="absolute top-0 right-0 h-40 w-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <header className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-black uppercase tracking-wider text-cyan-400">
                <TrendingUp className="h-3.5 w-3.5" />
                Valor Máximo (EV+)
              </span>
              <p className="text-[10px] text-slate-500 font-extrabold uppercase mt-1.5">{data.evMax.leagueLabel}</p>
            </div>
            {renderConfidenceCircle(data.evMax.winProbabilityPercentage, 'stroke-cyan-400')}
          </header>

          <div className="my-4">
            <h3 className="font-display text-xl font-black text-white tracking-tight leading-tight">
              {data.evMax.confronto}
            </h3>
          </div>

          <footer className="space-y-4">
            <div className="grid grid-cols-2 gap-4 border border-white/5 bg-slate-950/50 p-3.5 rounded-2xl shadow-inner text-xs font-semibold">
              <div>
                <span className="block text-[8px] uppercase font-bold text-slate-500 tracking-wider mb-1">Palpite</span>
                <span className="text-slate-200 font-extrabold text-sm">{data.evMax.selection}</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] uppercase font-bold text-slate-500 tracking-wider mb-1">Cotação Máxima</span>
                <span className="inline-flex items-center gap-1.5 mt-0.5">
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    {data.evMax.bookmaker}
                  </span>
                  <span className="font-mono font-black text-amber-400 text-sm">{data.evMax.odd}</span>
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold border-t border-white/5 pt-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateTime(data.evMax.eventDate)}
              </span>
              <span className="text-cyan-400 font-black uppercase">
                VANTAGEM EV: +{(data.evMax.ev * 100).toFixed(1)}%
              </span>
            </div>
          </footer>
        </article>

      </div>

      {/* A Tripla de Ouro */}
      {data.triplaDeOuro && data.triplaDeOuro.items && data.triplaDeOuro.items.length > 0 && (
        <section className="premium-panel-glow-gold p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4 mb-5">
            <div className="space-y-1">
              <h3 className="font-display text-xl font-black text-white flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-400" />
                Múltipla Unificada: A Tripla de Ouro
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed max-w-xl">
                Cálculo de probabilidade que combina as 3 melhores oportunidades que não conflitam no mesmo horário, maximizando os retornos.
              </p>
            </div>

            <button
              onClick={handleCopyTicket}
              className={`px-5 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer ${
                copied
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-400/30 bg-amber-400/5 text-amber-300 hover:bg-amber-400/15 hover:border-amber-400/50 active:scale-97'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-amber-400" />
                  Copiar Bilhete
                </>
              )}
            </button>
          </header>

          {/* Interactive slider for real-time calculations */}
          <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-6 bg-slate-950/40 border border-white/5 p-4.5 rounded-2xl mb-6">
            
            {/* Banca / Stake label & number */}
            <div className="md:col-span-1 space-y-1">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Valor Banca de Entrada</span>
              <div className="flex items-center gap-2 text-lg font-black text-white font-mono">
                <Coins className="h-4 w-4 text-amber-400" />
                R$ {stake.toFixed(2)}
              </div>
            </div>

            {/* Range slider control */}
            <div className="md:col-span-3 space-y-2">
              <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider">
                <span>R$ 10</span>
                <span>R$ 200</span>
                <span>R$ 500</span>
                <span>R$ 1.000</span>
              </div>
              <div className="flex items-center gap-3">
                <Sliders className="h-4 w-4 text-slate-600" />
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={stake}
                  onChange={(e) => {
                    setStake(Number(e.target.value));
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
                />
              </div>
            </div>

          </div>

          {/* Selections timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {data.triplaDeOuro.items.map((item, idx) => (
              <div
                key={`${item.matchId}_${idx}`}
                className="relative bg-slate-950/30 border border-white/5 p-4 rounded-2xl flex flex-col justify-between"
              >
                {/* Ordinal marker */}
                <div className="absolute -top-2.5 left-4 h-5.5 w-5.5 rounded-full border border-amber-400 bg-slate-950 flex items-center justify-center text-[10px] font-black font-mono text-amber-400">
                  {idx + 1}
                </div>

                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 mb-3 mt-1.5">
                  <span className="text-[8px] font-black uppercase bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-slate-400">
                    {item.leagueLabel}
                  </span>
                  <span className="text-[8px] font-bold text-slate-500 font-mono">
                    {formatDateTime(item.eventDate)}
                  </span>
                </div>

                <h4 className="text-xs font-black text-slate-200 tracking-tight leading-tight mb-4 min-h-[32px]">
                  {item.confronto}
                </h4>

                <div className="space-y-1.5 text-[11px] font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Palpite:</span>
                    <span className="text-slate-300 font-extrabold">{item.selection}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Cotação:</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[8px] font-black uppercase bg-slate-900 border border-white/5 px-1.5 py-0.5 rounded text-cyan-400">
                        {item.bookmaker}
                      </span>
                      <span className="font-mono font-black text-amber-400">{item.odd}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Compounding output numbers */}
          <footer className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 border border-white/5 p-5 rounded-2xl shadow-inner text-xs font-semibold">
            <div>
              <span className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">Cotação Combinada</span>
              <div className="text-xl font-black text-amber-400 font-mono flex items-center gap-1">
                <Zap className="h-4 w-4 text-amber-400" />
                {combinedOdds.toFixed(2)}
              </div>
            </div>

            <div>
              <span className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">Aposta Total</span>
              <div className="text-xl font-black text-slate-300 font-mono">R$ {stake.toFixed(2)}</div>
            </div>

            <div>
              <span className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">Retorno Potencial</span>
              <div className="text-xl font-black text-slate-300 font-mono">R$ {currentRetorno.toFixed(2)}</div>
            </div>

            <div>
              <span className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">Lucro Líquido</span>
              <div className="text-xl font-black text-emerald-400 font-mono">+R$ {currentLucro.toFixed(2)}</div>
            </div>
          </footer>

        </section>
      )}

    </div>
  );
}
