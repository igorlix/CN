document.addEventListener('DOMContentLoaded', () => {
    // 1. Recuperar dados do LocalStorage
    const dadosRaw = localStorage.getItem('resultadoAgendamento');
    const dadosPacienteRaw = localStorage.getItem('dadosPacienteForm'); // Tenta pegar backup do form se existir
    
    if (!dadosRaw) {
        alert('Nenhum resultado encontrado. Redirecionando para o início.');
        window.location.href = 'index.html';
        return;
    }

    try {
        const resultado = JSON.parse(dadosRaw);
        
        // Tentar reconstruir o objeto paciente se ele não veio completo no resultado
        let paciente = resultado.paciente;
        if (!paciente && dadosPacienteRaw) {
            paciente = JSON.parse(dadosPacienteRaw);
        }
        
        // Se ainda não tiver, cria um objeto seguro para não quebrar a tela
        if (!paciente) {
            paciente = { nome: 'Paciente', cpf: '000.000.000-00', idade: '--', especialidade: 'Geral' };
        }

        // Adiciona paciente ao objeto principal para facilitar acesso
        resultado.paciente = paciente;

        // 2. Preparar lista unificada de opções
        // Garante que 'alternativas' seja um array mesmo se vier undefined
        const alternativas = Array.isArray(resultado.alternativas) ? resultado.alternativas : [];
        const todasOpcoes = [
            { ...resultado.melhorOpcao, tipo: 'recomendado' },
            ...alternativas.map(alt => ({ ...alt, tipo: 'alternativa' }))
        ];

        // 3. Inicializar a Página
        inicializarPagina(resultado, todasOpcoes);

    } catch (e) {
        console.error("Erro crítico ao carregar dados:", e);
        alert("Erro ao processar os dados do agendamento. Tente novamente.");
    }
});

function inicializarPagina(resultado, listaOpcoes) {
    // Gerar Protocolo
    document.getElementById('protocolo-id').textContent = 'PE-' + Date.now().toString().slice(-8);

    // Renderizar Dados do Paciente
    renderizarDadosPaciente(resultado.paciente);

    // Renderizar Menu Lateral
    renderizarMenuSelecao(listaOpcoes);

    // Selecionar a primeira opção (Recomendada) por padrão
    if (listaOpcoes.length > 0) {
        selecionarOpcao(0, listaOpcoes);
    }
}

// --- RENDERIZAÇÃO ---

function renderizarDadosPaciente(paciente) {
    const container = document.getElementById('dados-paciente');

    // Formatar CPF (censurar meio)
    const cpfFormatado = paciente.cpf ? paciente.cpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '$1.***.$3-$4') : '---';

    // Formatar sexo
    const sexoMap = {
        'masculino': 'Masculino',
        'feminino': 'Feminino',
        'outro': 'Outro'
    };
    const sexoFormatado = sexoMap[paciente.sexo] || paciente.sexo || '---';

    container.innerHTML = `
        <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Nome</span>
            <span class="font-semibold text-gray-900 text-right truncate pl-2">${paciente.nome || 'Não informado'}</span>
        </div>
        <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="text-gray-500 font-medium">CPF</span>
            <span class="font-medium text-gray-900 text-right font-mono">${cpfFormatado}</span>
        </div>
        <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Sexo</span>
            <span class="font-medium text-gray-900 text-right">${sexoFormatado}</span>
        </div>
        <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Idade</span>
            <span class="font-medium text-gray-900 text-right">${paciente.idade || '--'} anos</span>
        </div>
        <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Especialidade</span>
            <span class="font-semibold text-blue-600 text-right capitalize">${paciente.especialidade || 'Não informado'}</span>
        </div>
        <div class="flex flex-col py-2">
            <span class="text-gray-500 font-medium mb-1">Endereço</span>
            <span class="font-medium text-gray-700 text-xs leading-relaxed">${paciente.endereco || paciente.municipio || 'Não informado'}</span>
        </div>
    `;
}

function renderizarMenuSelecao(listaOpcoes) {
    const menuContainer = document.getElementById('menu-opcoes');
    menuContainer.innerHTML = '';

    listaOpcoes.forEach((opcao, index) => {
        const isRecomendado = index === 0;
        const div = document.createElement('div');
        
        // Classes base
        div.className = `option-card border rounded-lg p-3 mb-2 flex items-center justify-between bg-white`;
        if(isRecomendado) div.classList.add('border-blue-200', 'bg-blue-50'); // Destaque inicial leve
        
        div.id = `card-opcao-${index}`;
        div.onclick = () => selecionarOpcao(index, listaOpcoes);

        // Badge
        const badge = isRecomendado 
            ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-green-200">Recomendado</span>`
            : `<span class="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-gray-200">Opção ${index + 1}</span>`;

        // Extração segura de dados
        const municipio = opcao.especialista?.municipio || 'Local';
        const unidade = opcao.especialista?.unidade || opcao.especialista?.nome || 'Unidade';
        const distancia = opcao.detalhes?.distancia || 0;

        div.innerHTML = `
            <div class="flex-1 min-w-0 pr-2">
                <div class="flex items-center gap-2 mb-1">
                    ${badge}
                    <h4 class="font-bold text-gray-800 text-sm truncate">${municipio}</h4>
                </div>
                <p class="text-xs text-gray-500 truncate">${unidade}</p>
            </div>
            <div class="text-right whitespace-nowrap">
                <p class="font-bold text-blue-600 text-sm">${distancia.toFixed(1)} km</p>
            </div>
        `;

        menuContainer.appendChild(div);
    });
}

// --- LÓGICA DE INTERAÇÃO ---

function selecionarOpcao(selectedIndex, listaOpcoes) {
    const opcao = listaOpcoes[selectedIndex];
    if (!opcao) return;

    // Salvar opção selecionada globalmente para usar no WhatsApp
    opcaoSelecionadaAtual = opcao;

    // 1. Atualizar Visual do Menu
    listaOpcoes.forEach((_, idx) => {
        const card = document.getElementById(`card-opcao-${idx}`);
        if (card) {
            if (idx === selectedIndex) {
                card.classList.add('selected');
                card.classList.remove('border-gray-200', 'border-blue-200'); // Remove bordas padrão para assumir a selected
            } else {
                card.classList.remove('selected');
                card.classList.add('border-gray-200');
            }
        }
    });

    // 2. Extração segura de dados
    const esp = opcao.especialista || {};
    const det = opcao.detalhes || {};
    const unidadeNome = esp.unidade || esp.nome || 'Unidade de Saúde';
    const endereco = esp.endereco || 'Endereço não disponível';
    const municipio = esp.municipio || '';
    
    // 3. Atualizar Cabeçalho do Card
    document.getElementById('titulo-unidade').textContent = `${municipio} - ${unidadeNome}`;
    document.getElementById('endereco-unidade').textContent = endereco;
    
    const badge = document.getElementById('badge-recomendacao');
    const scoreEl = document.getElementById('score-ia');

    // Fitness do GA (0-1), converter para percentual
    const scoreVal = opcao.score ? (opcao.score * 100).toFixed(1) + '%' : '--';
    scoreEl.textContent = scoreVal;
    
    if (selectedIndex === 0) {
        badge.textContent = "Melhor Opção (IA)";
        badge.className = "inline-block px-2 py-1 rounded bg-green-400 text-green-900 text-xs font-bold uppercase tracking-wide mb-2 backdrop-blur-sm shadow-sm";
    } else {
        badge.textContent = "Alternativa";
        badge.className = "inline-block px-2 py-1 rounded bg-white/20 border border-white/40 text-white text-xs font-bold uppercase tracking-wide mb-2";
    }

    // 4. Atualizar Métricas
    document.getElementById('metrica-distancia').textContent = det.distancia ? `${det.distancia.toFixed(1)} km` : '--';

    // Calcular data do agendamento
    if (det.tempoEspera !== undefined) {
        const dataAgendamento = new Date();
        dataAgendamento.setDate(dataAgendamento.getDate() + det.tempoEspera);
        const dataFormatada = dataAgendamento.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        document.getElementById('metrica-espera').innerHTML = `
            <span class="block">${det.tempoEspera} dias</span>
            <span class="block text-xs text-gray-500 font-normal mt-0.5">${dataFormatada}</span>
        `;

        // Salvar data para usar depois
        opcao.dataAgendamento = dataFormatada;
    } else {
        document.getElementById('metrica-espera').textContent = '--';
    }

    document.getElementById('metrica-custo').textContent = det.custo !== undefined ? `R$ ${det.custo.toFixed(2)}` : '--';
    
    // Probabilidade de falha (No Show)
    // Verifica diferentes chaves possíveis vindas do backend
    let prob = det.probabilidadeNoShow || det.prob_noshow || det.probNoShow || 0;
    // Se for decimal (0.1), converte para %. Se já for inteiro (10), mantém.
    if (prob > 0 && prob < 1) prob = prob * 100;
    
    const elProb = document.getElementById('metrica-noshow');
    elProb.textContent = Math.round(prob) + '%';
    
    // Cor da probabilidade
    if (prob < 15) elProb.className = "text-xl font-bold text-green-600";
    else if (prob < 40) elProb.className = "text-xl font-bold text-yellow-600";
    else elProb.className = "text-xl font-bold text-red-600";


    // 5. Atualizar Texto de Análise
    atualizarTextoAnalise(det, selectedIndex === 0);

    // 6. Atualizar Mapa
    atualizarMapa(esp);
}

function atualizarTextoAnalise(detalhes, isRecomendado) {
    const div = document.getElementById('texto-analise');
    const dist = detalhes.distancia || 0;
    const espera = detalhes.tempoEspera || 0;
    
    let html = "";

    if (isRecomendado) {
        html += `<p class="font-semibold text-indigo-800 mb-1">Por que esta opção foi escolhida?</p>`;
        html += `<p>O algoritmo genético identificou esta unidade como o ponto de equilíbrio ideal.</p>`;
        html += `<ul class="list-disc list-inside mt-2 space-y-1 text-indigo-700">`;
        html += `<li>Minimiza sua distância de deslocamento (${dist.toFixed(1)} km).</li>`;
        html += `<li>Garante atendimento em um prazo razoável (${espera} dias).</li>`;
        html += `<li>Considera a facilidade de transporte público na região.</li>`;
        html += `</ul>`;
    } else {
        html += `<p class="font-semibold text-amber-800 mb-1">Nota sobre esta alternativa:</p>`;
        html += `<p>Você está visualizando uma opção manual.</p>`;
        html += `<ul class="list-disc list-inside mt-2 space-y-1 text-indigo-700">`;
        
        if (dist > 25) {
            html += `<li class="text-amber-700"><strong>Atenção:</strong> Esta unidade é distante (${dist.toFixed(1)} km). O custo de transporte pode ser maior.</li>`;
        } else {
            html += `<li>A distância é aceitável (${dist.toFixed(1)} km).</li>`;
        }

        if (espera < 5) {
            html += `<li class="text-green-700"><strong>Vantagem:</strong> O tempo de espera é muito curto (${espera} dias).</li>`;
        } else {
            html += `<li>Tempo de espera estimado em ${espera} dias.</li>`;
        }
        
        html += `</ul>`;
    }

    div.innerHTML = html;
}

let mapaGoogleAtual = null;

async function atualizarMapa(especialista) {
    const mapContent = document.getElementById('mapa-content');

    const lat = especialista.coordenadas?.lat || especialista.lat || -8.0;
    const lng = especialista.coordenadas?.lng || especialista.lon || -34.9;

    // Criar container para o mapa
    mapContent.innerHTML = '<div id="google-map-resultado" class="w-full h-full"></div>';

    try {
        // Aguardar Google Maps carregar
        if (typeof google === 'undefined') {
            await mapsIntegration.init();
        }

        // Criar mapa
        const mapElement = document.getElementById('google-map-resultado');
        const position = { lat, lng };

        mapaGoogleAtual = new google.maps.Map(mapElement, {
            center: position,
            zoom: 14,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });

        // Adicionar marcador da UPAE
        new google.maps.Marker({
            position: position,
            map: mapaGoogleAtual,
            title: especialista.unidade || especialista.nome,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#EF4444',
                fillOpacity: 1,
                strokeColor: '#DC2626',
                strokeWeight: 2
            }
        });

        // Info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div class="p-2">
                    <h3 class="font-bold text-sm">${especialista.municipio}</h3>
                    <p class="text-xs text-gray-600">${especialista.unidade || especialista.nome}</p>
                </div>
            `
        });

        const marker = new google.maps.Marker({
            position: position,
            map: mapaGoogleAtual,
            title: especialista.unidade || especialista.nome
        });

        marker.addListener('click', () => {
            infoWindow.open(mapaGoogleAtual, marker);
        });

    } catch (error) {
        console.error('Erro ao carregar mapa:', error);
        // Fallback para visualização estática
        mapContent.innerHTML = `
            <div class="relative w-full h-full bg-blue-50 overflow-hidden flex items-center justify-center">
                <div class="text-center">
                    <svg class="w-12 h-12 text-red-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <p class="text-xs text-gray-600 font-mono">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                    <p class="text-xs text-gray-400 mt-1">Mapa indisponível</p>
                </div>
            </div>
        `;
    }
}

// Dados da opção selecionada atualmente
let opcaoSelecionadaAtual = null;

// Tornar função global para o botão HTML chamar
window.confirmarAgendamento = function() {
    const btn = document.querySelector('button[onclick="confirmarAgendamento()"]');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<span class="flex items-center gap-2"><svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processando...</span>`;

    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        mostrarPopupSucesso();
    }, 1000);
};

function mostrarPopupSucesso() {
    // Recuperar dados do localStorage
    const dadosRaw = localStorage.getItem('resultadoAgendamento');
    const dados = dadosRaw ? JSON.parse(dadosRaw) : {};
    const paciente = dados.paciente || {};

    // Criar overlay e popup
    const overlay = document.createElement('div');
    overlay.id = 'popup-sucesso';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    overlay.onclick = (e) => {
        if (e.target === overlay) fecharPopup();
    };

    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
            <!-- Header Success -->
            <div class="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
                <div class="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-4">
                    <svg class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <h2 class="text-3xl font-bold text-white mb-2">Agendamento Confirmado!</h2>
                <p class="text-green-50">Protocolo: PE-${Date.now().toString().slice(-8)}</p>
            </div>

            <!-- Body -->
            <div class="p-6">
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 class="font-bold text-gray-800 mb-3">Detalhes do Agendamento:</h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Paciente:</span>
                            <span class="font-semibold text-gray-900">${paciente.nome || 'Não informado'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Especialidade:</span>
                            <span class="font-semibold text-blue-600">${paciente.especialidade || 'Não informado'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Local:</span>
                            <span class="font-semibold text-gray-900">${opcaoSelecionadaAtual?.especialista?.municipio || 'UPAE'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Data Prevista:</span>
                            <span class="font-semibold text-green-600">${opcaoSelecionadaAtual?.dataAgendamento || 'A confirmar'}</span>
                        </div>
                    </div>
                </div>

                <p class="text-sm text-gray-600 text-center mb-6">
                    Enviamos os detalhes por SMS. Você também pode compartilhar via WhatsApp!
                </p>

                <!-- Botões -->
                <div class="flex gap-3">
                    <button onclick="fecharPopup()" class="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition">
                        Fechar
                    </button>
                    <button onclick="abrirWhatsApp()" class="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        Compartilhar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animar entrada
    setTimeout(() => {
        overlay.querySelector('.animate-scale-in').style.transform = 'scale(1)';
    }, 10);
}

window.fecharPopup = function() {
    const popup = document.getElementById('popup-sucesso');
    if (popup) {
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 200);
    }

    const whatsapp = document.getElementById('whatsapp-modal');
    if (whatsapp) {
        whatsapp.style.opacity = '0';
        setTimeout(() => whatsapp.remove(), 200);
    }
};

window.abrirWhatsApp = function() {
    fecharPopup();

    setTimeout(() => {
        mostrarWhatsAppSimulado();
    }, 300);
};

function mostrarWhatsAppSimulado() {
    // Recuperar dados
    const dadosRaw = localStorage.getItem('resultadoAgendamento');
    const dados = dadosRaw ? JSON.parse(dadosRaw) : {};
    const paciente = dados.paciente || {};
    const protocolo = 'PE-' + Date.now().toString().slice(-8);

    const esp = opcaoSelecionadaAtual?.especialista || {};
    const det = opcaoSelecionadaAtual?.detalhes || {};

    // Criar modal
    const modal = document.createElement('div');
    modal.id = 'whatsapp-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
    modal.onclick = (e) => {
        if (e.target === modal) fecharPopup();
    };

    modal.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <!-- Header WhatsApp -->
            <div class="bg-[#075E54] text-white p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button onclick="fecharPopup()" class="hover:bg-white/10 p-1 rounded-full transition">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 font-bold">
                        U
                    </div>
                    <div>
                        <h3 class="font-semibold">UPAE ${esp.municipio || 'Saúde'}</h3>
                        <p class="text-xs text-green-100">Sistema de Regulação</p>
                    </div>
                </div>
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                    <path d="M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0zM8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1z"/>
                </svg>
            </div>

            <!-- Wallpaper WhatsApp -->
            <div class="h-[500px] bg-[#ECE5DD] overflow-y-auto p-4" style="background-image: url('data:image/svg+xml,%3Csvg width=\\'100\\' height=\\'100\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M0 0h50v50H0z\\' fill=\\'%23d9d9d9\\' opacity=\\'.02\\'/%3E%3C/svg%3E');">

                <!-- Mensagem da UPAE -->
                <div class="flex mb-3">
                    <div class="bg-white rounded-lg shadow-sm p-3 max-w-xs">
                        <p class="text-sm text-gray-800 mb-2">
                            Olá, ${paciente.nome}!
                        </p>
                        <p class="text-sm text-gray-800 mb-2">
                            Seu agendamento foi confirmado com sucesso!
                        </p>
                        <p class="text-xs text-gray-400 text-right">10:23</p>
                    </div>
                </div>

                <!-- Detalhes do Agendamento (Card) -->
                <div class="flex mb-3">
                    <div class="bg-white rounded-lg shadow-md p-4 max-w-xs border-l-4 border-green-500">
                        <div class="flex items-center gap-2 mb-3">
                            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-900 text-sm">Consulta Agendada</h4>
                                <p class="text-xs text-gray-500">Protocolo: ${protocolo}</p>
                            </div>
                        </div>

                        <div class="space-y-2 text-sm border-t border-gray-100 pt-3">
                            <div class="flex justify-between">
                                <span class="text-gray-600">Especialidade:</span>
                                <span class="font-semibold text-gray-900">${paciente.especialidade || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Local:</span>
                                <span class="font-semibold text-gray-900">${esp.municipio || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Unidade:</span>
                                <span class="font-semibold text-gray-900 text-xs">${(esp.unidade || 'N/A').substring(0, 20)}...</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Data Prevista:</span>
                                <span class="font-semibold text-green-600">${opcaoSelecionadaAtual?.dataAgendamento || 'A definir'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Distância:</span>
                                <span class="font-semibold text-blue-600">${det.distancia?.toFixed(1) || '--'} km</span>
                            </div>
                        </div>

                        <div class="mt-3 pt-3 border-t border-gray-100">
                            <p class="text-xs text-gray-500 leading-relaxed">
                                <strong>Endereço:</strong><br/>
                                ${esp.endereco || 'Endereço não disponível'}
                            </p>
                        </div>

                        <p class="text-xs text-gray-400 text-right mt-2">10:24</p>
                    </div>
                </div>

                <!-- Mensagem de instrução -->
                <div class="flex mb-3">
                    <div class="bg-white rounded-lg shadow-sm p-3 max-w-xs">
                        <p class="text-sm text-gray-800 mb-1">
                            <strong>Importante:</strong>
                        </p>
                        <p class="text-sm text-gray-700 mb-2">
                            • Chegue com 15 minutos de antecedência<br/>
                            • Traga documento com foto<br/>
                            • Leve seus exames anteriores
                        </p>
                        <p class="text-xs text-gray-500 mb-1">
                            Em caso de dúvidas, ligue: <strong>(81) 3184-0000</strong>
                        </p>
                        <p class="text-xs text-gray-400 text-right">10:24</p>
                    </div>
                </div>

                <div class="text-center my-4">
                    <span class="bg-yellow-50 text-yellow-800 text-xs px-3 py-1 rounded-full border border-yellow-200">
                        Hoje
                    </span>
                </div>

            </div>

            <!-- Input (desabilitado) -->
            <div class="bg-[#F0F0F0] p-2 flex items-center gap-2">
                <div class="flex-1 bg-white rounded-full px-4 py-2 text-gray-400 text-sm">
                    Mensagem de exemplo...
                </div>
                <button class="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};