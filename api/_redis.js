// Helper compartilhado: fala com o Redis (Upstash) via REST API.
// Cobre os dois formatos de nome de variável que o Vercel pode ter criado
// (com ou sem o prefixo personalizado "ARMAZENAR").
const REDIS_URL =
  process.env.KV_REST_API_URL ||
  process.env.ARMAZENAR_KV_REST_API_URL ||
  process.env.REDIS_REST_URL;

const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.ARMAZENAR_KV_REST_API_TOKEN ||
  process.env.REDIS_REST_TOKEN;

async function redisCmd(...args) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error(
      'Variáveis do Redis não encontradas. Confirme em Vercel > aclon-hub > Settings > Environment Variables se KV_REST_API_URL e KV_REST_API_TOKEN existem (podem estar com outro prefixo).'
    );
  }
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function redisGetJSON(key, fallback) {
  const raw = await redisCmd('GET', key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

async function redisSetJSON(key, value) {
  return redisCmd('SET', key, JSON.stringify(value));
}

module.exports = { redisCmd, redisGetJSON, redisSetJSON };
