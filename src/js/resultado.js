// Script para página de resultado do agendamento

// Função para obter SVG de ícones
function obterSvgIcone(nomeIcone, cor = 'text-gray-600') {
  const icones = {
    'check': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
    'alert': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
    'money': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    'bus': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`,
    'transfer': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>`,
    'priority': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>`,
    'info': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    // Fallback para emojis
    '✅': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
    '⚠️': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
    '❌': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
    '💰': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    '💵': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`,
    '🚌': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`,
    '🔄': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`,
    '⭐': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>`,
    '⏱️': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    '⏳': `<svg class="w-6 h-6 ${cor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
  };

  return icones[nomeIcone] || icones['info'];
}

document.addEventListener('DOMContentLoaded', () => {
  carregarResultado();

  // Mostrar data atual
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  document.getElementById('data-agendamento').textContent = dataFormatada;
});

function carregarResultado() {
  const resultadoJSON = localStorage.getItem('resultadoAgendamento');

  if (!resultadoJSON) {
    mostrarErro('Nenhum resultado encontrado. Por favor, faça um novo agendamento.');
    return;
  }

  try {
    const resultado = JSON.parse(resultadoJSON);
    console.log('Resultado carregado:', resultado);

    preencherDadosPaciente(resultado);
    preencherMelhorOpcao(resultado.melhorOpcao);
    preencherExplicacao(resultado.explicacao);
    preencherTransparencia(resultado.explicacao?.transparencia);
    preencherAlternativas(resultado.alternativas || []);
    carregarMapa(resultado.melhorOpcao);

  } catch (error) {
    console.error('Erro ao processar resultado:', error);
    mostrarErro('Erro ao carregar resultado do agendamento.');
  }
}

function preencherDadosPaciente(resultado) {
  const container = document.getElementById('dados-paciente');
  const paciente = resultado.paciente || resultado.melhorOpcao?.paciente || {};

  const formatarGenero = (genero) => {
    const generos = {
      'feminino': 'Feminino',
      'masculino': 'Masculino',
      'outro': 'Outro'
    };
    return generos[genero] || 'Não informado';
  };

  const html = `
    <div class="space-y-2 text-sm">
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">Nome</span>
        <span class="font-semibold text-gray-900">${paciente.nome || 'Não informado'}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">CPF</span>
        <span class="font-semibold text-gray-900">${paciente.cpf || 'Não informado'}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">Gênero</span>
        <span class="font-semibold text-gray-900">${formatarGenero(paciente.genero)}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">Idade</span>
        <span class="font-semibold text-gray-900">${paciente.idade || 'Não informado'} anos</span>
      </div>
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">Telefone</span>
        <span class="font-semibold text-gray-900">${paciente.telefone || 'Não informado'}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">Município</span>
        <span class="font-semibold text-gray-900 capitalize">${paciente.municipioOrigem || 'Não informado'}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">Endereço</span>
        <span class="font-semibold text-gray-900 text-right">${paciente.endereco || 'Não informado'}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">Especialidade</span>
        <span class="font-semibold text-gray-900 capitalize">${paciente.especialidade?.replace(/-/g, ' ') || 'Não informado'}</span>
      </div>
      ${paciente.prioridade ? `
      <div class="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
        <span class="text-xs text-blue-600 font-semibold">PRIORIDADE</span>
        <p class="text-sm font-bold text-blue-900 mt-1">${paciente.prioridade}</p>
      </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = html;
}

function preencherMelhorOpcao(melhorOpcao) {
  const container = document.getElementById('melhor-opcao');
  const detalhes = melhorOpcao.detalhes || {};
  const especialista = melhorOpcao.especialista || {};

  // Gerar razões para recomendação
  const razoes = [];
  if (detalhes.distancia < 10) razoes.push('Menor distância');
  if (detalhes.tempoEspera < 7) razoes.push('Menor tempo de espera');
  if (detalhes.custo < 20) razoes.push('Menor custo de transporte');
  if (detalhes.numeroTransferencias === 0) razoes.push('Sem transferências');
  if (razoes.length === 0) razoes.push('Melhor equilíbrio entre os critérios');

  const html = `
    <div class="space-y-4">
      <div>
        <h3 class="text-2xl font-bold mb-1">${especialista.municipio || 'Aguardando confirmação'}</h3>
        <p class="text-white/90 text-lg">${especialista.unidade || 'Aguardando confirmação'}</p>
        <p class="text-white/70 text-sm mt-2">${especialista.nome || 'Aguardando designação'}</p>
      </div>

      <div class="grid grid-cols-3 gap-3 mt-6">
        <div class="bg-white/10 backdrop-blur rounded-xl p-4 text-center border border-white/20">
          <p class="text-white/70 text-xs uppercase mb-1">Distância</p>
          <p class="text-3xl font-bold">${detalhes.distancia?.toFixed(1) || '0'}</p>
          <p class="text-white/70 text-xs mt-1">km</p>
        </div>
        <div class="bg-white/10 backdrop-blur rounded-xl p-4 text-center border border-white/20">
          <p class="text-white/70 text-xs uppercase mb-1">Espera</p>
          <p class="text-3xl font-bold">${detalhes.tempoEspera || '0'}</p>
          <p class="text-white/70 text-xs mt-1">dias</p>
        </div>
        <div class="bg-white/10 backdrop-blur rounded-xl p-4 text-center border border-white/20">
          <p class="text-white/70 text-xs uppercase mb-1">Custo</p>
          <p class="text-2xl font-bold">R$ ${detalhes.custo?.toFixed(2) || '0.00'}</p>
          <p class="text-white/70 text-xs mt-1">transporte</p>
        </div>
      </div>

      <div class="bg-white/5 backdrop-blur rounded-xl p-4 mt-4 border border-white/10">
        <div class="grid grid-cols-1 gap-2 text-sm">
          <div class="flex justify-between">
            <span class="text-white/70">Tempo de viagem</span>
            <span class="font-semibold">${detalhes.tempoViagem || 'Calculando...'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/70">Transferências</span>
            <span class="font-semibold">${detalhes.numeroTransferencias || 0} embarque(s)</span>
          </div>
        </div>
      </div>

      <div class="bg-white/10 backdrop-blur rounded-xl p-4 mt-4 border border-white/20">
        <h4 class="font-bold text-sm mb-2 flex items-center">
          <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path>
          </svg>
          Por que esta é a recomendação:
        </h4>
        <ul class="space-y-1 text-sm">
          ${razoes.map(razao => `
            <li class="flex items-start">
              <svg class="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
              <span>${razao}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function preencherExplicacao(explicacao) {
  if (!explicacao) return;

  const container = document.getElementById('explicacao-decisao');

  let html = '';

  if (explicacao.fatores && explicacao.fatores.length > 0) {
    explicacao.fatores.forEach(fator => {
      const corBorda = fator.tipo === 'positivo' ? 'border-green-400 bg-green-50' :
                       fator.tipo === 'negativo' ? 'border-red-400 bg-red-50' :
                       fator.tipo === 'info' ? 'border-blue-400 bg-blue-50' :
                       'border-gray-400 bg-gray-50';

      const corTexto = fator.tipo === 'positivo' ? 'text-green-900' :
                       fator.tipo === 'negativo' ? 'text-red-900' :
                       fator.tipo === 'info' ? 'text-blue-900' :
                       'text-gray-900';

      const corIcone = fator.tipo === 'positivo' ? 'text-green-600' :
                       fator.tipo === 'negativo' ? 'text-red-600' :
                       fator.tipo === 'info' ? 'text-blue-600' :
                       'text-gray-600';

      const icone = obterSvgIcone(fator.icone || 'info', corIcone);

      html += `
        <div class="flex items-start border-l-4 ${corBorda} p-4 rounded-r-lg shadow-sm">
          <div class="mr-3 flex-shrink-0">${icone}</div>
          <p class="${corTexto} font-medium">${fator.texto}</p>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

function preencherTransparencia(transparencia) {
  const container = document.getElementById('transparencia');

  if (!transparencia || !transparencia.pesos) {
    container.innerHTML = '<p class="text-gray-600">Informações de transparência não disponíveis</p>';
    return;
  }

  const html = Object.entries(transparencia.pesos).map(([criterio, peso]) => {
    const porcentagem = (peso * 100).toFixed(0);
    return `
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div class="flex justify-between items-center mb-2">
          <span class="font-semibold text-gray-900 capitalize">${criterio.replace('_', ' ')}</span>
          <span class="text-lg font-bold text-amber-600">${porcentagem}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-gradient-to-r from-amber-400 to-amber-600 h-2 rounded-full transition-all" style="width: ${porcentagem}%"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function preencherAlternativas(alternativas) {
  const container = document.getElementById('opcoes-alternativas');

  if (!alternativas || alternativas.length === 0) {
    document.getElementById('container-alternativas').style.display = 'none';
    return;
  }

  const html = alternativas.slice(0, 3).map((alt, index) => {
    const especialista = alt.especialista || {};
    const detalhes = alt.detalhes || {};
    const pros = alt.pros || [];
    const contras = alt.contras || [];

    // Gerar prós e contras automaticamente se não existirem
    const prosGerados = pros.length > 0 ? pros : gerarPros(detalhes, index);
    const contrasGerados = contras.length > 0 ? contras : gerarContras(detalhes, index);

    return `
      <div class="bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-blue-400 transition shadow-sm" id="alternativa-${index}">
        <div class="flex justify-between items-start mb-4">
          <div class="flex-1">
            <h4 class="font-bold text-gray-900 text-lg">${especialista.municipio || 'Local não especificado'}</h4>
            <p class="text-sm text-gray-600">${especialista.unidade || 'Unidade não especificada'}</p>
          </div>
          <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
            Opção ${index + 2}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-3 text-center text-sm mb-4 bg-gray-50 p-3 rounded-lg">
          <div>
            <p class="text-gray-500 text-xs mb-1">Distância</p>
            <p class="font-bold text-gray-900">${detalhes.distancia?.toFixed(1) || 'N/A'} km</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-1">Espera</p>
            <p class="font-bold text-gray-900">${detalhes.tempoEspera || 'N/A'} dias</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-1">Custo</p>
            <p class="font-bold text-gray-900">R$ ${detalhes.custo?.toFixed(2) || '0.00'}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-4">
          <!-- Prós -->
          <div class="bg-green-50 rounded-lg p-3 border border-green-200">
            <h5 class="font-bold text-green-900 text-xs mb-2 flex items-center">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
              VANTAGENS
            </h5>
            <ul class="space-y-1">
              ${prosGerados.map(pro => `
                <li class="text-xs text-green-800 flex items-start">
                  <span class="mr-1">•</span>
                  <span>${pro}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Contras -->
          <div class="bg-red-50 rounded-lg p-3 border border-red-200">
            <h5 class="font-bold text-red-900 text-xs mb-2 flex items-center">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
              DESVANTAGENS
            </h5>
            <ul class="space-y-1">
              ${contrasGerados.map(contra => `
                <li class="text-xs text-red-800 flex items-start">
                  <span class="mr-1">•</span>
                  <span>${contra}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>

        <!-- Botão de Seleção -->
        <button onclick="selecionarAlternativa(${index}, '${especialista.municipio}', '${especialista.unidade}')"
                class="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Selecionar Esta Opção
        </button>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function gerarPros(detalhes, index) {
  const pros = [];

  if (detalhes.distancia < 10) {
    pros.push('Localização próxima ao paciente');
  }

  if (detalhes.tempoEspera < 7) {
    pros.push('Tempo de espera reduzido');
  }

  if (detalhes.custo < 20) {
    pros.push('Baixo custo de transporte');
  }

  if (detalhes.numeroTransferencias === 0) {
    pros.push('Acesso direto sem transferências');
  }

  if (pros.length === 0) {
    pros.push('Opção viável para atendimento');
  }

  return pros;
}

function gerarContras(detalhes, index) {
  const contras = [];

  if (detalhes.distancia > 15) {
    contras.push('Distância maior que a recomendada');
  }

  if (detalhes.tempoEspera > 10) {
    contras.push('Tempo de espera mais longo');
  }

  if (detalhes.custo > 30) {
    contras.push('Custo de transporte elevado');
  }

  if (detalhes.numeroTransferencias > 1) {
    contras.push(`Requer ${detalhes.numeroTransferencias} transferências`);
  }

  if (contras.length === 0) {
    contras.push('Não é a opção prioritária do sistema');
  }

  return contras;
}

function carregarGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.GOOGLE_MAPS_API_KEY) {
      reject(new Error('Chave de API do Google Maps não configurada'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${APP_CONFIG.GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Erro ao carregar Google Maps'));
    document.head.appendChild(script);
  });
}

async function carregarMapa(melhorOpcao) {
  const mapContainer = document.getElementById('mapa');

  if (typeof google === 'undefined') {
    mapContainer.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p class="mt-4 text-gray-600">Carregando mapa...</p>
        </div>
      </div>
    `;

    try {
      await carregarGoogleMaps();
    } catch (error) {
      console.error('Erro ao carregar Google Maps:', error);
      mapContainer.innerHTML = `
        <div class="flex items-center justify-center h-full">
          <div class="text-center">
            <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-red-600 font-semibold">Erro ao carregar mapa</p>
            <p class="text-sm text-gray-500 mt-2">Verifique a configuração da API</p>
          </div>
        </div>
      `;
      return;
    }
  }

  try {
    const especialista = melhorOpcao.especialista || {};
    const coordenadas = especialista.coordenadas || { lat: -8.0476, lng: -34.8770 };

    const map = new google.maps.Map(mapContainer, {
      center: coordenadas,
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
      ]
    });

    new google.maps.Marker({
      position: coordenadas,
      map: map,
      title: `${especialista.municipio} - ${especialista.unidade}`,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#2563eb',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      }
    });

  } catch (error) {
    console.error('Erro ao renderizar mapa:', error);
    mapContainer.innerHTML = `
      <div class="flex items-center justify-center h-full bg-gray-100">
        <p class="text-gray-600">Erro ao exibir localização no mapa</p>
      </div>
    `;
  }
}

function mostrarErro(mensagem) {
  document.body.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <svg class="w-20 h-20 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 mb-3">Ops!</h2>
        <p class="text-gray-600 mb-6">${mensagem}</p>
        <a href="index.html" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
          Fazer Novo Agendamento
        </a>
      </div>
    </div>
  `;
}

// Variável global para armazenar a opção selecionada
let opcaoSelecionadaGlobal = null;

function selecionarAlternativa(index, municipio, unidade) {
  // Remover seleção anterior
  document.querySelectorAll('[id^="alternativa-"]').forEach(el => {
    el.classList.remove('border-green-600', 'bg-green-50');
    el.classList.add('border-gray-200');
  });

  // Adicionar seleção à nova opção
  const alternativa = document.getElementById(`alternativa-${index}`);
  if (alternativa) {
    alternativa.classList.remove('border-gray-200');
    alternativa.classList.add('border-green-600', 'bg-green-50');
  }

  // Armazenar opção selecionada
  opcaoSelecionadaGlobal = {
    tipo: 'alternativa',
    index: index,
    municipio: municipio,
    unidade: unidade
  };

  // Mostrar feedback visual
  const feedbackDiv = document.getElementById('opcao-selecionada');
  const textoDiv = document.getElementById('texto-opcao-selecionada');
  if (feedbackDiv && textoDiv) {
    textoDiv.textContent = `Opção ${index + 2}: ${municipio} - ${unidade}`;
    feedbackDiv.classList.remove('hidden');
  }

  // Scroll suave para a seção de ações
  document.querySelector('[id="opcao-selecionada"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function confirmarRecomendacao() {
  const resultado = JSON.parse(localStorage.getItem('resultadoAgendamento') || '{}');
  const paciente = resultado.paciente || {};

  let opcaoFinal;

  if (opcaoSelecionadaGlobal && opcaoSelecionadaGlobal.tipo === 'alternativa') {
    opcaoFinal = resultado.alternativas[opcaoSelecionadaGlobal.index];
  } else {
    opcaoFinal = resultado.melhorOpcao;
  }

  const especialista = opcaoFinal?.especialista || {};

  const mensagem = `✅ AGENDAMENTO CONFIRMADO\n\n` +
    `Paciente: ${paciente.nome || 'Não informado'}\n` +
    `CPF: ${paciente.cpf || 'Não informado'}\n` +
    `Telefone: ${paciente.telefone || 'Não informado'}\n\n` +
    `📍 Local: ${especialista.municipio || 'Não informado'}\n` +
    `🏥 Unidade: ${especialista.unidade || 'Não informado'}\n\n` +
    `Agendamento realizado em: ${new Date().toLocaleString('pt-BR')}`;

  alert(mensagem);

  // Opcionalmente, limpar localStorage e redirecionar
  if (confirm('Deseja fazer um novo agendamento?')) {
    localStorage.removeItem('resultadoAgendamento');
    window.location.href = 'index.html';
  }
}

function enviarWhatsApp() {
  const resultado = JSON.parse(localStorage.getItem('resultadoAgendamento') || '{}');
  const paciente = resultado.paciente || {};

  let opcaoFinal;

  if (opcaoSelecionadaGlobal && opcaoSelecionadaGlobal.tipo === 'alternativa') {
    opcaoFinal = resultado.alternativas[opcaoSelecionadaGlobal.index];
  } else {
    opcaoFinal = resultado.melhorOpcao;
  }

  const especialista = opcaoFinal?.especialista || {};
  const detalhes = opcaoFinal?.detalhes || {};

  // Extrair apenas números do telefone
  const telefone = (paciente.telefone || '').replace(/\D/g, '');

  if (!telefone || telefone.length < 10) {
    alert('Telefone do paciente inválido ou não informado');
    return;
  }

  const mensagem = `Olá *${paciente.nome}*! 👋\n\n` +
    `Seu agendamento foi processado pelo Sistema de Saúde de PE.\n\n` +
    `📍 *Local recomendado:*\n` +
    `${especialista.municipio} - ${especialista.unidade}\n\n` +
    `📊 *Informações:*\n` +
    `• Distância: ${detalhes.distancia?.toFixed(1) || 'N/A'} km\n` +
    `• Tempo de espera: ${detalhes.tempoEspera || 'N/A'} dias\n` +
    `• Custo estimado de transporte: R$ ${detalhes.custo?.toFixed(2) || '0.00'}\n\n` +
    `Em breve entraremos em contato para confirmar o agendamento.`;

  const mensagemCodificada = encodeURIComponent(mensagem);
  const urlWhatsApp = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;

  window.open(urlWhatsApp, '_blank');
}

function compartilharResultado() {
  if (navigator.share) {
    navigator.share({
      title: 'Resultado do Agendamento',
      text: 'Veja o resultado do meu agendamento de consulta',
      url: window.location.href
    }).catch(err => console.log('Erro ao compartilhar:', err));
  } else {
    alert('Função de compartilhamento não disponível neste navegador');
  }
}
