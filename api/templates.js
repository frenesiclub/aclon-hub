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

// "Demandas do mês" são padrões fixos que orientam o time (ex: "toda sexta,
// campanhas de fim de semana"). Só admin ou líder cadastra/edita/exclui.
// Qualquer colaborador pode duplicar uma pra si — isso acontece via o
// endpoint normal de cards (POST /api/cards), não aqui.
async function podeGerenciar(body) {
  if (body.senha_adm === SENHA_ADM) return { ok: true, criadoPor: 'ADM' };
  const { usuario, senha } = body;
  if (!usuario || !senha) return { ok: false };
  const users = await redisGetJSON('aclon_users', []);
  const found = users.find((u) => u.usuario === usuario && u.senha === senha && u.lider);
  if (!found) return { ok: false };
  return { ok: true, criadoPor: found.nome };
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const templates = await redisGetJSON('aclon_templates', []);
      res.status(200).json({ templates });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const auth = await podeGerenciar(body);
      if (!auth.ok) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { titulo, descricao, setor, tipo, prioridade } = body.novo || {};
      if (!titulo || !setor) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const templates = await redisGetJSON('aclon_templates', []);
      const novo = {
        id: genId(),
        titulo,
        descricao: descricao || '',
        setor,
        tipo: tipo || 'semanal',
        prioridade: prioridade || 'media',
        criadoPor: auth.criadoPor,
        criadoEm: new Date().toISOString(),
      };
      templates.push(novo);
      await redisSetJSON('aclon_templates', templates);
      res.status(200).json({ ok: true, templates });
      return;
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const auth = await podeGerenciar(body);
      if (!auth.ok) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { id, titulo, descricao, tipo, prioridade } = body;
      if (!id) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const templates = await redisGetJSON('aclon_templates', []);
      const idx = templates.findIndex((t) => t.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'não encontrado' });
        return;
      }
      if (titulo !== undefined) templates[idx].titulo = titulo;
      if (descricao !== undefined) templates[idx].descricao = descricao;
      if (tipo !== undefined) templates[idx].tipo = tipo;
      if (prioridade !== undefined) templates[idx].prioridade = prioridade;
      await redisSetJSON('aclon_templates', templates);
      res.status(200).json({ ok: true, templates });
      return;
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const auth = await podeGerenciar(body);
      if (!auth.ok) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { id } = body;
      if (!id) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      let templates = await redisGetJSON('aclon_templates', []);
      templates = templates.filter((t) => t.id !== id);
      await redisSetJSON('aclon_templates', templates);
      res.status(200).json({ ok: true, templates });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
