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

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const cards = await redisGetJSON('aclon_cards', []);
      res.status(200).json({ cards });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { titulo, descricao, setor, tipo, responsavel, prioridade, prazo } = body.novo || {};
      if (!titulo || !setor || !responsavel) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const cards = await redisGetJSON('aclon_cards', []);
      const novo = {
        id: genId(),
        titulo,
        descricao: descricao || '',
        setor,
        tipo: tipo || 'esporadica',
        responsavel,
        prioridade: prioridade || 'media',
        status: 'a_fazer',
        prazo: prazo || null,
        criadoEm: new Date().toISOString(),
        concluidoEm: null,
      };
      cards.push(novo);
      await redisSetJSON('aclon_cards', cards);
      res.status(200).json({ ok: true, cards });
      return;
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const { id, status } = body;
      if (!id || !status) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const cards = await redisGetJSON('aclon_cards', []);
      const idx = cards.findIndex((c) => c.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'card não encontrado' });
        return;
      }
      cards[idx].status = status;
      cards[idx].concluidoEm = status === 'concluido' ? new Date().toISOString() : null;
      await redisSetJSON('aclon_cards', cards);
      res.status(200).json({ ok: true, cards });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
