// ===========================
// IF-SOCIAL - BACKEND (server.js)
// ===========================
// Este arquivo é o servidor da aplicação
// Ele recebe requisições do app.js e responde com dados do banco de dados

// Importa as bibliotecas necessárias
const express = require('express'); // Framework para criar APIs
const sqlite3 = require('sqlite3').verbose(); // Banco de dados local
const bodyParser = require('body-parser'); // Para ler dados enviados como JSON
const cors = require('cors'); // Permite requisições de outras páginas
const path = require('path'); // Trabalha com caminhos de arquivos

// Cria a aplicação Express
const app = express();

// Cria (ou abre) o banco de dados local (sqlite)
// Este arquivo fica salvo como './ifsocial.db'
const db = new sqlite3.Database('./ifsocial.db');

// ========================================
// CONFIGURAÇÕES DO SERVIDOR
// ========================================

// Permite requisições de qualquer origem (cross-origin)
app.use(cors());

// Quando uma requisição chegar com JSON, converte para objeto JavaScript
app.use(bodyParser.json());

// Serve os arquivos HTML, CSS, JS da pasta atual
// Isso faz o servidor também funcionar como servidor web
app.use(express.static(path.join(__dirname)));

// ========================================
// CRIAÇÃO DO BANCO DE DADOS
// ========================================

// Executa esses comandos quando o servidor inicia
db.serialize(() => {
    // Tabela de USUÁRIOS
    // Armazena os usernames e senhas das pessoas que criam conta
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ID único de cada usuário
        username TEXT UNIQUE,                   -- Nome de usuário (não pode repetir)
        password TEXT                           -- Senha (em produção seria criptografada)
    )`);
    
    // Tabela de POSTS
    // Armazena todos os posts que os usuários fazem
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ID único de cada post
        user_id INTEGER,                        -- ID do usuário que fez o post
        content TEXT,                           -- Texto do post
        timestamp INTEGER,                      -- Hora em que foi criado
        FOREIGN KEY (user_id) REFERENCES users(id)  -- Liga com a tabela users
    )`);
    
    // Tabela de HYPES (❤️)
    // Registra quem deu hype em qual post
    db.run(`CREATE TABLE IF NOT EXISTS hypes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ID único de cada hype
        user_id INTEGER,                        -- ID do usuário que deu hype
        post_id INTEGER,                        -- ID do post que recebeu hype
        FOREIGN KEY (user_id) REFERENCES users(id),      -- Liga com users
        FOREIGN KEY (post_id) REFERENCES posts(id),      -- Liga com posts
        UNIQUE(user_id, post_id)               -- Cada usuário só pode dar 1 hype por post
    )`);
    
    console.log('✅ Database initialized!');
});

// ========================================
// ROTAS DA API (endpoints)
// ========================================

// ROTA 1: Health Check
// Verifica se o servidor está online
app.get('/health', (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// ROTA 2: Registro de novo usuário
app.post('/register', (req, res) => {
    // Pega o username e password que vieram na requisição
    const { username, password } = req.body || {};
    
    // Valida se enviaram os dois campos
    if (!username || !password) {
        return res.status(400).json({ error: 'Fill all fields.' });
    }
    
    // Tenta inserir o novo usuário no banco
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        // Se der erro, provavelmente o username já existe
        if (err) {
            return res.status(400).json({ error: 'User already exists.' });
        }
        
        // Sucesso! Retorna o ID e username do novo usuário
        res.status(201).json({ id: this.lastID, username });
    });
});

// ROTA 3: Login
// Verifica se o username e senha estão corretos
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Procura um usuário com este username e esta senha
    db.get(
        'SELECT id, username FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, row) => {
            // Se encontrou (row não é undefined)
            if (row) {
                res.json(row); // Retorna o ID e username do usuário
            } else {
                // Se não encontrou, credenciais inválidas
                res.status(401).json({ error: 'Invalid credentials.' });
            }
        }
    );
});

// ROTA 4: Criar novo post
app.post('/posts', (req, res) => {
    const { user_id, content } = req.body;
    
    // Insere o novo post no banco com a hora atual
    db.run(
        'INSERT INTO posts (user_id, content, timestamp) VALUES (?, ?, ?)',
        [user_id, content, Date.now()],
        function(err) {
            // Se der erro
            if (err) {
                return res.status(500).json({ error: 'Error creating post' });
            }
            
            // Sucesso! Retorna o ID do novo post
            res.status(201).json({ id: this.lastID });
        }
    );
});

// ROTA 5: Buscar todos os posts (para o feed)
app.get('/posts', (req, res) => {
    const { user_id } = req.query; // Pega o ID do usuário logado
    
    // Faz uma query complexa que:
    // 1. Pega todos os posts com informações do usuário que os fez
    // 2. Conta quantos hypes cada post tem
    // 3. Verifica se o usuário atual já deu hype neste post
    db.all(
        `SELECT p.id, u.username, p.content, p.timestamp, 
            (SELECT COUNT(*) FROM hypes WHERE post_id = p.id) as hype_count,
            (SELECT COUNT(*) FROM hypes WHERE post_id = p.id AND user_id = ?) as user_hyped
            FROM posts p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.timestamp DESC`,
        [user_id],
        (err, rows) => {
            // Retorna todos os posts (ou um array vazio se não houver)
            res.json(rows || []);
        }
    );
});

// ROTA 6: Toggle Hype (adiciona ou remove um hype)
app.post('/hypes', (req, res) => {
    const { user_id, post_id } = req.body;
    
    // Verifica se o usuário já deu hype neste post
    db.get(
        'SELECT id FROM hypes WHERE user_id = ? AND post_id = ?',
        [user_id, post_id],
        (err, row) => {
            if (row) {
                // Se já existe, REMOVE o hype (usuario clicou de novo pra desativar)
                db.run(
                    'DELETE FROM hypes WHERE user_id = ? AND post_id = ?',
                    [user_id, post_id],
                    () => res.json({ action: 'removed' })
                );
            } else {
                // Se não existe, ADICIONA o hype (primeiro clique)
                db.run(
                    'INSERT INTO hypes (user_id, post_id) VALUES (?, ?)',
                    [user_id, post_id],
                    () => res.json({ action: 'added' })
                );
            }
        }
    );
});

// ========================================
// INICIAR O SERVIDOR
// ========================================

// Define a porta onde o servidor vai escutar (8080)
const PORT = 8080;

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`🚀 IF-Social running at http://localhost:${PORT}`);
});