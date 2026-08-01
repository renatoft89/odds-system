import React, { useState } from 'react';
import LeverageTimeline from './LeverageTimeline';
import BoaDoDia from './BoaDoDia';
import { Sparkles, Coins, Target, Database, Clock, Zap } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('leverage'); // 'leverage' ou 'boadodia'

  return (
    <div className="relative flex-1 min-h-screen px-4 py-6 text-slate-100 md:px-8 md:py-8 bg-[#05070c]">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />
      <div className="absolute top-[40%] right-[-10%] h-[600px] w-[600px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-[-10%] left-[20%] h-[400px] w-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
        
        {/* Upper Status Bar / Mini Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/10">
              <Zap className="h-5.5 w-5.5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-display font-black text-xl tracking-tight text-white uppercase">
                Odds<span className="text-amber-400">System</span>
              </span>
              <span className="ml-2 rounded-md bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400 border border-white/5">
                v1.2.0
              </span>
            </div>
          </div>
          
          {/* Live system telemetry widgets */}
          <div className="flex flex-wrap items-center gap-3 md:gap-5 text-[11px] font-bold text-slate-400">
            <div className="flex items-center gap-2 rounded-xl bg-slate-900/50 px-3 py-1.5 border border-white/5 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>SERVIDORES: <span className="text-emerald-400 font-extrabold">ONLINE</span></span>
            </div>
            
            <div className="flex items-center gap-2 rounded-xl bg-slate-900/50 px-3 py-1.5 border border-white/5 shadow-inner">
              <Database className="h-3.5 w-3.5 text-indigo-400" />
              <span>BANCO DE DADOS: <span className="text-indigo-400 font-extrabold">CONECTADO</span></span>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-900/50 px-3 py-1.5 border border-white/5 shadow-inner">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>VARREDURA: <span className="text-amber-400 font-extrabold">CADA 8 HORAS</span></span>
            </div>
          </div>
        </div>

        {/* Hero Section / Banner */}
        <header className="premium-panel p-6 md:p-8 relative overflow-hidden bg-gradient-to-r from-slate-950/80 to-slate-900/40">
          <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-400" />
                Inteligência Ponderada de EV+
              </div>
              <h1 className="font-display text-3xl font-black leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
                Radar de Oportunidades <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400">Quantitativas</span>
              </h1>
              <p className="max-w-3xl text-sm text-slate-400 md:text-base leading-relaxed font-medium">
                Monitore odds em tempo real de casas de apostas parceiras, calcule discrepâncias matemáticas de mercado e acesse planos estruturados de alavancagem de banca utilizando o método composto.
              </p>
            </div>
          </div>
        </header>

        {/* Interactive Tabs */}
        <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-1 mt-2">
          <button
            onClick={() => setActiveTab('leverage')}
            className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'leverage'
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300 shadow-lg shadow-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Coins className="h-4.5 w-4.5" />
            Esteira de Soros
          </button>
          <button
            onClick={() => setActiveTab('boadodia')}
            className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'boadodia'
                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-lg shadow-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Target className="h-4.5 w-4.5" />
            A Boa do Dia
          </button>
        </div>

        {/* Main Content Area */}
        <main className="min-h-[400px]">
          {activeTab === 'leverage' ? <LeverageTimeline /> : <BoaDoDia />}
        </main>

        {/* Footer */}
        <footer className="text-center py-8 text-xs text-slate-500 border-t border-white/5 mt-10">
          <p>© {new Date().getFullYear()} Odds System. Todos os direitos reservados. Aposte com responsabilidade.</p>
        </footer>
      </div>
    </div>
  );
}
