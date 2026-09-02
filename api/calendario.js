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

// Eventos do calendário: feriado | home_office | reuniao | reposicao.
// Férias NÃO entram aqui — são lidas direto do cadastro de colaborador
// (Gestão de Pessoas), pra não duplicar a mesma informação em dois lugares.
// Ver (GET) é liberado pra qualquer colaborador logado; criar/editar/excluir
// é só admin ou líder (Ana, Thiago, Vitória).
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
      const eventos = await redisGetJSON('aclon_calendario', []);
      res.status(200).json({ eventos });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const auth = await podeGerenciar(body);
      if (!auth.ok) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { data, tipo, titulo, setores, statusReposicao, observacao } = body.novo || {};
      if (!data || !tipo || !titulo) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const eventos = await redisGetJSON('aclon_calendario', []);
      const novo = {
        id: genId(),
        data,
        tipo, // feriado | home_office | reuniao | reposicao
        titulo,
        setores: Array.isArray(setores) && setores.length ? setores : ['geral'],
        statusReposicao: tipo === 'reposicao' ? statusReposicao || 'aguardando' : null,
        observacao: observacao || '',
        criadoPor: auth.criadoPor,
        criadoEm: new Date().toISOString(),
      };
      eventos.push(novo);
      await redisSetJSON('aclon_calendario', eventos);
      res.status(200).json({ ok: true, eventos });
      return;
    }

    if (req.method === 'PATCH') {
      // Edição completa do evento (exceto tipo, que não muda depois de
      // criado — se precisar trocar o tipo, exclui e cria de novo), e
      // também usado pra avançar o status de um evento de reposição.
      const body = parseBody(req);
      const auth = await podeGerenciar(body);
      if (!auth.ok) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { id, data, titulo, setores, statusReposicao, observacao } = body;
      if (!id) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const eventos = await redisGetJSON('aclon_calendario', []);
      const idx = eventos.findIndex((e) => e.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'evento não encontrado' });
        return;
      }
      if (data !== undefined) eventos[idx].data = data;
      if (titulo !== undefined) eventos[idx].titulo = titulo;
      if (setores !== undefined) {
        eventos[idx].setores = Array.isArray(setores) && setores.length ? setores : ['geral'];
      }
      if (statusReposicao !== undefined) eventos[idx].statusReposicao = statusReposicao;
      if (observacao !== undefined) eventos[idx].observacao = observacao;
      await redisSetJSON('aclon_calendario', eventos);
      res.status(200).json({ ok: true, eventos });
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
      let eventos = await redisGetJSON('aclon_calendario', []);
      eventos = eventos.filter((e) => e.id !== id);
      await redisSetJSON('aclon_calendario', eventos);
      res.status(200).json({ ok: true, eventos });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
