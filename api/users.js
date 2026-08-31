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
      const { usuario, nome, setor, senha } = body.novo || {};
      if (!usuario || !nome || !setor || !senha) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const users = await redisGetJSON('aclon_users', []);
      if (users.some((u) => u.usuario.toLowerCase() === usuario.toLowerCase())) {
        res.status(409).json({ error: 'usuário já existe' });
        return;
      }
      users.push({ usuario, nome, setor, senha });
      await redisSetJSON('aclon_users', users);
      res.status(200).json({ ok: true, users: semSenha(users) });
      return;
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      if (body.senha_adm !== SENHA_ADM) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
      const { usuario, setor } = body;
      if (!usuario || !setor) {
        res.status(400).json({ error: 'dados incompletos' });
        return;
      }
      const users = await redisGetJSON('aclon_users', []);
      const idx = users.findIndex((u) => u.usuario === usuario);
      if (idx === -1) {
        res.status(404).json({ error: 'usuário não encontrado' });
        return;
      }
      users[idx].setor = setor;
      await redisSetJSON('aclon_users', users);
      res.status(200).json({ ok: true, users: semSenha(users) });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
