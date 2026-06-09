module.exports = {
  apps: [{
    name: 'berkeley-command-center-api',
    script: 'artifacts/api-server/dist/index.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5050
    },
    // Loads variables from .env file securely
    env_file: '.env'
  }]
};
