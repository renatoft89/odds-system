# Radar de Odds & Inteligência de Alavancagem (Soros)

Bem-vindo ao **Odds System** — um ecossistema de radar de oportunidades e análise matemática esportiva de alto padrão. O sistema monitora odds em tempo real de casas de apostas parceiras (**Betano** e **Bet365**), calcula discrepâncias de mercado (**EV+**) e monta estratégias automatizadas de alavancagem de banca (**Soros**) e palpites individuais de altíssima probabilidade (**A Boa do Dia**).

---

## 🏗️ Arquitetura do Sistema e Funcionamento

O projeto é dividido em uma arquitetura desacoplada de duas camadas principais:

### 1. Backend (Node.js + Express + MongoDB)
O servidor backend orquestra a coleta, saneamento, persistência e modelagem matemática das oportunidades:
- **Background Scanner (`src/server.js`)**: Executa um ciclo programado a cada 8 horas (3 vezes ao dia) para coletar odds decimais reais da `The Odds API (v4)` para as competições principais:
  - **Campeonato Brasileiro (Série A)** (`soccer_brazil_campeonato`)
  - **Premier League** (`soccer_epl`)
  - **La Liga** (`soccer_spain_la_liga`)
  - **Copa Libertadores** (`soccer_conmebol_copa_libertadores`)
  - **Copa Sudamericana** (`soccer_conmebol_copa_sudamericana`)
  - **Copa do Mundo FIFA** (`soccer_fifa_world_cup`)
- **Normalização de Dados (`src/utils/matchEngine.js`)**: Higieniza e padroniza os nomes de times de futebol para evitar conflitos de tradução de strings dos bookmakers.
- **Persistência de Dados (`src/database/dbService.js`)**: Grava com segurança no MongoDB, aplicando índices otimizados e sanitização rigorosa de strings para mitigar vulnerabilidades de *NoSQL Injection*.
- **Motor de Alavancagem (`src/utils/leverageService.js`)**: O cérebro do cálculo de Soros. Ele vasculha o banco dividindo os candidatos em faixas de odds (Tiers) e monta uma esteira temporal estrita onde cada aposta é sequencial e dependente do lucro bruto do passo anterior.
- **Motor Analítico da Boa do Dia (`src/utils/analyticsService.js`)**: Processa todas as ligas ativas e, através de uma fórmula ponderada de **Value Score**, recomenda os melhores palpites individuais (Boa Segura e EV+ Max) e um bilhete múltiplo combinado (A Tripla de Ouro).

### 2. Frontend (React + Vite + Vanilla CSS)
Uma SPA (Single Page Application) projetada sob conceitos de **Rich Aesthetics**:
- **Design Visual Wow**: Interface escura e imersiva com luzes de fundo em HSL dinâmico, efeito glassmorphism e micro-animações neon.
- **Abas Reativas de Alta Fidelidade**: Permite alternar com fluidez entre a timeline interativa da **Esteira de Soros** e o painel analítico da **Boa do Dia**.
- **Resolução de Host Dinâmico**: O frontend detecta automaticamente `window.location.hostname` e resolve o IP do servidor local backend sem a necessidade de proxies adicionais.

---

## ⚡ Resiliência Offline e Fallback de Dados

Para garantir a melhor experiência de desenvolvimento e demonstração (DX), o sistema possui um **Mecanismo de Injeção de Dados Simulados Resilientes** em `server.js`:
- Caso a API externa de odds falhe (como erros comuns de rede local `fetch failed` ou limites estourados de créditos de chave), o backend intercepta o erro de forma elegante.
- Em vez de deixar a tela em branco, o sistema povoa automaticamente o MongoDB local com dados simulados de altíssima fidelidade para todas as competições suportadas: **Série A**, **Premier League**, **La Liga**, **Copa Libertadores**, **Copa Sudamericana** e **Copa do Mundo FIFA**.
- As datas desses confrontos de demonstração são calculadas dinamicamente no **futuro** com base na hora exata em que você liga o servidor.

---

## 🚀 Como Executar o Projeto Passo a Passo

### Pré-requisitos
- **Node.js** (versão 18.0.0 ou superior)
- **MongoDB** rodando localmente (`mongodb://127.0.0.1:27017/odds_db`)

### 1. Configurando o Ambiente
Crie um arquivo `.env` na raiz do projeto contendo:
```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/odds_db
THE_ODDS_API_KEY=00f1e1a6493a07e53d652f3b5531b032
THE_ODDS_SPORT_BRAZIL="soccer_brazil_campeonato"
THE_ODDS_SPORT_BRAZIL_SERIE_A="soccer_brazil_campeonato"
THE_ODDS_SPORT_PREMIER_LEAGUE="soccer_epl"
THE_ODDS_SPORT_LA_LIGA="soccer_spain_la_liga"
THE_ODDS_SPORT_LIBERTADORES="soccer_conmebol_copa_libertadores"
THE_ODDS_SPORT_SULAMERICANA="soccer_conmebol_copa_sudamericana"
THE_ODDS_SPORT_WORLD_CUP="soccer_fifa_world_cup"
ODDS_CACHE_TTL_SEC=300
ALLOW_MOCK_FALLBACK=false
```

### 2. Executando em Modo de Desenvolvimento (Manual)

#### Iniciar o Servidor Backend:
```bash
# Na raiz do projeto
npm install
npm run start
```

#### Iniciar o Servidor Frontend:
```bash
# Navegue até a subpasta frontend
cd frontend
npm install
npm run dev
```
Acesse no navegador: `http://localhost:5173/` (ou pelo IP local indicado no console).

### 3. Executando em Modo de Produção (PM2 Daemon)
Para manter o servidor backend e o frontend ativos em background e inicializados automaticamente com o sistema operacional:
```bash
# Na raiz do projeto, instale e suba via PM2
npm run site:up
```
Comandos adicionais para gerenciamento PM2:
- `npm run site:status` (Verificar integridade dos daemons)
- `npm run site:logs` (Acompanhar logs unificados em tempo real)
- `npm run site:restart` (Reiniciar backend e frontend)
- `npm run site:down` (Parar e remover os daemons)

---

## 🎯 Guia de Endpoints da API Backend

O backend Express expõe a porta `3000` (ou a configurada no `.env`):

### 1. `GET /api/leverage/pipeline`
Calcula a esteira sequencial de Alavancagem de Soros para uma liga específica.
- **Query Params**:
  - `initialStake` (number): Valor de entrada em reais (padrão: `10`).
  - `steps` (number): Quantidade de pernas/jogos na esteira (padrão: `3`).
  - `league` (string): Identificador da liga. Opções: `brazil-serie-a`, `premier-league`, `la-liga`, `copa-libertadores`, `copa-sudamericana`, `fifa-world-cup` (padrão: `brazil-serie-a`).
- **Exemplo de Retorno**:
  ```json
  {
    "success": true,
    "timestamp": "2026-06-01T23:30:00.000Z",
    "initialStake": 10,
    "steps": 3,
    "league": "brazil-serie-a",
    "data": [
      {
        "step": 1,
        "confronto": "Flamengo vs Palmeiras",
        "eventDate": "2026-06-02T16:00:00.000Z",
        "selection": "Vitória Casa (1)",
        "odd": 1.85,
        "bookmaker": "Betano",
        "winProbabilityPercentage": 52.63,
        "stake": 10,
        "retorno": 18.5,
        "lucro": 8.5
      }
      // ... passos subsequentes
    ]
  }
  ```

### 2. `GET /api/leverage/boa-do-dia`
Calcula de forma consolidada e ranqueia as melhores oportunidades de aposta do dia de todas as ligas ativas.
- **Query Params**:
  - `stake` (number): Valor de banca de entrada para projeção de múltipla (padrão: `10`).
- **Exemplo de Retorno**:
  ```json
  {
    "success": true,
    "analyzedMatchesCount": 13,
    "analyzedOutcomesCount": 65,
    "boaSegura": {
      "confronto": "Colombia vs DR Congo",
      "selection": "Vitória Casa (1)",
      "odd": 1.5,
      "bookmaker": "Bet365",
      "winProbabilityPercentage": 67.57,
      "valueScore": 1.0135
    },
    "evMax": {
      "confronto": "Saudi Arabia vs Uruguay",
      "selection": "Vitória Fora (2)",
      "odd": 1.65,
      "bookmaker": "Betano",
      "ev": 0.0185
    },
    "triplaDeOuro": {
      "stake": 10,
      "combinedOdds": 4.58,
      "retornoProjetado": 45.8,
      "lucroProjetado": 35.8,
      "probabilidadeComposta": 28.45,
      "items": [
        // ... 3 seleções cronológicas sem sobreposição de horário
      ]
    }
  }
  ```

---

## 🔍 Code Review: Análise Técnica e Sugestões de Melhoria

Como Engenheiro de Software Sênior, conduzi uma auditoria geral sobre a codebase do sistema. Abaixo estão listadas as vulnerabilidades solucionadas, gargalos identificados e caminhos arquiteturais para evolução do projeto.

### 🛡️ Correções Realizadas Recentes
1. **O Bug da Desordenação de Datas (Soros)**:
   - *O Erro*: O pipeline de alavancagem ordenava a lista de candidatos por chance de vitória de forma absoluta e pegava as primeiras partidas sem considerar o fluxo cronológico, fazendo com que o Passo 2 acontecesse antes do Passo 1 no tempo.
   - *A Correção*: Alteramos a ordenação inicial para **data ascendente estrita** com desempate secundário por maior probabilidade de green e EV+. Implementamos a validação `timeDiffMin >= tier.timeMarginMin` na montagem do pipeline principal para garantir que a perna N+1 inicie apenas após a conclusão e liquidação da perna N.
2. **Offline Crash e Resiliência**:
   - *O Erro*: Se a internet do servidor caísse ou a chave da API esgotasse, o banco era limpo e o dashboard exibia "Sem odds qualificadas".
   - *A Correção*: Implementamos a injeção automática de mocks multiliga de alta fidelidade como fallback automático em `server.js` na inicialização caso a rede falhe.

---

### ⚠️ Erros Identificados & Oportunidades de Melhoria

Para novos engenheiros de software que assumirem o projeto ou para implementação de novas features, seguem as principais recomendações:

#### 1. Tipagem Estática (Migração para TypeScript)
- **Status Atual**: O projeto usa JavaScript puro (ESModules) tanto no backend quanto no frontend.
- **O Gargalo**: Alterações em schemas ou contratos de APIs de odds esportivas (que mudam frequentemente) podem introduzir bugs silenciosos em tempo de execução que seriam prevenidos na compilação.
- **Melhoria Recomendada**: Migrar gradualmente o backend e o frontend para **TypeScript** (`.ts` / `.tsx`) para garantir maior integridade de contratos e interfaces.

#### 2. Robustez do Ciclo do Banco de Dados (MongoDB)
- **Status Atual**: A função `connectDatabase` captura erros de conexão na inicialização, mas se o MongoDB cair com o servidor em execução, as rotas quebram e o orquestrador em background pode falhar silenciosamente.
- **Melhoria Recomendada**: Implementar listeners de monitoramento de eventos do Mongoose (`mongoose.connection.on('disconnected')`) e mecanismos de reconexão resiliente com exponencial backoff para auto-recuperação do servidor.

#### 3. Autenticação e Rate Limiting
- **Status Atual**: As APIs `/api/leverage/pipeline` e `/api/leverage/boa-do-dia` são públicas e expostas a qualquer rede externa sem autenticação ou limites.
- **O Gargalo**: Um ator malicioso ou scripts automatizados de terceiros podem derrubar o servidor enviando requisições abusivas que sobrecarregam o MongoDB (DoS).
- **Melhoria Recomendada**: Integrar a biblioteca `express-rate-limit` nas rotas para limitar o número de requisições por IP e adicionar segurança via tokens JWT se o sistema for monetizado ou fechado.

#### 4. Testes Automatizados e CI/CD
- **Status Atual**: Existem scripts utilitários na pasta `scratch` (`test_leverage.js`, `test_analytics.js`), mas eles não são asserções formais e precisam ser executados manualmente no console.
- **Melhoria Recomendada**: Configurar um framework robusto como **Vitest** ou **Jest**. Criar testes unitários para a lógica de montagem do pipeline de Soros (validando as regras de margem de tempo de 150 min e ordenação cronológica) e para o cálculo do Value Score. Integrar as suítes de testes a uma esteira de Integração Contínua (GitHub Actions).

#### 5. Implementação de Módulos Inativos: Surebets
- **Status Atual**: Existe um arquivo `SurebetTable.jsx` inativo no frontend, o que indica uma funcionalidade planejada de Arbitragem Esportiva (Surebets) que ainda não foi desenvolvida no backend.
- **Como Implementar**: Para criar este novo módulo:
  1. No backend, crie uma rota `GET /api/leverage/surebets`.
  2. Implemente o cálculo de surebets buscando partidas onde a soma das probabilidades inversas das melhores odds das duas casas seja menor que 1:
     $$\frac{1}{\text{Odd Casa CasaA}} + \frac{1}{\text{Odd Empate CasaB}} + \frac{1}{\text{Odd Fora CasaB}} < 1$$
  3. Formate a margem de lucro garantido e retorne a lista para alimentar a tabela do frontend.
