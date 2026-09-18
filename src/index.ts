import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ event: 'server_started', host: config.host, port: config.port }));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(error => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
      process.exit();
    });
  });
}
