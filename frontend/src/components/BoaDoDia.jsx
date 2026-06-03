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
  ArrowUpRight,
  Copy,
  CheckCircle2,
  Calendar,
  Zap
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.64:3000').replace(/\/$/, '');

export default function BoaDoDia() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [stake, setStake] = useState(10);

  const fetchBoaDoDia = async (targetStake = stake) => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoaDoDia(stake);
  }, []);

  // Formata o horário em PT-BR usando o hook nativo de Timezone São Paulo
  const formatDateTime = useDateTimeFormatter();
  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date());
  const isNextDayFallback = Boolean(data?.isNextDayFallback);
  const fallbackMode = data?.fallbackMode;

  const handleCopyTicket = () => {
    if (!data || !data.triplaDeOuro) return;
    const itemsText = data.triplaDeOuro.items
      .map(item => `- [${item.leagueLabel}] ${item.confronto} | Seleção: ${item.selection} (Odd: ${item.odd}) na ${item.bookmaker}`)
      .join('\n');
    
    const text = `🏆 A TRIPLA DE OURO DO DIA 🏆\n\n${itemsText}\n\nOdds Combinadas: ${data.triplaDeOuro.combinedOdds}\nStake: R$ ${data.triplaDeOuro.stake}\nRetorno Projetado: R$ ${data.triplaDeOuro.retornoProjetado}\nProbabilidade Composta: ${data.triplaDeOuro.probabilidadeComposta}%\n\nGerado por Odds System - A Inteligência Esportiva de Alto Padrão!`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return (
      <section className="glass-panel py-24 text-center rounded-3xl border border-white/10 shadow-2xl bg-slate-900/10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-yellow-300/30 bg-yellow-300/10 shadow-lg">
          <RefreshCw className="h-6 w-6 animate-spin text-yellow-200" />
        </div>
        <p className="mt-6 text-xs uppercase font-bold tracking-[0.2em] text-slate-300">Processando e Ranquando Palpites Multiliga...</p>
      </section>
    );
  }

  if (error) {
    return (
      <div className="reveal-enter rounded-3xl border border-red-300/30 bg-red-400/10 p-6 text-red-100 shadow-2xl">
        <div className="flex items-start gap-4">
          <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-300" />
          <div>
            <h4 className="font-display text-lg font-bold">Erro de Análise</h4>
            <p className="mt-1 text-sm text-red-100/80 leading-relaxed font-medium">{error}</p>
            <button
              onClick={() => fetchBoaDoDia(stake)}
              className="mt-4 px-4 py-2 bg-red-400/20 border border-red-400/30 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-400/35 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.boaSegura || !data.evMax) {
    return (
      <section className="glass-panel py-20 text-center rounded-3xl border border-white/10 shadow-2xl bg-slate-900/15">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <Target className="h-8 w-8 text-slate-500" />
        </div>
        <h3 className="mt-5 font-display text-2xl font-bold text-slate-100">Grade de Ligas Vazia</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400 font-semibold leading-relaxed">
          {data?.message || `Nenhuma aposta segura foi encontrada para hoje (${data?.referenceDateLabel || todayLabel}). Aguarde a próxima atualização da API.`}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5">
            Jogos analisados: {data?.analyzedMatchesCount ?? 0}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5">
            Mercados avaliados: {data?.analyzedOutcomesCount ?? 0}
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8 reveal-enter">
      <section className="glass-panel p-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-cyan-200 font-black text-xs uppercase tracking-[0.12em]">
            <Calendar className="h-4 w-4 text-cyan-300" />
            Boa do Dia: {data.referenceDateLabel || todayLabel}
          </span>
          <span className="text-[11px] font-bold uppercase px-3 py-1 rounded-full border border-cyan-300/30 bg-cyan-500/15 text-cyan-300">
            {fallbackMode === 'tomorrow'
              ? 'Fallback: jogos de amanhã'
              : fallbackMode === 'next-available'
                ? 'Fallback: próxima data disponível'
                : 'Apenas jogos de hoje'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-cyan-100">
          <span className="px-2.5 py-1 rounded-full border border-cyan-300/30 bg-cyan-500/15">
            Jogos analisados: {data.analyzedMatchesCount ?? 0}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-cyan-300/30 bg-cyan-500/15">
            Mercados avaliados: {data.analyzedOutcomesCount ?? 0}
          </span>
        </div>
      </section>

      {/* Cards Individuais Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* A Boa Segura */}
        <article className="glass-panel p-6 md:p-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-950/60 to-emerald-950/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex justify-between items-start gap-4 mb-6">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <Target className="h-3.5 w-3.5" />
                A Boa Segura
              </span>
              <p className="text-xs text-slate-400 font-semibold">{data.boaSegura.leagueLabel}</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Confiança</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">{data.boaSegura.winProbabilityPercentage}%</div>
            </div>
          </div>

          <h3 className="font-display text-xl md:text-2xl font-black text-slate-100 tracking-tight leading-tight mb-4">
            {data.boaSegura.confronto}
          </h3>

          <div className="grid grid-cols-2 gap-4 border border-white/5 bg-black/30 p-4 rounded-2xl mb-6 shadow-inner">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Mercado Recomendado</span>
              <span className="text-sm font-black text-slate-200">{data.boaSegura.selection}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Casa & Odd Recomendada</span>
              <span className="inline-flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/15 text-cyan-300`}>
                  {data.boaSegura.bookmaker}
                </span>
                <span className="text-base font-mono font-black text-yellow-300">{data.boaSegura.odd}</span>
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {formatDateTime(data.boaSegura.eventDate)}
            </span>
            <span className="text-[10px] font-bold uppercase bg-emerald-400/10 px-2 py-0.5 rounded text-emerald-300 border border-emerald-400/20">
              EV+: +{(data.boaSegura.ev * 100).toFixed(2)}%
            </span>
          </div>
        </article>

        {/* Aposta de Valor EV Max */}
        <article className="glass-panel p-6 md:p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-slate-950/60 to-amber-950/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex justify-between items-start gap-4 mb-6">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-500/15 text-xs font-bold uppercase tracking-wider text-amber-300">
                <TrendingUp className="h-3.5 w-3.5" />
                Valor Máximo (EV+)
              </span>
              <p className="text-xs text-slate-400 font-semibold">{data.evMax.leagueLabel}</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Vantagem EV+</div>
              <div className="text-2xl font-black text-amber-400 font-mono">+{(data.evMax.ev * 100).toFixed(2)}%</div>
            </div>
          </div>

          <h3 className="font-display text-xl md:text-2xl font-black text-slate-100 tracking-tight leading-tight mb-4">
            {data.evMax.confronto}
          </h3>

          <div className="grid grid-cols-2 gap-4 border border-white/5 bg-black/30 p-4 rounded-2xl mb-6 shadow-inner">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Mercado Recomendado</span>
              <span className="text-sm font-black text-slate-200">{data.evMax.selection}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Casa & Odd Recomendada</span>
              <span className="inline-flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/15 text-cyan-300`}>
                  {data.evMax.bookmaker}
                </span>
                <span className="text-base font-mono font-black text-yellow-300">{data.evMax.odd}</span>
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {formatDateTime(data.evMax.eventDate)}
            </span>
            <span className="text-[10px] font-bold uppercase bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
              Confiança: {data.evMax.winProbabilityPercentage}%
            </span>
          </div>
        </article>
      </div>

      {/* A Tripla de Ouro (Múltipla do Dia) */}
      <section className="glass-panel p-6 md:p-8 rounded-3xl border border-yellow-500/20 bg-gradient-to-b from-slate-900/60 to-slate-950/60 shadow-2xl relative">
        <div className="absolute top-0 right-0 h-40 w-40 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6 mb-6">
          <div className="space-y-1">
            <h3 className="font-display text-2xl font-black text-slate-100 flex items-center gap-2">
              <Trophy className="h-7 w-7 text-yellow-300" />
              Bilhete do Dia: A Tripla de Ouro
            </h3>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed max-w-xl">
              Cálculo automatizado que combina as 3 melhores oportunidades cronológicas que não conflitam, multiplicando os ganhos com inteligência matemática.
            </p>
          </div>
          <button
            onClick={handleCopyTicket}
            className={`px-5 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md ${
              copied
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 hover:border-yellow-500/40 active:scale-97'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Bilhete Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-yellow-300" />
                Copiar Bilhete
              </>
            )}
          </button>
        </header>

        {/* Inputs de Stake */}
        <div className="flex flex-wrap items-center gap-4 bg-black/30 border border-white/5 p-4 rounded-2xl mb-8">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Valor de Referência:</span>
          </div>
          <div className="relative w-32 shadow-inner">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold font-mono text-xs">
              R$
            </div>
            <input
              type="number"
              min="2"
              max="10000"
              value={stake}
              onChange={(e) => {
                const targetStake = Math.max(1, Number(e.target.value));
                setStake(targetStake);
                fetchBoaDoDia(targetStake);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-slate-100 font-bold font-mono text-sm tracking-wide focus:outline-none focus:ring-1 focus:ring-yellow-300/40"
            />
          </div>
        </div>

        {/* Timeline dos 3 Jogos da Múltipla */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 relative before:absolute before:left-4 lg:before:left-0 lg:before:right-0 before:top-4 lg:before:top-1/2 before:bottom-4 lg:before:bottom-auto before:w-[2px] lg:before:h-[2px] lg:before:w-auto before:bg-white/10">
          {data.triplaDeOuro.items.map((item, idx) => {
            return (
              <div key={`${item.matchId}_${item.selection}_${idx}`} className="relative pl-8 lg:pl-0 lg:pt-6 bg-slate-900/20 backdrop-blur-sm rounded-3xl border border-white/5 p-5 hover:border-yellow-500/20 transition-all duration-300">
                {/* Marcador da Ordem */}
                <div className="absolute left-0 lg:left-1/2 -translate-x-1/2 lg:-translate-x-1/2 top-4 lg:-top-3 h-6 w-6 rounded-full border-2 border-yellow-300 bg-slate-950 flex items-center justify-center text-xs font-black font-mono text-yellow-300 shadow-md">
                  {idx + 1}
                </div>

                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                    {item.leagueLabel}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {formatDateTime(item.eventDate)}
                  </span>
                </div>

                <h4 className="font-display font-black text-slate-100 text-sm md:text-base leading-tight mb-4 tracking-tight">
                  {item.confronto}
                </h4>

                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold">Palpite:</span>
                    <span className="text-slate-200 font-black">{item.selection}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">Odd Recomendada:</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        {item.bookmaker}
                      </span>
                      <span className="font-mono font-black text-yellow-300">{item.odd}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumo da Múltipla */}
        <footer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-black/40 border border-white/5 p-6 rounded-3xl text-slate-100 shadow-inner">
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Cotação Múltipla</span>
            <div className="text-2xl font-black text-yellow-300 font-mono flex items-center gap-1">
              <Zap className="h-5 w-5 text-yellow-400" />
              {data.triplaDeOuro.combinedOdds}
            </div>
          </div>
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Banca Entrada</span>
            <div className="text-2xl font-black text-slate-200 font-mono">R$ {data.triplaDeOuro.stake.toFixed(2)}</div>
          </div>
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Lucro Líquido Projetado</span>
            <div className="text-2xl font-black text-emerald-400 font-mono">R$ {data.triplaDeOuro.lucroProjetado.toFixed(2)}</div>
          </div>
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Probabilidade Composta</span>
            <div className="text-2xl font-black text-cyan-400 font-mono">{data.triplaDeOuro.probabilidadeComposta}%</div>
          </div>
        </footer>
      </section>
    </div>
  );
}
