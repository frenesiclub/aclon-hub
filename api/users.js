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

function semSenha(users) {
  return users.map(({ senha, ...rest }) => rest);
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const users = await redisGetJSON('aclon_users', []);
      res.status(200).json({ users: semSenha(users) });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { usuario, nome, setor, senha, lider, cargo, dataInicio } = body.novo || {};
      if (!usuario || !nome || !setor || !senha) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const users = await redisGetJSON('aclon_users', []);
      if (users.some((u) => u.usuario.toLowerCase() === usuario.toLowerCase())) {
        res.status(409).json({ error: 'usuário já existe' });
        return;
      }
      users.push({
        usuario,
        nome,
        setor,
        senha,
        lider: !!lider,
        cargo: cargo || '',
        dataInicio: dataInicio || '',
        ferias: [],
      });
      await redisSetJSON('aclon_users', users);
      res.status(200).json({ ok: true, users: semSenha(users) });
      return;
    }

    if (req.method === 'PATCH') {
      // Ações administrativas de equipe continuam só para admin — Thiago
      // e Vitória não gerenciam cadastro de equipe.
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { usuario, nome, setor, lider, cargo, dataInicio, feriasAdd, feriasRemoveId } = body;
      if (!usuario) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const users = await redisGetJSON('aclon_users', []);
      const idx = users.findIndex((u) => u.usuario === usuario);
      if (idx === -1) {
        res.status(404).json({ error: 'usuário não encontrado' });
        return;
      }
      if (nome !== undefined && nome.trim()) users[idx].nome = nome.trim();
      if (setor !== undefined) users[idx].setor = setor;
      if (lider !== undefined) users[idx].lider = !!lider;
      if (cargo !== undefined) users[idx].cargo = cargo;
      if (dataInicio !== undefined) users[idx].dataInicio = dataInicio;
      if (!Array.isArray(users[idx].ferias)) users[idx].ferias = [];
      if (feriasAdd && feriasAdd.inicio && feriasAdd.fim) {
        users[idx].ferias.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          inicio: feriasAdd.inicio,
          fim: feriasAdd.fim,
        });
      }
      if (feriasRemoveId) {
        users[idx].ferias = users[idx].ferias.filter((f) => f.id !== feriasRemoveId);
      }
      await redisSetJSON('aclon_users', users);
      res.status(200).json({ ok: true, users: semSenha(users) });
      return;
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { usuario } = body;
      if (!usuario) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      let users = await redisGetJSON('aclon_users', []);
      users = users.filter((u) => u.usuario !== usuario);
      await redisSetJSON('aclon_users', users);
      res.status(200).json({ ok: true, users: semSenha(users) });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
