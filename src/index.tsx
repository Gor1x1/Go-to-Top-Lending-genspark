/**
 * Main application entry point — route aggregator
 * 
 * All routes are split into modular files under ./routes/
 * This file only handles imports and route registration.
 */
import { Hono } from 'hono'
import adminApi from './api/admin'
import { getAdminHTML } from './admin/panel'

// Route modules
import { register as registerPublicApi } from './routes/public-api'
import { register as registerPdf } from './routes/pdf'
import { register as registerSeedApi } from './routes/seed-api'
import { register as registerLanding } from './routes/landing'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// ===== PUBLIC API ROUTES =====
registerPublicApi(app)

// ===== PDF ROUTES =====
registerPdf(app)

// ===== ADMIN API =====
app.route('/api/admin', adminApi)

// ===== ADMIN PANEL UI =====
app.get('/admin', (c) => {
  return c.html(getAdminHTML())
})

// ===== SEED FROM SITE =====
registerSeedApi(app)

// ===== LANDING PAGE (main HTML) =====
registerLanding(app)

// ===== LANGUAGE ROUTES =====
app.get('/am', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/';
  url.searchParams.set('lang', 'am');
  const newReq = new Request(url.href, c.req.raw);
  return app.fetch(newReq, c.env, c.executionCtx);
})

app.get('/ru', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/';
  url.searchParams.set('lang', 'ru');
  const newReq = new Request(url.href, c.req.raw);
  return app.fetch(newReq, c.env, c.executionCtx);
})

export default app
