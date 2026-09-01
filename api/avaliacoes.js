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

// Avaliação mensal (1-5) por colaborador, em 4 categorias fixas:
// qualidade, produtividade, proatividade, equipe. Só admin lança/edita.
// Upsert em lote: reenviar o mesmo mês+colaborador substitui a nota anterior.
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const avaliacoes = await redisGetJSON('aclon_avaliacoes', []);
      res.status(200).json({ avaliacoes });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { mes, notas } = body;
      if (!mes || !Array.isArray(notas) || !notas.length) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      let avaliacoes = await redisGetJSON('aclon_avaliacoes', []);
      const usuariosEnviados = notas.map((n) => n.colaborador);
      avaliacoes = avaliacoes.filter((a) => !(a.mes === mes && usuariosEnviados.includes(a.colaborador)));
      const novas = notas.map((n) => ({
        id: mes + '_' + n.colaborador,
        mes,
        colaborador: n.colaborador,
        qualidade: Number(n.qualidade) || 0,
        produtividade: Number(n.produtividade) || 0,
        proatividade: Number(n.proatividade) || 0,
        equipe: Number(n.equipe) || 0,
        atualizadoEm: new Date().toISOString(),
      }));
      avaliacoes = avaliacoes.concat(novas);
      await redisSetJSON('aclon_avaliacoes', avaliacoes);
      res.status(200).json({ ok: true, avaliacoes });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
