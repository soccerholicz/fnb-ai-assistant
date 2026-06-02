import { buildServer } from './server';

const port = Number(process.env.PORT ?? 8080);
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = buildServer({ corsOrigins, logger: true });

app
  .listen({ port, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`API listening on ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
