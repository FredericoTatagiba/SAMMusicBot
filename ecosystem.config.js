// Configuração do PM2 (https://pm2.keymetrics.io/).
// O app carrega o .env sozinho (via dotenv), então o token NÃO fica aqui.
module.exports = {
  apps: [
    {
      name: 'musicbot',
      script: 'dist/index.js',
      // Bot de voz deve ter UMA instância (cluster quebraria as conexões).
      instances: 1,
      exec_mode: 'fork',
      // Reinício automático em caso de queda.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '15s',
      restart_delay: 5000,
      // Reinicia se passar de 400 MB (proteção contra vazamento).
      max_memory_restart: '400M',
      watch: false,
      time: true,
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
