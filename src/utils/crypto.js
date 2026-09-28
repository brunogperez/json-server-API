import crypto from 'crypto';

/**
 * Cifrado simétrico AES-256-GCM para credenciales sensibles en reposo.
 *
 * Formato del valor cifrado: `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 * El prefijo `enc:v1:` permite distinguir valores ya cifrados de texto plano
 * (idempotencia: no re-ciframos un valor ya cifrado).
 *
 * La clave se toma de `process.env.ENCRYPTION_KEY` (64 hex chars = 32 bytes).
 * Si no está configurada, el cifrado es no-op (devuelve el texto plano) y se
 * emite un warning — útil en dev/test, pero en producción la clave es
 * obligatoria.
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

let warned = false;

const getKey = () => {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    if (!warned) {
      console.warn('⚠️  ENCRYPTION_KEY no configurada: credenciales se guardan SIN cifrar.');
      warned = true;
    }
    return null;
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser 64 caracteres hex (32 bytes).');
  }
  return key;
};

export const isEncrypted = (value) =>
  typeof value === 'string' && value.startsWith(PREFIX);

export const encrypt = (plainText) => {
  if (plainText == null || plainText === '') return plainText;
  if (isEncrypted(plainText)) return plainText; // ya cifrado, idempotente
  const key = getKey();
  if (!key) return plainText; // sin clave → no-op
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

export const decrypt = (value) => {
  if (!isEncrypted(value)) return value; // texto plano o null → tal cual
  const key = getKey();
  if (!key) return value;
  try {
    const [, , ivB64, tagB64, dataB64] = value.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Si falla (clave equivocada / dato corrupto) devolvemos el valor crudo
    // en vez de tirar 500: el caller decide.
    return value;
  }
};

/**
 * Cifra/descifra todos los valores de un objeto plano o Map de credenciales.
 * Devuelve un objeto plano nuevo (no muta el input).
 */
export const encryptCredentials = (creds) => mapCredentials(creds, encrypt);
export const decryptCredentials = (creds) => mapCredentials(creds, decrypt);

const mapCredentials = (creds, fn) => {
  if (!creds) return creds;
  const out = {};
  const entries = creds instanceof Map ? creds.entries() : Object.entries(creds);
  for (const [k, v] of entries) {
    out[k] = typeof v === 'string' ? fn(v) : v;
  }
  return out;
};
