"use strict"
/**
 * PM2 Ecosystem Configuration
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
  apps: [
    {
      name: "folio-server",
      script: "dist/index.mjs",
      cwd: "/opt/folio/server/current",

      // Instances & Execution mode
      instances: 2, // Number of instances (use 'max' for all CPU cores)
      exec_mode: "cluster", // Enable cluster mode for load balancing

      // Environment variables
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      },
      env_staging: {
        NODE_ENV: "staging",
        PORT: 3001
      },

      // Restart behavior
      max_memory_restart: "500M", // Restart if memory exceeds 500MB
      restart_delay: 3000, // Wait 3 seconds before restarting
      max_restarts: 10, // Maximum number of consecutive restarts
      min_uptime: "10s", // Minimum uptime to consider app started

      // Logs
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/opt/folio/server/shared/logs/error.log",
      out_file: "/opt/folio/server/shared/logs/out.log",
      merge_logs: true,
      log_type: "json",

      // Watch (disabled in production)
      watch: false,
      ignore_watch: ["node_modules", "logs", ".git"],

      // Graceful shutdown
      kill_timeout: 5000, // Time to wait before forcing kill
      wait_ready: true, // Wait for process.send('ready')
      listen_timeout: 10_000, // Time to wait for listen event

      // Source maps for better error stack traces
      source_map_support: true,

      // Auto-restart on file changes (only for development)
      autorestart: true,

      // Cluster workers parse Node flags before PM2 changes to this app's cwd.
      node_args:
        "--env-file=/opt/folio/server/current/.env --enable-source-maps"
    },
    {
      name: "folio-collab",
      script: "dist/collab/index.mjs",
      cwd: "/opt/folio/server/current",

      // Stateful WebSocket server: each Y.Doc room lives in this process's
      // memory, so — unlike folio-server above — this can't run as a
      // cluster of >1 instance without a shared backplane. Start at 1;
      // add @hocuspocus/extension-redis (see apps/server/src/collab/server.ts)
      // the day this needs to scale past that, don't just bump `instances`.
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "development",
        COLLAB_PORT: 3002
      },
      env_production: {
        NODE_ENV: "production",
        COLLAB_PORT: 3002
      },
      env_staging: {
        NODE_ENV: "staging",
        COLLAB_PORT: 3003
      },

      max_memory_restart: "500M",
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",

      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/opt/folio/server/shared/logs/collab-error.log",
      out_file: "/opt/folio/server/shared/logs/collab-out.log",
      merge_logs: true,
      log_type: "json",

      watch: false,
      ignore_watch: ["node_modules", "logs", ".git"],

      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10_000,

      source_map_support: true,
      autorestart: true,
      node_args:
        "--env-file=/opt/folio/server/current/.env --enable-source-maps"
    }
  ]
}
