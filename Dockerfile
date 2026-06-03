# Estágio de construção e execução usando a imagem oficial do Playwright pré-configurada
# Esta imagem já contém todos os navegadores e dependências de sistema operacional necessários.
FROM mcr.microsoft.com/playwright:v1.43.1-jammy

# Define o diretório de trabalho no container
WORKDIR /usr/src/app

# Copia os arquivos de dependência do Node
COPY package*.json ./

# Instala apenas as dependências de produção para otimizar o tamanho da imagem
RUN npm ci --only=production

# Copia os diretórios de código fonte
COPY src/ ./src/

# Configura variáveis de ambiente necessárias
ENV NODE_ENV=production
ENV HEADLESS=true
ENV MONGO_URI=mongodb://127.0.0.1:27017/odds_db

# Comando padrão para executar o orquestrador principal
CMD [ "npm", "start" ]
