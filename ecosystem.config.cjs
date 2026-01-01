// PM2 Ecosystem Configuration for Itinerator
// Usage: pm2 start ecosystem.config.cjs
// Stop: pm2 stop all
// Status: pm2 status
// Logs: pm2 logs

module.exports = {
  apps: [
    {
      name: 'itinerator-dev',
      cwd: '/Users/masa/Projects/itinerator',
      script: './start-dev.sh',
      interpreter: '/bin/bash',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    },
    {
      name: 'tripbot-tunnel',
      script: 'ngrok',
      args: 'http 5180 --domain=tripbot.ngrok.io --log=stdout',
      autorestart: true,
      max_restarts: 3,
      restart_delay: 5000,
      error_file: '/tmp/ngrok-error.log',
      out_file: '/tmp/ngrok-out.log'
    }
  ]
};
