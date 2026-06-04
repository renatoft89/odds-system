import React, { useState } from 'react';
import LeverageTimeline from './LeverageTimeline';
import BoaDoDia from './BoaDoDia';
import { Sparkles, Trophy, Coins, Target } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('leverage'); // 'leverage' ou 'boadodia'

  return (
    <div className="relative flex-1 min-h-screen overflow-hidden px-4 py-6 text-gray-100 md:px-8 md:py-10 bg-slate-950">
      {/* Luzes de fundo dinâmicas com HSL personalizado */}
      <div className="ui-orb ui-orb--teal absolute -top-40 -left-40 h-[600px] w-[600px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" aria-hidden="true" />
      <div className="ui-orb ui-orb--amber absolute top-1/2 -right-40 h-[600px] w-[600px] bg-yellow-500/10 rounded-full blur-[140px] pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8">

        {/* Header Esportivo Brasileirão */}
        <header className="glass-panel p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-r from-slate-900/90 to-slate-900/40">
          <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-yellow-200 shadow-inner">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-400" />
                </span>
                Monitoramento em Tempo Real
              </div>
              <h1 className="font-display text-3xl font-black leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
                Radar de Oportunidades <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-emerald-400 to-cyan-400">Multiliga</span>
                <span className="ml-3 inline-flex align-middle text-yellow-300">
                  <Sparkles className="h-7 w-7 animate-pulse" />
                </span>
              </h1>
              <p className="max-w-3xl text-sm text-slate-300 md:text-base leading-relaxed font-medium">
                Encontre as melhores oportunidades matemáticas para alavancar sua banca. Comparamos odds de múltiplas casas internacionais em tempo real para você apostar sempre com vantagem real.
              </p>
            </div>
          </div>
        </header>

        {/* Abas Esportivas Premium */}
        <nav className="flex border-b border-white/10 gap-2 overflow-x-auto pb-1" aria-label="Abas de análise">
          <button
            onClick={() => setActiveTab('leverage')}
            className={`px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'leverage'
                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300 shadow-lg shadow-yellow-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Coins className="h-4.5 w-4.5" />
            Alavancagem
          </button>
          <button
            onClick={() => setActiveTab('boadodia')}
            className={`px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'boadodia'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Target className="h-4.5 w-4.5" />
            A Boa do Dia 🌟
          </button>
        </nav>

        {/* Renderização de Componentes baseado na Aba Ativa */}
        <main>
          {activeTab === 'leverage' ? <LeverageTimeline /> : <BoaDoDia />}
        </main>
      </div>
    </div>
  );
}
