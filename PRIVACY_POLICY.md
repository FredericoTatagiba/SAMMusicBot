# Política de Privacidade

**Última atualização:** 21 de junho de 2026

Este bot de música para Discord ("o Bot") é um projeto **pessoal e não comercial**. Esta política descreve, de forma transparente, quais dados o Bot processa e como. O princípio é simples: **coleta mínima e nenhum armazenamento permanente**.

## 1. Dados processados

Para funcionar, o Bot processa, de forma transitória:

- **Conteúdo dos comandos** enviados a ele (ex.: `!play nome da música`). O Bot lê mensagens apenas para identificar e executar comandos com o prefixo configurado; mensagens comuns são ignoradas.
- **ID do servidor (guild)** — para saber em qual servidor operar e aplicar a lista de servidores autorizados.
- **ID do usuário** que solicitou uma faixa — apenas para associar a faixa a quem a pediu, durante a sessão.
- **ID do canal de voz** — para conectar e reproduzir o áudio.

O Bot **não** coleta mensagens privadas (DMs), e-mails, senhas, nem qualquer dado sensível.

## 2. Armazenamento e retenção

- **Nada é gravado em banco de dados.** A fila de reprodução existe apenas na **memória** e é descartada quando o Bot reinicia, sai do canal ou é desligado.
- O Bot pode gerar **logs operacionais temporários** (ex.: qual comando foi executado, IDs de servidor/usuário) para diagnóstico. Esses logs ficam apenas no ambiente onde o Bot roda e não são publicados.

## 3. Compartilhamento de dados

O responsável **não vende, aluga nem compartilha** quaisquer dados. O Bot interage com APIs de terceiros estritamente para funcionar:

- **Discord** — para receber comandos e transmitir áudio;
- **YouTube, Spotify e SoundCloud** — para localizar e reproduzir o conteúdo solicitado.

O uso desses serviços está sujeito às respectivas políticas de privacidade.

## 4. Seus direitos

Você pode interromper qualquer processamento a qualquer momento **removendo o Bot do servidor**. Como nenhum dado é retido de forma permanente, a remoção encerra o tratamento.

## 5. Idade mínima

O uso do Discord e, portanto, do Bot, segue os requisitos de idade dos [Termos de Serviço do Discord](https://discord.com/terms).

## 6. Alterações nesta política

Esta política pode ser atualizada a qualquer momento. A versão vigente é sempre a publicada neste repositório.

## 7. Contato

Dúvidas sobre privacidade podem ser encaminhadas ao responsável pelo Bot: **SEU_EMAIL_OU_CONTATO_DISCORD**.
