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

// Notas soltas de preparação, por colaborador — o "embasamento" que a
// gestora vai acumulando ANTES de abrir uma rodada de feedback. Não têm
// data de rodada nem estrutura fixa, só texto livre. Só admin.
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const notas = await redisGetJSON('aclon_notas_feedback', []);
      res.status(200).json({ notas });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { colaborador, pontosFortes, gargalo, categoriaGargalo, causaGestora } = body.novo || {};
      if (!colaborador || !(pontosFortes || gargalo || categoriaGargalo || causaGestora)) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const notas = await redisGetJSON('aclon_notas_feedback', []);
      const novo = {
        id: genId(),
        colaborador,
        pontosFortes: pontosFortes || '',
        gargalo: gargalo || '',
        categoriaGargalo: categoriaGargalo || '',
        causaGestora: causaGestora || '',
        criadoEm: new Date().toISOString(),
      };
      notas.push(novo);
      await redisSetJSON('aclon_notas_feedback', notas);
      res.status(200).json({ ok: true, notas });
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
      let notas = await redisGetJSON('aclon_notas_feedback', []);
      notas = notas.filter((n) => n.id !== id);
      await redisSetJSON('aclon_notas_feedback', notas);
      res.status(200).json({ ok: true, notas });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
