const { redisGetJSON, redisSetJSON } = require('./_redis');

// Seed usado apenas na primeira chamada, para migrar o time que já existia
// no HTML antigo para dentro do banco. Depois disso o banco manda.
const SEED_USERS = [
  { usuario: 'ecom19', nome: 'Miguel 2', setor: 'mercado', senha: 'ecom19@gmc' },
  { usuario: 'ecom10', nome: 'Thiago', setor: 'mercado', senha: 'ecom10@gmc' },
  { usuario: 'ecom6', nome: 'Vitória', setor: 'operacional', senha: 'ecom6@gmc' },
  { usuario: 'ecom16', nome: 'Miguel', setor: 'anuncios', senha: 'ecom16@gmc' },
  { usuario: 'ecom2', nome: 'Leonardo', setor: 'mercado', senha: 'ecom2@gmc' },
  { usuario: 'ecom12', nome: 'Alex', setor: 'anuncios', senha: 'ecom12@gmc' },
  { usuario: 'ecom18', nome: 'Laize', setor: 'prevenda', senha: 'ecom18@gmc' },
  { usuario: 'ecom14', nome: 'Felipe', setor: 'mercado', senha: 'ecom14@gmc' },
];

const SENHA_ADM = process.env.ACLON_ADM_SENHA || 'adm@2026';

async function getUsers() {
  let users = await redisGetJSON('aclon_users', null);
  if (!users) {
    users = SEED_USERS;
    await redisSetJSON('aclon_users', users);
  }
  return users;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  const usuario = (body.usuario || '').trim();
  const senha = body.senha || '';

  if (!usuario) {
    res.status(400).json({ ok: false, erro: 'Informe seu usuário.' });
    return;
  }

  try {
    if (usuario.toLowerCase() === 'adm' && senha === SENHA_ADM) {
      res.status(200).json({
        ok: true,
        user: { usuario: 'adm', nome: 'ADM', setor: 'adm', isAdm: true },
      });
      return;
    }

    const users = await getUsers();
    const found = users.find(
      (u) =>
        (u.usuario.toLowerCase() === usuario.toLowerCase() ||
          u.nome.trim().toLowerCase() === usuario.trim().toLowerCase()) &&
        u.senha === senha
    );

    if (!found) {
      res.status(200).json({ ok: false, erro: 'Usuário ou senha incorretos.' });
      return;
    }

    res.status(200).json({
      ok: true,
      user: { usuario: found.usuario, nome: found.nome, setor: found.setor, isAdm: false },
    });
  } catch (e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
};
