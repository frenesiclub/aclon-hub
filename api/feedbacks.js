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

// Rodadas de feedback individual (1:1) — mesma estrutura da planilha:
// pontos fortes, gargalo, causas (gestora/colaborador), ação combinada,
// status da ação anterior, regra 80/20, observações. Só admin.
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const feedbacks = await redisGetJSON('aclon_feedbacks', []);
      res.status(200).json({ feedbacks });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const {
        colaborador,
        data,
        duracaoMinutos,
        pontosFortes,
        gargalo,
        categoriaGargalo,
        causaGestora,
        causaColaborador,
        acaoCombinada,
        statusAcaoAnterior,
        regra8020,
        observacoes,
      } = body.novo || {};
      if (!colaborador || !data) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const feedbacks = await redisGetJSON('aclon_feedbacks', []);
      const novo = {
        id: genId(),
        colaborador,
        data,
        duracaoMinutos: duracaoMinutos || null,
        pontosFortes: pontosFortes || '',
        gargalo: gargalo || '',
        categoriaGargalo: categoriaGargalo || '',
        causaGestora: causaGestora || '',
        causaColaborador: causaColaborador || '',
        acaoCombinada: acaoCombinada || '',
        statusAcaoAnterior: statusAcaoAnterior || '',
        regra8020: !!regra8020,
        observacoes: observacoes || '',
        criadoEm: new Date().toISOString(),
      };
      feedbacks.push(novo);
      await redisSetJSON('aclon_feedbacks', feedbacks);
      res.status(200).json({ ok: true, feedbacks });
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
      let feedbacks = await redisGetJSON('aclon_feedbacks', []);
      feedbacks = feedbacks.filter((f) => f.id !== id);
      await redisSetJSON('aclon_feedbacks', feedbacks);
      res.status(200).json({ ok: true, feedbacks });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
