import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use('/api', apiRouter);

app.use((_, res) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint no encontrado.'
    }
  });
});

const port = Number.parseInt(process.env.PORT || '3001', 10);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}/api`);
});
