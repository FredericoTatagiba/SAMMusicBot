# 🎵 Discord Music Bot

Bot de música para Discord que busca e toca faixas a partir de **YouTube**, **Spotify** e **SoundCloud**. Escrito em **TypeScript** com arquitetura orientada a **SOLID**, **design patterns** e cobertura de **testes automatizados**.

[![CI](https://github.com/SEU_USUARIO/SEU_REPO/actions/workflows/ci.yml/badge.svg)](../../actions)

---

## Recursos

- Busca por nome ("`!play bohemian rhapsody`") ou por link direto (YouTube, Spotify, SoundCloud).
- Fila por servidor com faixa atual, próximas e limite configurável.
- Controles: tocar, pular, parar, pausar, retomar, repetir (faixa/fila), embaralhar.
- Desconexão automática após inatividade.
- Logs estruturados e tratamento de erros amigável.

O áudio é sempre transmitido a partir do YouTube/SoundCloud. Como o Spotify não permite stream direto, links do Spotify são resolvidos em metadados (título/artista) e o áudio equivalente é localizado no YouTube — um padrão comum e legalmente seguro para bots.

---

## Comandos

| Comando | Aliases | Descrição |
| --- | --- | --- |
| `!play <nome\|link>` | `p`, `tocar` | Toca ou enfileira uma faixa. |
| `!skip` | `s`, `pular`, `next` | Pula a faixa atual. |
| `!stop` | `parar`, `leave`, `sair` | Para tudo e sai do canal. |
| `!pause` | `pausar` | Pausa a reprodução. |
| `!resume` | `retomar`, `continuar` | Retoma a reprodução. |
| `!queue` | `q`, `fila` | Mostra a fila. |
| `!nowplaying` | `np`, `agora` | Mostra a faixa atual. |
| `!loop <off\|track\|queue>` | `repeat`, `repetir` | Define a repetição. |
| `!shuffle` | `embaralhar` | Embaralha a fila. |
| `!help` | `h`, `ajuda`, `comandos` | Lista os comandos. |

O prefixo (`!`) é configurável via `COMMAND_PREFIX`.

---

## Arquitetura

O projeto segue uma **arquitetura em camadas** com dependências apontando sempre para o centro (regras de negócio), nunca para a infraestrutura — o **Dependency Inversion Principle** na prática.

```text
            ┌─────────────────────────────────────────────┐
            │                  core/                       │
            │  tipos + interfaces (contratos) + erros      │  ← não depende de nada
            └─────────────────────────────────────────────┘
                 ▲              ▲                ▲
      ┌──────────┘     ┌────────┘        ┌───────┘
┌───────────┐   ┌──────────────┐   ┌──────────────────┐
│ providers │   │   services   │   │     commands     │   ← dependem só de interfaces
│ (Strategy)│   │ (fila/player)│   │ (Command pattern)│
└───────────┘   └──────────────┘   └──────────────────┘
                 ▲
      ┌──────────┴───────────────────────────────┐
      │ infrastructure / voice / discord (adapters)│  ← detalhes: play-dl, @discordjs/voice
      └────────────────────────────────────────────┘
                 ▲
            ┌─────────┐
            │bootstrap│  ← Composition Root: injeta as implementações concretas
            └─────────┘
```

### Princípios SOLID

- **S — Single Responsibility:** `MusicQueue` só gerencia ordem de faixas; `GuildMusicService` só orquestra reprodução; cada `*Command` faz uma coisa; `SearchService` só seleciona a fonte.
- **O — Open/Closed:** adicionar uma nova plataforma de streaming é criar mais um `ISourceProvider` e registrá-lo — nenhum código existente muda.
- **L — Liskov:** qualquer `ISourceProvider`/`IAudioPlayer` é substituível; os testes usam fakes no lugar das implementações reais sem alterar os consumidores.
- **I — Interface Segregation:** interfaces pequenas e focadas (`ICommandContext` expõe só o que um comando precisa; `IAudioPlayer` só o controle de áudio).
- **D — Dependency Inversion:** serviços e comandos dependem de interfaces em `core/`; as implementações concretas (Discord, play-dl, console) são injetadas no `bootstrap`.

### Design Patterns aplicados

| Padrão | Onde | Por quê |
| --- | --- | --- |
| **Strategy** | `ISourceProvider` (YouTube/Spotify/SoundCloud) | Trocar a fonte de resolução sem `if/else` espalhado. |
| **Chain of Responsibility** | `SearchService.selectProvider` | Primeiro provider que "suporta" a entrada trata; senão, fallback. |
| **Command** | `ICommand` + `CommandRegistry` + `CommandDispatcher` | Cada ação é um objeto isolado, testável e registrável. |
| **Factory / Registry** | `QueueManager`, `IVoiceConnector` | Um serviço de música por servidor; criação de conexões de voz desacoplada. |
| **Adapter** | `DiscordMessageHandler`, `DiscordAudioPlayer`, `DiscordVoiceConnector` | Isolam o discord.js do resto do sistema. |
| **Dependency Injection** | `bootstrap.ts` (Composition Root) | Um único lugar conhece as implementações concretas. |

### Estrutura de pastas

```text
src/
├── core/                 # Contratos do domínio (sem dependências externas)
│   ├── interfaces/       # ISourceProvider, IStreamResolver, IAudioPlayer, ICommand, ILogger, IConfig
│   ├── types.ts          # Track, SourceType, LoopMode, AudioStreamType, LogLevel
│   └── errors.ts         # Hierarquia de erros do domínio
├── providers/            # Strategy: resolução de metadados por plataforma
│   ├── youtube/  spotify/  soundcloud/
├── services/             # Regras de negócio: SearchService, MusicQueue, GuildMusicService, QueueManager
├── commands/             # Command pattern: Play, Skip, Stop, Pause, Resume, Queue, NowPlaying, Loop, Shuffle, Help
├── discord/              # Adapters do discord.js: parseCommand, CommandDispatcher, DiscordMessageHandler
├── voice/                # Adapters de @discordjs/voice: DiscordAudioPlayer, DiscordVoiceConnector
├── infrastructure/       # Implementações concretas: ConsoleLogger, loadConfig, PlayDlStreamResolver
├── utils/                # Helpers puros (formatação)
├── bot/MusicBot.ts       # Ciclo de vida do cliente
├── bootstrap.ts          # Composition Root (injeção de dependências)
└── index.ts              # Ponto de entrada
tests/                    # Espelha src/; fakes em tests/helpers
```

---

## Pré-requisitos

- **Node.js 18+**
- **ffmpeg** instalado e no PATH (no Docker já vem incluído).
- Uma aplicação/bot no Discord.
- (Opcional) Credenciais do Spotify para resolver links do Spotify.

---

## Configuração

### 1. Criar o bot no Discord

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Aba **Bot** → **Reset Token** → copie o token (vai em `DISCORD_TOKEN`).
3. Em **Privileged Gateway Intents**, ative **Message Content Intent**.
4. Aba **OAuth2 → URL Generator**: marque os escopos `bot` e `applications.commands`, e as permissões `Send Messages`, `Connect`, `Speak`. Abra a URL gerada para convidar o bot ao seu servidor.

### 2. (Opcional) Credenciais do Spotify

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → **Create app**.
2. Copie **Client ID** e **Client Secret** para `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET`.

### 3. Variáveis de ambiente

```bash
cp .env.example .env
# edite .env com seu token (e credenciais do Spotify, se for usar)
```

---

## Rodando localmente

```bash
npm install        # instala dependências
npm run dev        # executa em modo desenvolvimento (ts-node)

# ou, para produção:
npm run build      # compila para dist/
npm start          # executa dist/index.js
```

### Testes e qualidade

```bash
npm test               # roda os testes (Jest)
npm run test:coverage  # com relatório de cobertura
npm run lint           # ESLint
npm run typecheck      # checagem de tipos sem emitir
```

Cada módulo de regra de negócio possui testes unitários, usando *fakes* em vez de Discord/rede — então a suíte roda rápido e de forma determinística.

---

## Manter rodando 24/7 com PM2 (Windows)

O [PM2](https://pm2.keymetrics.io/) mantém o bot vivo: reinicia sozinho se travar e pode subir junto com o Windows. O projeto já vem com `ecosystem.config.js` e scripts de duplo-clique.

**Instalação única:**

```bash
npm install            # se ainda não rodou
npm install -g pm2     # instala o PM2 globalmente
```

**Uso no dia a dia (duplo-clique):**

- `iniciar.bat` — compila e liga o bot.
- `parar.bat` — desliga o bot.
- `status.bat` — mostra o estado e os logs ao vivo.

Ou pelos scripts npm: `npm run pm2:start`, `npm run pm2:stop`, `npm run pm2:restart`, `npm run pm2:logs`, `npm run pm2:status`.

**Iniciar automaticamente quando o Windows liga:**

```bash
npm install -g pm2-windows-startup
pm2-startup install
npm run pm2:start
pm2 save
```

A partir daí, o bot sobe sozinho no boot. Os logs ficam em `logs/` (e via `pm2 logs musicbot`). Lembre de deixar o PC configurado para **não dormir**, senão a conexão de voz cai.

> Observação: o token continua só no `.env` — o PM2 não guarda segredos; o próprio bot carrega o `.env` ao iniciar.

## Deploy

### Onde hospedar de graça (recomendações)

O **GitHub** é ótimo para o **código** e para a **integração contínua** (o workflow em `.github/workflows/ci.yml` roda lint, types, testes e build a cada push). Mas o GitHub **não executa o bot 24/7** — para manter o processo no ar você precisa de um host de execução. Opções gratuitas ou com camada grátis, em ordem de praticidade:

1. **Railway** — deploy direto do repositório, simples; camada gratuita com créditos mensais. Ótimo para começar.
2. **Fly.io** — roda containers Docker globalmente; camada gratuita generosa. Use o `Dockerfile` incluído.
3. **Render** — *Background Worker* a partir do repo; tem plano gratuito (pode hibernar quando ocioso).
4. **Oracle Cloud Free Tier** — VM *Always Free* (ARM Ampere). É a opção mais "sempre ligada" e gratuita de verdade, ao custo de configurar uma VM você mesmo.
5. **Replit / VPS próprio** — alternativas conforme sua preferência.

> Dica: para um bot de voz, prefira hosts que permitam processos de longa duração e tráfego UDP (voz). Railway, Fly.io e uma VM (Oracle/VPS) atendem bem. Plataformas *serverless* puras (Vercel/Netlify/Lambda) **não** servem para bots de voz persistentes.

### Via Docker (qualquer host)

```bash
docker build -t discord-music-bot .
docker run --env-file .env --restart unless-stopped discord-music-bot
```

O `Dockerfile` é multi-stage, já instala o `ffmpeg` e roda como usuário não-root.

---

## Segurança e restrição de uso

O bot tem duas camadas para impedir que pessoas aleatórias o usem fora dos seus servidores:

1. **Allowlist de servidores (no código).** Defina `ALLOWED_GUILD_IDS` no `.env` com os IDs dos servidores autorizados, separados por vírgula. Com a lista preenchida, o bot **só responde** nesses servidores e **sai automaticamente** de qualquer outro em que for adicionado (mesmo que alguém o convide). Lista vazia = sem restrição.

   ```bash
   ALLOWED_GUILD_IDS=123456789012345678,987654321098765432
   ```

   Para pegar o ID: ative o **Modo Desenvolvedor** (Discord → Configurações → Avançado), clique com o botão direito no servidor → **Copiar ID**.

2. **Bot privado (no Discord Developer Portal).** Na aba **Bot**, desative **Public Bot**. Assim, apenas você consegue adicionar o bot a servidores — ninguém mais pode convidá-lo. Recomendado para uso pessoal.

Notas de segurança da hospedagem em casa: o bot faz apenas **conexões de saída** para o Discord — não abre portas no seu roteador, não expõe nenhum serviço na internet e não precisa de IP fixo. O token fica só no `.env` (que está no `.gitignore`, fora do controle de versão). Mantenha o Node atualizado e nunca compartilhe o token; se vazar, use **Reset Token** no portal.

## Como estender

Adicionar uma nova fonte de streaming (ex.: Bandcamp):

1. Crie `src/providers/bandcamp/BandcampProvider.ts` implementando `ISourceProvider`.
2. Registre-o na lista `providers` em `src/bootstrap.ts`.
3. Adicione testes em `tests/providers/`.

Nenhuma outra parte do código precisa mudar (Open/Closed).

Adicionar um novo comando:

1. Crie `src/commands/MeuComando.ts` implementando `ICommand`.
2. Registre-o no `CommandRegistry` em `src/bootstrap.ts`.

---

## Solução de problemas

**`npm install` falha tentando compilar `@discordjs/opus` / "Could not find any Python".**
Isso ocorre quando o Opus precisa ser compilado do zero (Node muito recente sem binário pronto e sem Python/Build Tools). O projeto usa **`opusscript`** (Opus em JS puro) justamente para evitar isso — não precisa de Python nem de compilador. Se você pegou esse erro com uma versão antiga do `package.json`, limpe e reinstale:

```powershell
# No PowerShell, dentro da pasta do projeto. Feche antes o bot e o editor.
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install
```

**`EBUSY: resource busy or locked` em `ffmpeg-static` durante o install.**
Algum programa está segurando o arquivo (antivírus, um `node` ainda rodando, ou o editor). Feche o bot/editor, pause o antivírus na pasta do projeto se necessário, e rode o `npm install` de novo. Em último caso, reinicie o PC e tente novamente.

**Quero usar Node LTS.** Opcional, mas seguro: instalar o **Node 20 ou 22 LTS** evita incompatibilidades com pacotes muito novos. Com o `opusscript`, porém, o Node 24 também funciona.

## Licença

[MIT](./LICENSE)
