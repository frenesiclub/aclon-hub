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

// Quem pode criar demanda: admin (senha_adm) ou um colaborador marcado
// como "líder" (usuario+senha validados contra o cadastro). Devolve o
// nome de quem criou, para a tag "Delegado por".
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
      const cards = await redisGetJSON('aclon_cards', []);
      res.status(200).json({ cards });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const auth = await podeGerenciar(body);
      if (!auth.ok) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const {
        titulo,
        descricao,
        setor,
        tipo,
        responsavel,
        prioridade,
        prazoInicio,
        prazo,
        links,
      } = body.novo || {};
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
        tipo: tipo || 'esporadica', // diario | semanal | quinzenal | esporadica
        responsavel,
        prioridade: prioridade || 'media', // urgente | alta | media | baixa
        status: 'a_fazer',
        prazoInicio: prazoInicio || null,
        prazo: prazo || null, // prazo de término
        links: links || '',
        observacao: '',
        criadoPor: auth.criadoPor,
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
      const { id, status, observacao, edit } = body;
      if (!id) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const cards = await redisGetJSON('aclon_cards', []);
      const idx = cards.findIndex((c) => c.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'card não encontrado' });
        return;
      }
      // Mover status e escrever observação: ação do dia a dia, sem senha —
      // qualquer colaborador logado pode fazer isso na sua própria demanda.
      if (status !== undefined) {
        cards[idx].status = status;
        cards[idx].concluidoEm = status === 'concluido' ? new Date().toISOString() : null;
      }
      if (observacao !== undefined) {
        cards[idx].observacao = observacao;
      }
      // Editar os dados da demanda (título, prazos, responsável etc.) exige
      // ser admin ou líder.
      if (edit) {
        const auth = await podeGerenciar(body);
        if (!auth.ok) {
          res.status(401).json({ error: 'não autorizado' });
          return;
        }
        const permitidos = [
          'titulo',
          'descricao',
          'links',
          'tipo',
          'prioridade',
          'responsavel',
          'prazoInicio',
          'prazo',
          'setor',
        ];
        for (const campo of permitidos) {
          if (edit[campo] !== undefined) cards[idx][campo] = edit[campo];
        }
      }
      await redisSetJSON('aclon_cards', cards);
      res.status(200).json({ ok: true, cards });
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
      let cards = await redisGetJSON('aclon_cards', []);
      cards = cards.filter((c) => c.id !== id);
      await redisSetJSON('aclon_cards', cards);
      res.status(200).json({ ok: true, cards });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
