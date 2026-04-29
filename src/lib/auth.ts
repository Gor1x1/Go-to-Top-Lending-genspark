/**
 * Auth helpers for admin panel
 * Uses Web Crypto API (Cloudflare Workers compatible)
 *
 * JWT_SECRET is read from Cloudflare environment (set via: wrangler pages secret put JWT_SECRET)
 * Falls back to the default value when the secret is not configured (local dev / first deploy)
 */

const FALLBACK_JWT_SECRET = 'gtt-admin-jwt-secret-2026';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(env?: any): string {
  return (env?.JWT_SECRET as string) || FALLBACK_JWT_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export async function createToken(userId: number, role: string, env?: any): Promise<string> {
  const secret = getSecret(env);
  const payload = {
    sub: userId,
    role: role,
    exp: Date.now() + TOKEN_EXPIRY,
    iat: Date.now()
  };
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payloadB64 = btoa(JSON.stringify(payload));
  const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export async function verifyToken(token: string, env?: any): Promise<{ sub: number; role: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const secret = getSecret(env);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signatureInput));
    
    if (!valid) return null;
    
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) return null;
    
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export async function initDefaultAdmin(db: D1Database): Promise<void> {
  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind('admin').first();
  if (!existing) {
    // Default password — admin should change it immediately via Settings → Change Password
    const DEFAULT_ADMIN_PASSWORD = 'gototop2026';
    const hash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    await db.prepare('INSERT INTO users (username, password_hash, role, display_name, is_active) VALUES (?, ?, ?, ?, 1)')
      .bind('admin', hash, 'main_admin', 'Администратор')
      .run();
  } else if (existing) {
    // Migrate old 'admin' role to 'main_admin'
    const user = await db.prepare('SELECT role FROM users WHERE username = ?').bind('admin').first();
    if (user && user.role === 'admin') {
      await db.prepare("UPDATE users SET role = 'main_admin' WHERE username = 'admin'").run();
    }
  }
}

export function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}
