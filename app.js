// ===========================
// IF-SOCIAL - FRONTEND (app.js)
// ===========================
// Esse arquivo cuida de tudo o que acontece no navegador
// Login, posts, dark mode, tudo!

// URL do servidor (deixamos vazio porque o servidor tá na mesma máquina)
const API_URL = '';

// Puxa o usuário salvo do navegador, se não tiver salvo é null
let usuarioAtual = JSON.parse(localStorage.getItem('IFSocial_usuarioAtual')) || null;
// Guarda o intervalo do polling (update automático do feed)
let intervaloFeed = null;

// ========================================
// DARK MODE - Deixar a tela escura
// ========================================

// Verifica se o dark mode tá ativado quando a página carrega
function iniciarDarkMode() {
    // Pega do localStorage se tinha dark mode salvo
    const temaDarkMode = localStorage.getItem('IFSocial_darkMode') === 'true';
    // Se tiver, adiciona a classe 'dark-mode' no body pra mudar as cores
    if (temaDarkMode) {
        document.body.classList.add('dark-mode');
    }
    console.log('Dark mode inicializado:', temaDarkMode);
}

// Quando clica no botão da lua, essa função muda o tema
function alternarTema() {
    // toggle adiciona ou remove a classe 'dark-mode' e retorna se tá ativado ou não
    const temaDarkMode = document.body.classList.toggle('dark-mode');
    // Salva no localStorage pra lembrar a próxima vez
    localStorage.setItem('IFSocial_darkMode', temaDarkMode.toString());
    console.log('Dark mode alterado para:', temaDarkMode);
}

// ========================================
// VERIFICAÇÃO DO SERVIDOR - Checa se tá online
// ========================================

// Faz uma requisição pro servidor só pra ver se ele tá vivo
async function verificarServidorOnline() {
    try {
        // Chama a rota /health que retorna se tá tudo ok
        const resposta = await fetch(`${API_URL}/health`);
        const dados = await resposta.json();
        // Salva o status no localStorage
        localStorage.setItem('IFSocial_saude', JSON.stringify({
            ok: dados.ok,
            timestamp: Date.now()
        }));
        return dados.ok;
    } catch (erro) {
        // Se der erro, salva que tá offline
        console.error('Servidor offline:', erro);
        localStorage.setItem('IFSocial_saude', JSON.stringify({
            ok: false,
            timestamp: Date.now()
        }));
        return false;
    }
}

// ========================================
// GERENCIAMENTO DE USUÁRIO - Login e tudo
// ========================================

// Salva o usuário que tá logado no localStorage
function salvarUsuarioAtual() {
    localStorage.setItem('IFSocial_usuarioAtual', JSON.stringify(usuarioAtual));
}

// Checa se tá logado e redireciona se necessário
// Se tá logado mas tá na página de login, vai pro feed
// Se não tá logado mas tá no feed, vai pro login
function verificarLoginERedireccionar(paginaAtual) {
    // Se não tem usuário e tá tentando acessar feed, volta pro login
    if (!usuarioAtual && paginaAtual !== 'login.html' && paginaAtual !== 'cadastro.html') {
        window.location.href = 'login.html';
        return false;
    }
    // Se já tá logado mas tá na página de login/cadastro, vai pro feed
    if (usuarioAtual && (paginaAtual === 'login.html' || paginaAtual === 'cadastro.html')) {
        window.location.href = 'feed.html';
        return false;
    }
    return true;
}

// ========================================
// AUTENTICAÇÃO - Criação de conta e login
// ========================================

// Função para validar a força da senha
// Precisa de: letra maiúscula e caractere especial
function validarSenha(senha) {
    // Verifica se tem letra maiúscula
    const temMaiuscula = /[A-Z]/.test(senha);
    // Verifica se tem caractere especial (!@#$%^&*...)
    const temEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha);
    // Verifica tamanho mínimo (6 caracteres)
    const temTamanho = senha.length >= 5;
    
    return {
        valida: temMaiuscula && temEspecial && temTamanho,
        temMaiuscula,
        temEspecial,
        temTamanho
    };
}

// Quando clica em "Criar Conta"
async function criarConta() {
    // Pega o que foi digitado nos inputs
    const usuario = document.getElementById('usuarioCadastro').value.trim();
    const senha = document.getElementById('senhaCadastro').value;

    // Valida se digitou algo
    if (!usuario || !senha) {
        exibirNotificacao('Preencha todos os campos!');
        return;
    }

    // Valida a força da senha
    const validacao = validarSenha(senha);
    if (!validacao.valida) {
        let mensagem = 'A senha deve ter:\n';
        if (!validacao.temTamanho) mensagem += '- Mínimo 6 caracteres\n';
        if (!validacao.temMaiuscula) mensagem += '- Uma letra MAIÚSCULA\n';
        if (!validacao.temEspecial) mensagem += '- Um caractere especial (!@#$%^&*...)';
        exibirNotificacao(mensagem);
        return;
    }

    console.log('Tentando criar conta com usuário:', usuario);

    try {
        // Envia pro servidor criando uma conta nova
        const resposta = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usuario, password: senha })
        });

        console.log('Resposta do servidor:', resposta.status);

        // Tenta converter a resposta pra JSON, se falhar fica vazio
        const corpo = await resposta.json().catch(() => ({}));

        // Se conseguiu criar (status 201)
        if (resposta.status === 201) {
            console.log('Conta criada com sucesso:', corpo);
            exibirNotificacao('Conta criada! Entrando...');
            // Salva o usuário novo na memória
            usuarioAtual = { id: corpo.id, username: usuario };
            salvarUsuarioAtual();
            // Redireciona pro feed
            window.location.href = 'feed.html';
        } else if (resposta.status === 400) {
            // Dados inválidos ou usuário já existe
            console.log('Erro de validação:', corpo);
            exibirNotificacao(corpo.error || 'Dados inválidos.');
        } else {
            // Erro genérico do servidor
            console.log('Erro no servidor:', corpo);
            exibirNotificacao(corpo.error || 'Erro ao registrar!');
        }
    } catch (erro) {
        // Erro de conexão
        console.error('Erro ao criar conta:', erro);
        exibirNotificacao('Erro ao conectar ao servidor.');
    }
}

// Quando clica em "Entrar"
async function entrar() {
    // Pega o que foi digitado nos inputs
    const usuario = document.getElementById('usuarioLogin').value.trim();
    const senha = document.getElementById('senhaLogin').value;

    // Valida se digitou algo
    if (!usuario || !senha) {
        exibirNotificacao('Preencha todos os campos!');
        return;
    }

    console.log('Tentando fazer login com usuário:', usuario);

    try {
        // Envia pro servidor checando se o usuário e senha tão certos
        const resposta = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usuario, password: senha })
        });

        console.log('Resposta do servidor:', resposta.status);

        // Se deu ok (status 200)
        if (resposta.ok) {
            const usuario_dados = await resposta.json();
            console.log('Login bem-sucedido:', usuario_dados);
            // Salva o usuário logado
            usuarioAtual = usuario_dados;
            salvarUsuarioAtual();
            // Vai pro feed
            window.location.href = 'feed.html';
        } else {
            // Credenciais erradas
            const erro = await resposta.json().catch(() => ({}));
            console.log('Erro na resposta:', erro);
            exibirNotificacao(erro.error || 'Credenciais inválidas!');
        }
    } catch (erro) {
        // Erro de conexão
        console.error('Erro ao fazer login:', erro);
        exibirNotificacao('Erro ao conectar ao servidor.');
    }
}

// Clica em "Sair" e volta pro login
function sair() {
    // Limpa o usuário
    usuarioAtual = null;
    // Remove do localStorage
    localStorage.removeItem('IFSocial_usuarioAtual');
    // Redireciona pro login
    window.location.href = 'login.html';
}

// Limpa os campos do formulário de login
function limparCamposLogin() {
    document.getElementById('usuarioLogin').value = '';
    document.getElementById('senhaLogin').value = '';
    document.getElementById('gmailLogin').value = '';
    console.log('Campos de login limpos');
}

// Limpa os campos do formulário de cadastro
function limparCamposCadastro() {
    document.getElementById('usuarioCadastro').value = '';
    document.getElementById('senhaCadastro').value = '';
    document.getElementById('gmailCadastro').value = '';
    console.log('Campos de cadastro limpos');
}

// ========================================
// FEED - Posts e tudo relacionado
// ========================================

// Quando clica em "Postar" no textarea
async function criarPost() {
    // Pega o texto que digitou no textarea
    const conteudo = document.getElementById('novoPost').value.trim();
    // Se ficou vazio, não faz nada
    if (!conteudo) return;

    try {
        // Envia pro servidor criando um novo post
        const resposta = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: usuarioAtual.id, content: conteudo })
        });

        // Se conseguiu
        if (resposta.ok) {
            // Limpa o textarea
            document.getElementById('novoPost').value = '';
            // Recarrega o feed pra ver o novo post
            carregarFeed();
            exibirNotificacao('Post publicado!');
        } else {
            exibirNotificacao('Erro ao criar post!');
        }
    } catch (erro) {
        console.error('Erro ao criar post:', erro);
        exibirNotificacao('Erro ao publicar!');
    }
}

// Busca todos os posts do servidor e mostra na tela
async function carregarFeed() {
    try {
        // Pega todos os posts
        const resposta = await fetch(`${API_URL}/posts?user_id=${usuarioAtual.id}`);
        const posts = await resposta.json();

        // Limpa a área de posts
        const divFeed = document.getElementById('postsFeed');
        divFeed.innerHTML = '';

        // Para cada post, cria um elemento HTML e adiciona na tela
        posts.forEach(post => {
            // Converte o timestamp pra uma data legível
            const hora = new Date(post.timestamp).toLocaleString('pt-BR');
            
            // Cria uma div pro post
            const divPost = document.createElement('div');
            divPost.className = 'post';
            // Adiciona o HTML do post
            divPost.innerHTML = `
                <div class="post-header">
                    <span class="post-author">@${post.username}</span>
                    <span class="post-time">${hora}</span>
                </div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <button class="hype-btn ${post.user_hyped ? 'hyped' : ''}" onclick="alternarHype(${post.id})">
                        ❤️ ${post.hype_count}
                    </button>
                </div>
            `;
            // Adiciona o post na tela
            divFeed.appendChild(divPost);
        });
    } catch (erro) {
        console.error('Erro ao carregar feed:', erro);
        exibirNotificacao('Erro ao carregar posts!');
    }
}

// Começa a atualizar o feed a cada 2 segundos
function iniciarPollingFeed() {
    // Carrega uma vez
    carregarFeed();
    
    // Se já tinha um intervalo rodando, para ele
    if (intervaloFeed) clearInterval(intervaloFeed);
    // Cria um intervalo que recarrega o feed a cada 2 segundos
    intervaloFeed = setInterval(() => {
        if (usuarioAtual) {
            carregarFeed();
        }
    }, 2000);
}

// Para de atualizar o feed (usa quando sai da página)
function pararPollingFeed() {
    if (intervaloFeed) {
        clearInterval(intervaloFeed);
        intervaloFeed = null;
    }
}

// Quando clica no coração de um post (hype)
async function alternarHype(idPost) {
    try {
        // Envia pro servidor adicionando ou removendo o hype
        const resposta = await fetch(`${API_URL}/hypes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: usuarioAtual.id, post_id: idPost })
        });

        // Se conseguiu, recarrega o feed pra ver a mudança
        if (resposta.ok) {
            carregarFeed();
        }
    } catch (erro) {
        console.error('Erro ao dar hype:', erro);
    }
}

// ========================================
// UTILITÁRIOS - Coisas pequenas
// ========================================

// Mostra uma notificação na tela por 3 segundos
function exibirNotificacao(mensagem) {
    // Cria um elemento div
    const notificacao = document.createElement('div');
    notificacao.className = 'notification';
    notificacao.textContent = mensagem;
    // Adiciona na tela
    document.body.appendChild(notificacao);
    console.log('Notificação exibida:', mensagem);
    // Remove depois de 3 segundos
    setTimeout(() => notificacao.remove(), 3000);
}

// Função vazia, deixada só pra compatibilidade com código antigo
function iniciarBD() {
    // Não faz nada
}

// ========================================
// INICIALIZAÇÃO - Rodas quando a página carrega
// ========================================

// Checa se tá em dark mode e ativa se necessário
iniciarDarkMode();
// Checa se o servidor tá online
verificarServidorOnline();