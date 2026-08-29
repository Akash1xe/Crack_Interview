import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const port = Number(process.env.PORT || 4000);
const contentUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';
const sessionUrl = process.env.SESSION_SERVICE_URL || 'http://localhost:4002';
const devToken = process.env.DEV_TOKEN || 'dev-token';

app.use(cors());
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ service: 'gateway', ok: true }));

app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token !== devToken) {
    return res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
  }
  req.headers['x-user-id'] = 'dev-user';
  next();
});

app.use('/api/content', createProxyMiddleware({
  target: contentUrl,
  changeOrigin: true
}));

app.use('/api/sessions', createProxyMiddleware({
  target: sessionUrl,
  changeOrigin: true,
  pathRewrite: path => '/sessions' + path
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(502).json({ success: false, data: null, error: 'Gateway upstream error' });
});

app.listen(port, () => console.log(`Gateway listening on :${port}`));
