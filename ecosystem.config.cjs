module.exports = {
  apps: [
    {
      name: 'odds-api',
      script: 'src/server.js',
      cwd: '.',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'odds-frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 4173',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
