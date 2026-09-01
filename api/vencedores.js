const { redisGetJSON, redisSetJSON } = require('./_redis');

const SENHA_ADM = process.env.ACLON_ADM_SENHA || 'adm@2026';

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  return body || {};
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Registro manual de vencedores de meses anteriores ao uso estruturado do
// hub (ex: retroativo a jan/2026) — só nome e categoria, sem exigir as
// notas 1-5 que provavelmente não existem retroativamente.
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const vencedores = await redisGetJSON('aclon_vencedores', []);
      res.status(200).json({ vencedores });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { mes, categoria, nome } = body.novo || {};
      if (!mes || !categoria || !nome) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const vencedores = await redisGetJSON('aclon_vencedores', []);
      const novo = { id: genId(), mes, categoria, nome, criadoEm: new Date().toISOString() };
      vencedores.push(novo);
      await redisSetJSON('aclon_vencedores', vencedores);
      res.status(200).json({ ok: true, vencedores });
      return;
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { id } = body;
      if (!id) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      let vencedores = await redisGetJSON('aclon_vencedores', []);
      vencedores = vencedores.filter((v) => v.id !== id);
      await redisSetJSON('aclon_vencedores', vencedores);
      res.status(200).json({ ok: true, vencedores });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
