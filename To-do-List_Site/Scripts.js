/* ==========================================================================
   TO DO FOCUS - LÓGICA DA APLICAÇÃO (VANILLA JAVASCRIPT)
   Organização em blocos didáticos:
     1. Constantes e Configurações
     2. Estado Central da Aplicação
     3. Camada de Dados (LocalStorage agora -> preparado para Flask + Supabase)
     4. Referências do DOM
     5. Utilitários (Formatação, Toast e Som com Web Audio API)
     6. Navegação SPA (Abas) e Modal de 12 Temas
     7. Gerenciamento de Tarefas (CRUD + Renderização)
     8. Cronômetro Pomodoro Sincronizado com as Tarefas
     9. Aba Histórico (Resumo, Meta Diária e Gráfico Semanal)
    10. Aba Conta e Configurações
    11. Eventos e Inicialização
   ========================================================================== */

'use strict';

/* ==========================================================================
   BLOCO 1: CONSTANTES E CONFIGURAÇÕES GLOBAIS
   ========================================================================== */

// URL base para a futura API em Flask (usada nos comentários da Camada de Dados)
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Chaves usadas no localStorage para persistência offline
const CHAVES_STORAGE = {
    TAREFAS: 'todofocus_tarefas',
    HISTORICO: 'todofocus_historico',
    CONFIG: 'todofocus_config',
    TEMA: 'todofocus_tema'
};

// Valores padrão das configurações da conta
const CONFIG_PADRAO = {
    nome: 'Matheus',
    metaDiaria: 60,
    somAtivo: true
};

// Tempo padrão do cronômetro quando nenhuma tarefa está selecionada
const TEMPO_PADRAO_MINUTOS = 25;

// Paleta de 12 temas aconchegantes (tons pastéis/quentes e escuros suaves)
// A propriedade "escuro" ajusta automaticamente a cor do texto do cabeçalho para manter contraste.
const TEMAS = [
    { id: 'pessego-quente', nome: 'Pêssego', cor: '#D49A89', escuro: false },
    { id: 'areia-quente', nome: 'Areia', cor: '#D9C3A3', escuro: false },
    { id: 'linho-suave', nome: 'Linho', cor: '#C8B6A6', escuro: false },
    { id: 'salvia-clara', nome: 'Sálvia', cor: '#A8BFA8', escuro: false },
    { id: 'azul-nevoa', nome: 'Névoa', cor: '#9BB5C4', escuro: false },
    { id: 'lavanda-suave', nome: 'Lavanda', cor: '#B8A9C9', escuro: false },
    { id: 'rosa-antigo', nome: 'Rosa Antigo', cor: '#C9979E', escuro: false },
    { id: 'terracota', nome: 'Terracota', cor: '#A65A48', escuro: true },
    { id: 'eucalipto', nome: 'Eucalipto', cor: '#4E6B62', escuro: true },
    { id: 'azul-ardosia', nome: 'Ardósia', cor: '#465B73', escuro: true },
    { id: 'cacau-escuro', nome: 'Cacau', cor: '#5C4B45', escuro: true },
    { id: 'grafite-suave', nome: 'Grafite', cor: '#2E2D33', escuro: true }
];

/* ==========================================================================
   BLOCO 2: ESTADO CENTRAL DA APLICAÇÃO
   ========================================================================== */

const estado = {
    abaAtiva: 'aba-principal',
    temaAtual: TEMAS[0].id,
    tarefas: [],
    historico: [],
    config: { ...CONFIG_PADRAO },

    // Estado interno do cronômetro Pomodoro
    timer: {
        tarefaId: null,
        tituloAtual: null,
        minutosCiclo: TEMPO_PADRAO_MINUTOS,
        segundosTotais: TEMPO_PADRAO_MINUTOS * 60,
        segundosRestantes: TEMPO_PADRAO_MINUTOS * 60,
        cicloAtual: 1,
        totalCiclos: 1,
        rodando: false,
        intervaloId: null
    },

    // Controle da confirmação em 2 cliques para limpar o histórico (sem confirm/alert)
    confirmandoLimpeza: false,
    timeoutLimpezaId: null
};

// Instância reutilizável do AudioContext (criada na primeira interação com som)
let contextoAudio = null;

/* ==========================================================================
   BLOCO 3: CAMADA DE DADOS (PREPARADA PARA FUTURA API FLASK + SUPABASE)
   ========================================================================== */

/**
 * Lê um valor JSON do localStorage com segurança.
 * Se não existir ou estiver inválido, devolve o valor padrão informado.
 */
function lerStorage(chave, valorPadrao) {
    try {
        const bruto = localStorage.getItem(chave);
        return bruto ? JSON.parse(bruto) : valorPadrao;
    } catch (erro) {
        console.warn(`Não foi possível ler "${chave}" do localStorage:`, erro);
        return valorPadrao;
    }
}

/**
 * Salva um valor no localStorage em formato JSON.
 */
function salvarStorage(chave, dados) {
    try {
        localStorage.setItem(chave, JSON.stringify(dados));
    } catch (erro) {
        console.warn(`Não foi possível salvar "${chave}" no localStorage:`, erro);
    }
}

/* --------------------------------------------------------------------------
   CRUD DE TAREFAS (async/await)
   Formato padrão de cada tarefa:
   { id, titulo, tempo_minutos, ciclos, concluida, criado_em }
   -------------------------------------------------------------------------- */

/**
 * Busca todas as tarefas cadastradas.
 */
async function listarTarefas() {
    /*
     * FUTURA INTEGRAÇÃO COM FLASK + SUPABASE:
     * const resposta = await fetch(`${API_BASE_URL}/tarefas`);
     * if (!resposta.ok) throw new Error('Erro ao carregar tarefas');
     * return await resposta.json();
     */
    const tarefasSalvas = lerStorage(CHAVES_STORAGE.TAREFAS, []);
    return Array.isArray(tarefasSalvas) ? tarefasSalvas : [];
}

/**
 * Cria uma nova tarefa e retorna o objeto salvo.
 * @param {{ titulo: string, tempo_minutos: number, ciclos: number }} dadosTarefa
 */
async function criarTarefa(dadosTarefa) {
    const novaTarefa = {
        id: gerarId(),
        titulo: dadosTarefa.titulo.trim(),
        tempo_minutos: Number(dadosTarefa.tempo_minutos),
        ciclos: Number(dadosTarefa.ciclos),
        concluida: false,
        criado_em: new Date().toISOString()
    };

    /*
     * FUTURA INTEGRAÇÃO COM FLASK + SUPABASE:
     * const resposta = await fetch(`${API_BASE_URL}/tarefas`, {
     *     method: 'POST',
     *     headers: { 'Content-Type': 'application/json' },
     *     body: JSON.stringify(novaTarefa)
     * });
     * if (!resposta.ok) throw new Error('Erro ao criar tarefa');
     * return await resposta.json();
     */
    const tarefas = await listarTarefas();
    tarefas.unshift(novaTarefa);
    salvarStorage(CHAVES_STORAGE.TAREFAS, tarefas);
    return novaTarefa;
}

/**
 * Atualiza parcialmente uma tarefa existente (ex: marcar como concluída).
 * @param {string} id
 * @param {Partial<{ titulo: string, tempo_minutos: number, ciclos: number, concluida: boolean }>} dadosAtualizados
 */
async function atualizarTarefa(id, dadosAtualizados) {
    /*
     * FUTURA INTEGRAÇÃO COM FLASK + SUPABASE:
     * const resposta = await fetch(`${API_BASE_URL}/tarefas/${id}`, {
     *     method: 'PATCH',
     *     headers: { 'Content-Type': 'application/json' },
     *     body: JSON.stringify(dadosAtualizados)
     * });
     * if (!resposta.ok) throw new Error('Erro ao atualizar tarefa');
     * return await resposta.json();
     */
    const tarefas = await listarTarefas();
    let tarefaModificada = null;

    const listaAtualizada = tarefas.map((tarefa) => {
        if (tarefa.id === id) {
            tarefaModificada = { ...tarefa, ...dadosAtualizados };
            return tarefaModificada;
        }
        return tarefa;
    });

    salvarStorage(CHAVES_STORAGE.TAREFAS, listaAtualizada);
    return tarefaModificada;
}

/**
 * Remove uma tarefa pelo ID.
 * @param {string} id
 */
async function excluirTarefa(id) {
    /*
     * FUTURA INTEGRAÇÃO COM FLASK + SUPABASE:
     * const resposta = await fetch(`${API_BASE_URL}/tarefas/${id}`, {
     *     method: 'DELETE'
     * });
     * if (!resposta.ok) throw new Error('Erro ao excluir tarefa');
     * return true;
     */
    const tarefas = await listarTarefas();
    const listaFiltrada = tarefas.filter((tarefa) => tarefa.id !== id);
    salvarStorage(CHAVES_STORAGE.TAREFAS, listaFiltrada);
    return true;
}

/* --------------------------------------------------------------------------
   PERSISTÊNCIA DE HISTÓRICO, CONTA E TEMA (localStorage)
   -------------------------------------------------------------------------- */

function carregarHistorico() {
    const lista = lerStorage(CHAVES_STORAGE.HISTORICO, []);
    return Array.isArray(lista) ? lista : [];
}

function salvarHistorico(historico) {
    salvarStorage(CHAVES_STORAGE.HISTORICO, historico);
}

function carregarConfig() {
    const salva = lerStorage(CHAVES_STORAGE.CONFIG, null);
    return salva ? { ...CONFIG_PADRAO, ...salva } : { ...CONFIG_PADRAO };
}

function salvarConfig(config) {
    salvarStorage(CHAVES_STORAGE.CONFIG, config);
}

function carregarTema() {
    return localStorage.getItem(CHAVES_STORAGE.TEMA) || TEMAS[0].id;
}

function salvarTema(idTema) {
    localStorage.setItem(CHAVES_STORAGE.TEMA, idTema);
}

/* ==========================================================================
   BLOCO 4: REFERÊNCIAS DO DOM
   ========================================================================== */

const dom = {
    // Cabeçalho e Toast
    containerToast: document.getElementById('container-toast'),
    btnTema: document.getElementById('tema-botao'),

    // Abas e Navegação
    abas: document.querySelectorAll('.aba'),
    botoesNav: document.querySelectorAll('.btn-nav'),

    // Cronômetro
    etiquetaStatusTimer: document.getElementById('etiqueta-status-timer'),
    indicadorCiclo: document.getElementById('indicador-ciclo'),
    tarefaAtiva: document.getElementById('tarefa-ativa'),
    visorTimer: document.getElementById('visor-timer'),
    barraProgressoTimer: document.getElementById('barra-progresso-timer'),
    btnIniciar: document.getElementById('btn-iniciar'),
    btnPausar: document.getElementById('btn-pausar'),
    btnZerar: document.getElementById('btn-zerar'),
    btnConcluirCiclo: document.getElementById('btn-concluir-ciclo'),
    cartaoTimer: document.getElementById('cartao-timer'),

    // Tarefas
    contadorTarefas: document.getElementById('contador-tarefas'),
    formTarefa: document.getElementById('form-tarefa'),
    inputTitulo: document.getElementById('input-titulo'),
    inputTempo: document.getElementById('input-tempo'),
    inputCiclos: document.getElementById('input-ciclos'),
    listaTarefas: document.getElementById('lista-tarefas'),

    // Histórico
    valorMinutosFocados: document.getElementById('valor-minutos-focados'),
    valorCiclosConcluidos: document.getElementById('valor-ciclos-concluidos'),
    valorTarefasConcluidas: document.getElementById('valor-tarefas-concluidas'),
    valorMetaDiaria: document.getElementById('valor-meta-diaria'),
    barraMetaDiaria: document.getElementById('barra-meta-diaria'),
    totalSemanal: document.getElementById('total-semanal'),
    graficoSemanal: document.getElementById('grafico-semanal'),
    listaHistorico: document.getElementById('lista-historico'),
    btnLimparHistorico: document.getElementById('limpar-historico'),

    // Conta e Configurações
    avatarUsuario: document.getElementById('avatar-usuario'),
    nomeUsuarioExibicao: document.getElementById('nome'),
    resumoMetaUsuario: document.getElementById('resumo-meta-usuario'),
    formConfiguracoes: document.getElementById('form-configuracoes'),
    inputNomeUsuario: document.getElementById('input-nome-usuario'),
    inputMetaDiaria: document.getElementById('input-meta-diaria'),
    inputSomAtivo: document.getElementById('input-som-ativo'),
    btnTestarSom: document.getElementById('btn-testar-som'),

    // Modal de Temas
    modalTema: document.getElementById('modal-tema'),
    btnFecharModal: document.getElementById('btn-fechar-modal'),
    gradeTemas: document.getElementById('grade-temas')
};

/* ==========================================================================
   BLOCO 5: UTILITÁRIOS (FORMATAÇÃO, TOAST E WEB AUDIO API)
   ========================================================================== */

/**
 * Gera um identificador único simples para tarefas e sessões.
 */
function gerarId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Converte segundos em texto formatado "MM:SS" (ex: 1500 -> "25:00").
 */
function formatarTempo(segundosTotais) {
    const seguros = Math.max(0, Math.floor(segundosTotais));
    const minutos = Math.floor(seguros / 60);
    const segundos = seguros % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

/**
 * Formata uma data ISO para leitura amigável em português (ex: "27/11 às 14:30").
 */
function formatarDataHora(dataIso) {
    const data = new Date(dataIso);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} às ${horas}:${minutos}`;
}

/**
 * Retorna uma chave de data local "AAAA-MM-DD" para agrupar sessões por dia.
 */
function obterChaveDiaLocal(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

/**
 * Exibe uma notificação Toast flutuante no topo da tela.
 * @param {string} mensagem
 * @param {'info' | 'sucesso' | 'aviso' | 'erro'} tipo
 */
function mostrarToast(mensagem, tipo = 'info') {
    // Mantém a interface limpa exibindo apenas a notificação mais recente
    dom.containerToast.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensagem;
    toast.setAttribute('role', 'status');

    dom.containerToast.appendChild(toast);

    // Remove o toast suavemente após 3,2 segundos
    setTimeout(() => {
        if (!toast.isConnected) return;
        toast.classList.add('saindo');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3200);
}

/**
 * Toca um aviso sonoro suave usando apenas Web Audio API (sem arquivos MP3).
 * @param {boolean} forcarExecucao - Se true, toca mesmo com o som desligado (usado no botão "Testar som").
 * @param {boolean} somDeVitoria - Se true, toca uma melodia ascendente de 3 notas ao finalizar toda a tarefa.
 */
function tocarSomAlarme(forcarExecucao = false, somDeVitoria = false) {
    if (!forcarExecucao && !estado.config.somAtivo) {
        return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        return;
    }

    try {
        if (!contextoAudio) {
            contextoAudio = new AudioCtx();
        }
        if (contextoAudio.state === 'suspended') {
            contextoAudio.resume();
        }

        const agora = contextoAudio.currentTime;
        // Frequências musicais suaves (Dó5 -> Mi5 -> Sol5)
        const notas = somDeVitoria ? [523.25, 659.25, 783.99] : [587.33, 880.0];

        notas.forEach((frequencia, indice) => {
            const oscilador = contextoAudio.createOscillator();
            const ganho = contextoAudio.createGain();

            oscilador.type = 'sine';
            oscilador.frequency.setValueAtTime(frequencia, agora + indice * 0.18);

            // Envelope suave para evitar estalos no som
            const inicio = agora + indice * 0.18;
            ganho.gain.setValueAtTime(0.001, inicio);
            ganho.gain.exponentialRampToValueAtTime(0.18, inicio + 0.03);
            ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.55);

            oscilador.connect(ganho);
            ganho.connect(contextoAudio.destination);

            oscilador.start(inicio);
            oscilador.stop(inicio + 0.58);
        });
    } catch (erro) {
        console.warn('Não foi possível reproduzir o som via Web Audio API:', erro);
    }
}

/* ==========================================================================
   BLOCO 6: NAVEGAÇÃO SPA (ABAS) E SELETOR DE 12 TEMAS
   ========================================================================== */

/**
 * Alterna entre as abas Principal, Histórico e Conta sem recarregar a página.
 */
function alternarAba(idAba) {
    estado.abaAtiva = idAba;

    dom.abas.forEach((secao) => {
        secao.classList.toggle('ativa', secao.id === idAba);
    });

    dom.botoesNav.forEach((botao) => {
        const ehAtiva = botao.dataset.aba === idAba;
        botao.classList.toggle('ativa', ehAtiva);
        if (ehAtiva) {
            botao.setAttribute('aria-current', 'page');
        } else {
            botao.removeAttribute('aria-current');
        }
    });

    // Atualiza os dados da aba ao abrir Histórico ou Conta
    if (idAba === 'aba-historico') {
        renderizarHistorico();
    } else if (idAba === 'aba-conta') {
        renderizarConta();
    }
}

/**
 * Aplica a cor do tema na variável CSS --cor-fundo e ajusta o contraste dos textos.
 */
function aplicarTema(idTema, mostrarFeedback = false) {
    const temaEncontrado = TEMAS.find((tema) => tema.id === idTema) || TEMAS[0];
    estado.temaAtual = temaEncontrado.id;

    const raiz = document.documentElement;
    raiz.style.setProperty('--cor-fundo', temaEncontrado.cor);

    // Garante leitura confortável em fundos claros e escuros
    if (temaEncontrado.escuro) {
        raiz.style.setProperty('--cor-texto-fundo', '#FFFBF8');
        raiz.style.setProperty('--cor-subtexto-fundo', 'rgba(255, 251, 248, 0.82)');
    } else {
        raiz.style.setProperty('--cor-texto-fundo', '#241B18');
        raiz.style.setProperty('--cor-subtexto-fundo', 'rgba(36, 27, 24, 0.78)');
    }

    salvarTema(temaEncontrado.id);
    atualizarSelecaoTemaNaGrade();

    if (mostrarFeedback) {
        mostrarToast(`Tema "${temaEncontrado.nome}" aplicado!`, 'info');
    }
}

/**
 * Cria os 12 botões circulares de cores dentro do modal #modal-tema.
 */
function renderizarGradeTemas() {
    dom.gradeTemas.innerHTML = '';

    TEMAS.forEach((tema) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'item-tema';

        const botaoCor = document.createElement('button');
        botaoCor.type = 'button';
        botaoCor.className = 'btn-cor-tema';
        botaoCor.dataset.temaId = tema.id;
        botaoCor.style.backgroundColor = tema.cor;
        botaoCor.style.color = tema.escuro ? '#FFFFFF' : '#241B18';
        botaoCor.title = `Tema ${tema.nome}`;
        botaoCor.setAttribute('aria-label', `Selecionar tema ${tema.nome}`);

        botaoCor.addEventListener('click', () => {
            aplicarTema(tema.id, true);
        });

        const legenda = document.createElement('span');
        legenda.className = 'nome-cor-tema';
        legenda.textContent = tema.nome;

        wrapper.appendChild(botaoCor);
        wrapper.appendChild(legenda);
        dom.gradeTemas.appendChild(wrapper);
    });

    atualizarSelecaoTemaNaGrade();
}

/**
 * Destaca visualmente qual dos 12 círculos de tema está selecionado.
 */
function atualizarSelecaoTemaNaGrade() {
    const botoes = dom.gradeTemas.querySelectorAll('.btn-cor-tema');
    botoes.forEach((botao) => {
        const selecionado = botao.dataset.temaId === estado.temaAtual;
        botao.classList.toggle('selecionado', selecionado);
        botao.textContent = selecionado ? '✓' : '';
        botao.setAttribute('aria-pressed', String(selecionado));
    });
}

function abrirModalTema() {
    dom.modalTema.classList.add('aberto');
    dom.modalTema.setAttribute('aria-hidden', 'false');
    dom.btnTema.setAttribute('aria-expanded', 'true');
}

function fecharModalTema() {
    dom.modalTema.classList.remove('aberto');
    dom.modalTema.setAttribute('aria-hidden', 'true');
    dom.btnTema.setAttribute('aria-expanded', 'false');
}

/* ==========================================================================
   BLOCO 7: GERENCIAMENTO DE TAREFAS (VALIDAÇÃO, CRUD E DOM)
   ========================================================================== */

/**
 * Valida os campos do formulário de tarefas no JavaScript.
 * Retorna uma mensagem de erro ou null se estiver tudo válido.
 */
function validarDadosTarefa(titulo, tempoMinutos, ciclos) {
    if (!titulo || !titulo.trim()) {
        return 'Digite o nome da tarefa antes de adicionar.';
    }

    if (!Number.isInteger(tempoMinutos) || tempoMinutos < 5 || tempoMinutos > 60 || tempoMinutos % 5 !== 0) {
        return 'O tempo deve ser de 5 em 5 minutos, entre 5 e 60 min.';
    }

    if (!Number.isInteger(ciclos) || ciclos < 1 || ciclos > 10) {
        return 'A quantidade de ciclos deve ser um número inteiro entre 1 e 10.';
    }

    return null;
}

/**
 * Trata o envio do formulário para criar uma nova tarefa.
 */
async function manipularCriacaoTarefa(evento) {
    evento.preventDefault();

    const titulo = dom.inputTitulo.value.trim();
    const tempoMinutos = Number(dom.inputTempo.value);
    const ciclos = Number(dom.inputCiclos.value);

    const erroValidacao = validarDadosTarefa(titulo, tempoMinutos, ciclos);
    if (erroValidacao) {
        mostrarToast(erroValidacao, 'aviso');
        return;
    }

    try {
        await criarTarefa({
            titulo,
            tempo_minutos: tempoMinutos,
            ciclos
        });

        estado.tarefas = await listarTarefas();
        renderizarTarefas();
        renderizarHistorico();

        // Limpa o campo de título e mantém tempo/ciclos prontos para a próxima tarefa
        dom.inputTitulo.value = '';
        dom.inputTitulo.focus();

        mostrarToast(`Tarefa "${titulo}" adicionada!`, 'sucesso');
    } catch (erro) {
        console.error(erro);
        mostrarToast('Não foi possível salvar a tarefa.', 'erro');
    }
}

/**
 * Alterna o status concluida (true/false) de uma tarefa.
 */
async function alternarConclusaoTarefa(id) {
    const tarefa = estado.tarefas.find((item) => item.id === id);
    if (!tarefa) return;

    const novoStatus = !tarefa.concluida;
    await atualizarTarefa(id, { concluida: novoStatus });
    estado.tarefas = await listarTarefas();

    renderizarTarefas();
    renderizarHistorico();

    mostrarToast(
        novoStatus ? `Tarefa "${tarefa.titulo}" concluída!` : `Tarefa "${tarefa.titulo}" reaberta.`,
        novoStatus ? 'sucesso' : 'info'
    );
}

/**
 * Exclui uma tarefa e limpa o cronômetro se ela estivesse em foco.
 */
async function removerTarefa(id) {
    const tarefa = estado.tarefas.find((item) => item.id === id);
    if (!tarefa) return;

    await excluirTarefa(id);
    estado.tarefas = await listarTarefas();

    // Se a tarefa excluída era a que estava no cronômetro, restaura o timer padrão
    if (estado.timer.tarefaId === id) {
        resetarTimerParaPadrao();
    }

    renderizarTarefas();
    renderizarHistorico();
    mostrarToast(`Tarefa "${tarefa.titulo}" excluída.`, 'info');
}

/**
 * Renderiza toda a lista de tarefas na tela de forma segura (sem injeção de HTML).
 */
function renderizarTarefas() {
    dom.listaTarefas.innerHTML = '';

    const pendentes = estado.tarefas.filter((t) => !t.concluida).length;
    dom.contadorTarefas.textContent = pendentes === 1 ? '1 pendente' : `${pendentes} pendentes`;

    if (estado.tarefas.length === 0) {
        const vazio = document.createElement('li');
        vazio.className = 'estado-vazio';
        vazio.textContent = 'Nenhuma tarefa por aqui ainda. Crie sua primeira tarefa acima e clique em "Focar"!';
        dom.listaTarefas.appendChild(vazio);
        return;
    }

    estado.tarefas.forEach((tarefa) => {
        const item = document.createElement('li');
        item.className = 'item-tarefa';
        if (tarefa.concluida) item.classList.add('concluida');
        if (estado.timer.tarefaId === tarefa.id) item.classList.add('em-foco');

        // Topo do item: título + etiqueta "Em foco" (se aplicável)
        const topo = document.createElement('div');
        topo.className = 'item-tarefa-topo';

        const titulo = document.createElement('span');
        titulo.className = 'item-tarefa-titulo';
        titulo.textContent = tarefa.titulo;
        topo.appendChild(titulo);

        if (estado.timer.tarefaId === tarefa.id) {
            const badgeFoco = document.createElement('span');
            badgeFoco.className = 'etiqueta-foco';
            badgeFoco.textContent = 'Em foco';
            topo.appendChild(badgeFoco);
        }

        // Metadados: tempo por ciclo e quantidade de ciclos
        const meta = document.createElement('div');
        meta.className = 'item-tarefa-meta';

        const spanTempo = document.createElement('span');
        spanTempo.textContent = `${tarefa.tempo_minutos} min`;

        const spanCiclos = document.createElement('span');
        spanCiclos.textContent = tarefa.ciclos === 1 ? '1 ciclo' : `${tarefa.ciclos} ciclos`;

        meta.appendChild(spanTempo);
        meta.appendChild(spanCiclos);

        // Botões de ação: Focar, Concluir/Reabrir e Excluir
        const acoes = document.createElement('div');
        acoes.className = 'item-tarefa-acoes';

        const btnFocar = document.createElement('button');
        btnFocar.type = 'button';
        btnFocar.className = 'btn-acao-tarefa btn-focar';
        btnFocar.textContent = 'Focar';
        btnFocar.addEventListener('click', () => selecionarTarefaParaFoco(tarefa.id));

        const btnConcluir = document.createElement('button');
        btnConcluir.type = 'button';
        btnConcluir.className = 'btn-acao-tarefa btn-concluir';
        btnConcluir.textContent = tarefa.concluida ? 'Reabrir' : 'Concluir';
        btnConcluir.addEventListener('click', () => alternarConclusaoTarefa(tarefa.id));

        const btnExcluir = document.createElement('button');
        btnExcluir.type = 'button';
        btnExcluir.className = 'btn-acao-tarefa btn-excluir';
        btnExcluir.textContent = 'Excluir';
        btnExcluir.addEventListener('click', () => removerTarefa(tarefa.id));

        acoes.appendChild(btnFocar);
        acoes.appendChild(btnConcluir);
        acoes.appendChild(btnExcluir);

        item.appendChild(topo);
        item.appendChild(meta);
        item.appendChild(acoes);

        dom.listaTarefas.appendChild(item);
    });
}

/* ==========================================================================
   BLOCO 8: CRONÔMETRO POMODORO SINCRONIZADO COM AS TAREFAS
   ========================================================================== */

/**
 * Para o setInterval ativo do cronômetro, se houver.
 */
function pararIntervaloTimer() {
    if (estado.timer.intervaloId !== null) {
        clearInterval(estado.timer.intervaloId);
        estado.timer.intervaloId = null;
    }
    estado.timer.rodando = false;
}

/**
 * Restaura o cronômetro para o estado inicial (sem tarefa selecionada).
 */
function resetarTimerParaPadrao() {
    pararIntervaloTimer();
    estado.timer.tarefaId = null;
    estado.timer.tituloAtual = null;
    estado.timer.minutosCiclo = TEMPO_PADRAO_MINUTOS;
    estado.timer.segundosTotais = TEMPO_PADRAO_MINUTOS * 60;
    estado.timer.segundosRestantes = TEMPO_PADRAO_MINUTOS * 60;
    estado.timer.cicloAtual = 1;
    estado.timer.totalCiclos = 1;
    atualizarInterfaceTimer();
}

/**
 * Carrega uma tarefa da lista no cronômetro (tempo e quantidade de ciclos).
 */
function selecionarTarefaParaFoco(id) {
    const tarefa = estado.tarefas.find((item) => item.id === id);
    if (!tarefa) return;

    pararIntervaloTimer();

    estado.timer.tarefaId = tarefa.id;
    estado.timer.tituloAtual = tarefa.titulo;
    estado.timer.minutosCiclo = tarefa.tempo_minutos;
    estado.timer.segundosTotais = tarefa.tempo_minutos * 60;
    estado.timer.segundosRestantes = tarefa.tempo_minutos * 60;
    estado.timer.cicloAtual = 1;
    estado.timer.totalCiclos = tarefa.ciclos;

    atualizarInterfaceTimer();
    renderizarTarefas();

    // Em telas menores, rola suavemente até o cronômetro
    if (window.innerWidth <= 768) {
        dom.cartaoTimer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    mostrarToast(`Tarefa "${tarefa.titulo}" carregada (${tarefa.tempo_minutos} min × ${tarefa.ciclos} ciclo(s)).`, 'info');
}

/**
 * Inicia ou retoma a contagem regressiva de 1 em 1 segundo.
 */
function iniciarTimer() {
    if (estado.timer.rodando) return;

    // Se o cronômetro já estiver zerado, recarrega o tempo do ciclo antes de iniciar
    if (estado.timer.segundosRestantes <= 0) {
        estado.timer.segundosRestantes = estado.timer.segundosTotais;
    }

    estado.timer.rodando = true;
    atualizarInterfaceTimer();

    estado.timer.intervaloId = setInterval(() => {
        estado.timer.segundosRestantes -= 1;

        if (estado.timer.segundosRestantes <= 0) {
            estado.timer.segundosRestantes = 0;
            atualizarInterfaceTimer();
            concluirCicloAtual();
            return;
        }

        atualizarInterfaceTimer();
    }, 1000);
}

/**
 * Pausa a contagem regressiva preservando o tempo restante.
 */
function pausarTimer() {
    if (!estado.timer.rodando) return;
    pararIntervaloTimer();
    atualizarInterfaceTimer();
}

/**
 * Zera o tempo do ciclo atual de volta ao valor original da tarefa (ou 25:00).
 */
function zerarTimer() {
    pararIntervaloTimer();
    estado.timer.segundosRestantes = estado.timer.segundosTotais;
    atualizarInterfaceTimer();
    mostrarToast('Cronômetro zerado para o início do ciclo atual.', 'info');
}

/**
 * Executa a finalização de um ciclo:
 * - Registra a sessão no histórico
 * - Toca o aviso sonoro suave (Web Audio API)
 * - Avança automaticamente para o próximo ciclo OU conclui a tarefa
 */
async function concluirCicloAtual() {
    pararIntervaloTimer();

    const { tarefaId, tituloAtual, minutosCiclo, cicloAtual, totalCiclos } = estado.timer;
    const nomeSessao = tituloAtual || 'Foco livre';

    // 1. Registra a sessão concluída no histórico
    const novaSessao = {
        id: gerarId(),
        titulo: nomeSessao,
        minutos: minutosCiclo,
        ciclo: cicloAtual,
        totalCiclos: totalCiclos,
        data_iso: new Date().toISOString()
    };

    estado.historico.unshift(novaSessao);
    salvarHistorico(estado.historico);

    // 2. Verifica se ainda existem ciclos restantes nesta tarefa
    if (cicloAtual < totalCiclos) {
        tocarSomAlarme(false, false);

        const proximoCiclo = cicloAtual + 1;
        estado.timer.cicloAtual = proximoCiclo;
        estado.timer.segundosRestantes = estado.timer.segundosTotais;

        mostrarToast(
            `Ciclo ${cicloAtual} de ${totalCiclos} concluído! Iniciando ciclo ${proximoCiclo}...`,
            'sucesso'
        );

        renderizarHistorico();
        iniciarTimer(); // Avança automaticamente para o próximo ciclo
        return;
    }

    // 3. Último ciclo concluído: toca som de vitória e marca a tarefa como concluída
    tocarSomAlarme(false, true);

    if (tarefaId) {
        await atualizarTarefa(tarefaId, { concluida: true });
        estado.tarefas = await listarTarefas();

        mostrarToast(
            `Parabéns! Todos os ciclos de "${nomeSessao}" foram concluídos!`,
            'sucesso'
        );

        // Prepara o cronômetro para uma nova sessão
        resetarTimerParaPadrao();
        renderizarTarefas();
    } else {
        estado.timer.segundosRestantes = estado.timer.segundosTotais;
        atualizarInterfaceTimer();
        mostrarToast(`Sessão de foco livre (${minutosCiclo} min) registrada no histórico!`, 'sucesso');
    }

    renderizarHistorico();
}

/**
 * Sincroniza o visor MM:SS, barra de progresso, textos e botões com estado.timer.
 */
function atualizarInterfaceTimer() {
    const {
        tituloAtual,
        segundosRestantes,
        segundosTotais,
        cicloAtual,
        totalCiclos,
        rodando
    } = estado.timer;

    const tempoFormatado = formatarTempo(segundosRestantes);
    dom.visorTimer.textContent = tempoFormatado;

    // Atualiza o indicador de ciclo e o texto da tarefa ativa
    dom.indicadorCiclo.textContent = `Ciclo ${cicloAtual} de ${totalCiclos}`;

    if (tituloAtual) {
        dom.tarefaAtiva.textContent = `Focando em: ${tituloAtual} (Ciclo ${cicloAtual} de ${totalCiclos})`;
        dom.tarefaAtiva.classList.add('tem-tarefa');
    } else {
        dom.tarefaAtiva.textContent = rodando
            ? `Foco livre em andamento (Ciclo ${cicloAtual} de ${totalCiclos})`
            : 'Nenhuma tarefa selecionada';
        dom.tarefaAtiva.classList.toggle('tem-tarefa', rodando);
    }

    // Atualiza a etiqueta de status do topo
    dom.etiquetaStatusTimer.textContent = rodando ? 'Focando agora' : 'Pronto para focar';
    dom.etiquetaStatusTimer.classList.toggle('rodando', rodando);

    // Calcula a porcentagem concluída do ciclo atual para a barra de progresso
    const percentualConcluido = segundosTotais > 0
        ? ((segundosTotais - segundosRestantes) / segundosTotais) * 100
        : 0;
    dom.barraProgressoTimer.style.width = `${Math.min(100, Math.max(0, percentualConcluido))}%`;

    // Habilita/desabilita Iniciar e Pausar conforme o estado
    dom.btnIniciar.disabled = rodando;
    dom.btnPausar.disabled = !rodando;

    // Mostra a contagem na aba do navegador enquanto estiver rodando
    document.title = rodando ? `${tempoFormatado} • To Do Focus` : 'To Do Focus';
}

/* ==========================================================================
   BLOCO 9: ABA HISTÓRICO (RESUMO, META DIÁRIA E GRÁFICO SEMANAL)
   ========================================================================== */

/**
 * Atualiza os cartões de resumo, o gráfico dos últimos 7 dias e a lista de sessões.
 */
function renderizarHistorico() {
    // 1. Cálculos dos cartões de resumo
    const totalMinutos = estado.historico.reduce((soma, sessao) => soma + Number(sessao.minutos || 0), 0);
    const totalCiclos = estado.historico.length;
    const totalTarefasConcluidas = estado.tarefas.filter((tarefa) => tarefa.concluida).length;

    // Minutos focados hoje (para comparar com a meta diária configurada)
    const chaveHoje = obterChaveDiaLocal(new Date());
    const minutosHoje = estado.historico
        .filter((sessao) => obterChaveDiaLocal(new Date(sessao.data_iso)) === chaveHoje)
        .reduce((soma, sessao) => soma + Number(sessao.minutos || 0), 0);

    const meta = Math.max(1, Number(estado.config.metaDiaria) || CONFIG_PADRAO.metaDiaria);
    const porcentagemMeta = Math.round((minutosHoje / meta) * 100);

    dom.valorMinutosFocados.textContent = `${totalMinutos} min`;
    dom.valorCiclosConcluidos.textContent = String(totalCiclos);
    dom.valorTarefasConcluidas.textContent = String(totalTarefasConcluidas);
    dom.valorMetaDiaria.textContent = `${porcentagemMeta}%`;
    dom.barraMetaDiaria.style.width = `${Math.min(100, porcentagemMeta)}%`;

    // 2. Gráfico semanal simples (últimos 7 dias)
    renderizarResumoSemanal();

    // 3. Lista de sessões finalizadas
    dom.listaHistorico.innerHTML = '';

    if (estado.historico.length === 0) {
        const vazio = document.createElement('li');
        vazio.className = 'estado-vazio';
        vazio.textContent = 'Nenhuma sessão concluída ainda. Complete um ciclo Pomodoro para acompanhar sua evolução!';
        dom.listaHistorico.appendChild(vazio);
        return;
    }

    estado.historico.forEach((sessao) => {
        const item = document.createElement('li');
        item.className = 'item-historico';

        const info = document.createElement('div');
        info.className = 'item-historico-info';

        const titulo = document.createElement('span');
        titulo.className = 'item-historico-titulo';
        titulo.textContent = sessao.titulo;

        const subtitulo = document.createElement('span');
        subtitulo.className = 'item-historico-data';
        subtitulo.textContent = `Ciclo ${sessao.ciclo} de ${sessao.totalCiclos} • ${formatarDataHora(sessao.data_iso)}`;

        info.appendChild(titulo);
        info.appendChild(subtitulo);

        const minutosBadge = document.createElement('span');
        minutosBadge.className = 'item-historico-minutos';
        minutosBadge.textContent = `+${sessao.minutos} min`;

        item.appendChild(info);
        item.appendChild(minutosBadge);
        dom.listaHistorico.appendChild(item);
    });
}

/**
 * Monta as 7 colunas dos últimos 7 dias com barras proporcionais aos minutos focados.
 */
function renderizarResumoSemanal() {
    dom.graficoSemanal.innerHTML = '';

    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hoje = new Date();
    const dias = [];

    // Monta a janela dos últimos 7 dias (do mais antigo até hoje)
    for (let deslocamento = 6; deslocamento >= 0; deslocamento -= 1) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - deslocamento);
        const chave = obterChaveDiaLocal(data);

        const minutosDoDia = estado.historico
            .filter((sessao) => obterChaveDiaLocal(new Date(sessao.data_iso)) === chave)
            .reduce((soma, sessao) => soma + Number(sessao.minutos || 0), 0);

        dias.push({
            rotulo: nomesDias[data.getDay()],
            minutos: minutosDoDia,
            ehHoje: deslocamento === 0
        });
    }

    const totalMinutosSemana = dias.reduce((soma, dia) => soma + dia.minutos, 0);
    dom.totalSemanal.textContent = `${totalMinutosSemana} min na semana`;

    // Usa o maior dia (ou a meta diária como piso) para definir a escala das barras
    const maiorValor = Math.max(...dias.map((d) => d.minutos), estado.config.metaDiaria, 30);

    dias.forEach((dia) => {
        const coluna = document.createElement('div');
        coluna.className = 'coluna-dia';
        if (dia.ehHoje) coluna.classList.add('hoje');

        const valor = document.createElement('span');
        valor.className = 'valor-dia';
        valor.textContent = dia.minutos > 0 ? `${dia.minutos}m` : '0';

        const trilha = document.createElement('div');
        trilha.className = 'barra-dia-trilha';
        trilha.title = `${dia.rotulo}: ${dia.minutos} min`;

        const preenchimento = document.createElement('div');
        preenchimento.className = 'barra-dia-preenchimento';
        const alturaPercentual = dia.minutos > 0 ? Math.max(8, Math.round((dia.minutos / maiorValor) * 100)) : 0;
        preenchimento.style.height = `${alturaPercentual}%`;

        trilha.appendChild(preenchimento);

        const rotulo = document.createElement('span');
        rotulo.className = 'rotulo-dia';
        rotulo.textContent = dia.rotulo;

        coluna.appendChild(valor);
        coluna.appendChild(trilha);
        coluna.appendChild(rotulo);
        dom.graficoSemanal.appendChild(coluna);
    });
}

/**
 * Limpa o histórico com confirmação segura em 2 cliques (sem usar confirm/alert).
 */
function manipularLimpezaHistorico() {
    if (estado.historico.length === 0) {
        mostrarToast('O histórico já está vazio.', 'info');
        return;
    }

    if (!estado.confirmandoLimpeza) {
        estado.confirmandoLimpeza = true;
        dom.btnLimparHistorico.textContent = 'Confirmar limpeza?';
        dom.btnLimparHistorico.classList.add('confirmando');
        mostrarToast('Clique novamente em "Confirmar limpeza?" para apagar o histórico.', 'aviso');

        estado.timeoutLimpezaId = setTimeout(() => {
            restaurarBotaoLimparHistorico();
        }, 4000);
        return;
    }

    // Segundo clique confirmado: apaga os registros
    clearTimeout(estado.timeoutLimpezaId);
    restaurarBotaoLimparHistorico();

    estado.historico = [];
    salvarHistorico(estado.historico);
    renderizarHistorico();
    mostrarToast('Histórico limpo com sucesso.', 'sucesso');
}

function restaurarBotaoLimparHistorico() {
    estado.confirmandoLimpeza = false;
    dom.btnLimparHistorico.textContent = 'Limpar histórico';
    dom.btnLimparHistorico.classList.remove('confirmando');
}

/* ==========================================================================
   BLOCO 10: ABA CONTA E CONFIGURAÇÕES
   ========================================================================== */

/**
 * Preenche a aba Conta com os dados atuais salvos em estado.config.
 */
function renderizarConta() {
    const { nome, metaDiaria, somAtivo } = estado.config;
    const inicial = nome.trim().charAt(0).toUpperCase() || 'U';

    dom.avatarUsuario.textContent = inicial;
    dom.nomeUsuarioExibicao.textContent = nome;
    dom.resumoMetaUsuario.textContent = `Meta diária: ${metaDiaria} min de foco`;

    dom.inputNomeUsuario.value = nome;
    dom.inputMetaDiaria.value = String(metaDiaria);
    dom.inputSomAtivo.checked = Boolean(somAtivo);
}

/**
 * Salva alterações de nome, meta diária e preferência de som.
 */
function manipularSalvamentoConta(evento) {
    evento.preventDefault();

    const nome = dom.inputNomeUsuario.value.trim();
    const metaDiaria = Number(dom.inputMetaDiaria.value);
    const somAtivo = dom.inputSomAtivo.checked;

    if (!nome) {
        mostrarToast('Digite seu nome antes de salvar.', 'aviso');
        dom.inputNomeUsuario.focus();
        return;
    }

    if (!Number.isInteger(metaDiaria) || metaDiaria < 10 || metaDiaria > 600) {
        mostrarToast('A meta diária deve ser um número inteiro entre 10 e 600 minutos.', 'aviso');
        dom.inputMetaDiaria.focus();
        return;
    }

    estado.config = { nome, metaDiaria, somAtivo };
    salvarConfig(estado.config);

    renderizarConta();
    renderizarHistorico();
    mostrarToast('Configurações salvas com sucesso!', 'sucesso');
}

/* ==========================================================================
   BLOCO 11: REGISTRO DE EVENTOS E INICIALIZAÇÃO
   ========================================================================== */

/**
 * Conecta todos os cliques, envios de formulário e atalhos de teclado.
 */
function registrarEventos() {
    // Navegação inferior SPA
    dom.botoesNav.forEach((botao) => {
        botao.addEventListener('click', () => {
            alternarAba(botao.dataset.aba);
        });
    });

    // Modal de temas (abrir, fechar no X, fechar clicando fora e com tecla Escape)
    dom.btnTema.addEventListener('click', abrirModalTema);
    dom.btnFecharModal.addEventListener('click', fecharModalTema);
    dom.modalTema.addEventListener('click', (evento) => {
        if (evento.target === dom.modalTema) {
            fecharModalTema();
        }
    });
    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && dom.modalTema.classList.contains('aberto')) {
            fecharModalTema();
        }
    });

    // Formulário de tarefas
    dom.formTarefa.addEventListener('submit', manipularCriacaoTarefa);

    // Controles do cronômetro Pomodoro
    dom.btnIniciar.addEventListener('click', iniciarTimer);
    dom.btnPausar.addEventListener('click', pausarTimer);
    dom.btnZerar.addEventListener('click', zerarTimer);
    dom.btnConcluirCiclo.addEventListener('click', concluirCicloAtual);

    // Histórico
    dom.btnLimparHistorico.addEventListener('click', manipularLimpezaHistorico);

    // Conta e Configurações
    dom.formConfiguracoes.addEventListener('submit', manipularSalvamentoConta);
    dom.inputSomAtivo.addEventListener('change', () => {
        estado.config.somAtivo = dom.inputSomAtivo.checked;
        salvarConfig(estado.config);
        mostrarToast(
            estado.config.somAtivo ? 'Som do alarme ativado.' : 'Som do alarme desativado.',
            'info'
        );
    });
    dom.btnTestarSom.addEventListener('click', () => {
        tocarSomAlarme(true, false);
        const avisoExtra = estado.config.somAtivo ? '' : ' (o alarme está desativado no momento)';
        mostrarToast(`Som de alerta testado!${avisoExtra}`, 'info');
    });
}

/**
 * Ponto de entrada da aplicação: carrega os dados salvos e desenha a interface inicial.
 */
async function iniciarAplicacao() {
    // 1. Aplica o tema salvo e monta a grade dos 12 temas
    renderizarGradeTemas();
    aplicarTema(carregarTema(), false);

    // 2. Carrega configurações, histórico e tarefas (via camada assíncrona)
    estado.config = carregarConfig();
    estado.historico = carregarHistorico();
    estado.tarefas = await listarTarefas();

    // 3. Renderiza todas as telas e registra os eventos
    atualizarInterfaceTimer();
    renderizarTarefas();
    renderizarHistorico();
    renderizarConta();
    registrarEventos();
}

// Inicia tudo assim que o HTML terminar de carregar
document.addEventListener('DOMContentLoaded', iniciarAplicacao);
