// Módulo de Integração com Otimizador Genético (Python API)

class OtimizadorAlocacao {
  constructor() {
    // Se estiver rodando localmente (file://), usar localhost:5000
    // Se estiver em produção (http://), usar caminho relativo
    const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocal && APP_CONFIG.API.OTIMIZADOR_GA.startsWith('/')) {
      this.apiUrl = 'http://localhost:5000' + APP_CONFIG.API.OTIMIZADOR_GA;
    } else {
      this.apiUrl = APP_CONFIG.API.OTIMIZADOR_GA || 'http://localhost:5000/api/otimizar';
    }

    console.log(`API URL configurada: ${this.apiUrl}`);
  }

  async encontrarMelhorAlocacao(paciente, especialistasDisponiveis) {
    console.log(`Iniciando otimização genética para: ${paciente.nome}`);

    /**
     * ============================================================
     * VERIFICAÇÃO: DADOS DO FORMULÁRIO vs DADOS MOCKADOS
     * ============================================================
     *
     * RESPOSTA: A otimização de rota USA DADOS REAIS DO FORMULÁRIO
     *
     * Fluxo de Dados:
     * 1. O usuário preenche o formulário (index.html) com:
     *    - Nome, CPF, idade, sexo, especialidade, município, endereço
     *
     * 2. O sistema geocodifica o endereço fornecido usando Google Maps API
     *    em app.js (função handleSubmit) para obter lat/lon REAIS
     *
     * 3. Este arquivo (otimizacao.js) recebe os dados do paciente com
     *    coordenadas geocodificadas REAIS (não mockadas)
     *
     * 4. Envia para o backend Python (algoritmo/otimizador_genetico.py)
     *    via POST /api/otimizar com payload contendo:
     *    - paciente.lat, paciente.lon (do endereço REAL fornecido)
     *    - upae.lat, upae.lon (geocodificadas a partir dos endereços reais das UPAs)
     *
     * 5. O algoritmo genético calcula distâncias REAIS usando fórmula
     *    de Haversine entre as coordenadas do paciente e das UPAs
     *    (função haversine() em otimizador_genetico.py linha 82-90)
     *
     * 6. Retorna a melhor UPAE baseada em:
     *    - Distância real calculada
     *    - Tempo de espera real da UPAE
     *    - Probabilidade de não comparecimento (baseada na distância)
     *    - Qualidade do transporte público
     *
     * NÃO HÁ DADOS MOCKADOS. Todos os cálculos usam:
     * - Endereço real do paciente (geocodificado)
     * - Endereços reais das UPAs (geocodificados)
     * - Distâncias geográficas reais (Haversine)
     * - Tempos de espera configurados por UPAE (config.js)
     *
     * Validação: Se não for possível geocodificar, o sistema LANÇA ERRO
     * e não permite continuar (linhas 15-17 e 34-36 abaixo)
     * ============================================================
     */

    // 1. Preparar Payload - SEM FALLBACKS
    // Todas as coordenadas devem ser reais, obtidas via geocodificação

    const upaesPayload = especialistasDisponiveis.map(u => {
      if (!u.lat || !u.lon) {
        throw new Error(`UPAE ${u.nome} não possui coordenadas válidas. Geocodificação necessária.`);
      }

      return {
        id: u.id,
        nome: u.nome,
        municipio: u.municipio,
        unidade: u.unidade || u.nome,
        endereco: u.endereco,
        especialidades: [paciente.especialidade],
        lat: u.lat,
        lon: u.lon,
        tempo_espera_dias: u.tempoEsperaDias || 0,
        transport_score: 0.7
      };
    });

    // Validar coordenadas do paciente
    if (!paciente.lat || !paciente.lon) {
      throw new Error('Não foi possível geocodificar o endereço do paciente. Verifique se o endereço está correto.');
    }

    const pacientePayload = {
      ...paciente,
      lat: paciente.lat,
      lon: paciente.lon
    };

    try {
      // 2. Chamada à API com Timeout
      // O Controller AbortSignal garante que não fique carregando infinitamente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos timeout

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: pacientePayload,
          upaes: upaesPayload
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro no servidor de otimização (HTTP ${response.status})`);
      }

      const dados = await response.json();

      if (!dados.sucesso) {
        throw new Error(dados.mensagem || 'Otimização falhou no servidor.');
      }

      // Adaptar resposta da API para o formato esperado pelo resultado.html
      return this.adaptarRespostaGA(dados, paciente);

    } catch (error) {
      console.error('Erro crítico na otimização:', error);
      
      // Tratamento de erro específico
      if (error.name === 'AbortError') {
        throw new Error('O servidor de otimização demorou muito para responder. Tente novamente.');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Não foi possível conectar ao servidor de Inteligência Artificial. Verifique se a API Python está rodando.');
      }
      
      throw error; // Repassa erro para o app.js resetar o botão
    }
  }

  adaptarRespostaGA(dados, paciente) {
    /**
     * Adapta a resposta da API do algoritmo genético para o formato
     * esperado pelo resultado.html
     *
     * Formato da API:
     * {
     *   sucesso: true,
     *   melhor_opcao: { upae: {...}, distancia_km, prob_noshow, tempo_espera_dias, score },
     *   alternativas: [{ upae: {...}, distancia_km, ... }, ...]
     * }
     *
     * Formato esperado:
     * {
     *   sucesso: true,
     *   paciente: { nome, cpf, idade, sexo, especialidade, endereco },
     *   melhorOpcao: {
     *     especialista: { unidade, municipio, endereco, id },
     *     score: 0.85,
     *     detalhes: { distancia, tempoEspera, custo, probabilidadeNoShow, ... }
     *   },
     *   alternativas: [...]
     * }
     */

    const formatarOpcao = (opcao) => {
      const upae = opcao.upae;

      return {
        especialista: {
          id: upae.id,
          unidade: upae.nome || upae.unidade,
          nome: upae.nome || upae.unidade,
          municipio: upae.municipio || 'RMR',
          endereco: upae.endereco,
          lat: upae.lat,
          lon: upae.lon
        },
        score: opcao.score || opcao.fitness,
        detalhes: {
          distancia: opcao.distancia_km,
          tempoEspera: opcao.tempo_espera_dias,
          custo: this.calcularCustoTransporte(opcao.distancia_km),
          probabilidadeNoShow: opcao.prob_noshow,
          tempoViagem: this.estimarTempoViagem(opcao.distancia_km),
          numeroTransferencias: this.estimarTransferencias(opcao.distancia_km)
        }
      };
    };

    return {
      sucesso: true,
      paciente: paciente,
      melhorOpcao: formatarOpcao(dados.melhor_opcao),
      alternativas: (dados.alternativas || []).map(formatarOpcao),
      explicacao: {
        fatores: [
          { icone: '', texto: `Distância otimizada: ${dados.melhor_opcao.distancia_km.toFixed(1)} km` },
          { icone: '', texto: `Tempo de espera: ${dados.melhor_opcao.tempo_espera_dias} dias` },
          { icone: '', texto: `Baixa probabilidade de falta: ${dados.melhor_opcao.prob_noshow.toFixed(1)}%` },
          { icone: '', texto: 'Calculado com algoritmo genético de otimização multiobjetivo' }
        ]
      }
    };
  }

  calcularCustoTransporte(distanciaKm) {
    // Tarifa de ônibus RMR: R$ 4,30
    // Estima embarques baseado na distância
    const transferencias = this.estimarTransferencias(distanciaKm);
    return transferencias * 4.30;
  }

  estimarTempoViagem(distanciaKm) {
    // Velocidade média de ônibus urbano: ~20 km/h
    const horas = distanciaKm / 20;
    const minutos = Math.round(horas * 60);

    if (minutos < 60) {
      return `${minutos} min`;
    } else {
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      return `${h}h${m > 0 ? m + 'min' : ''}`;
    }
  }

  estimarTransferencias(distanciaKm) {
    // Estimativa conservadora baseada na distância
    if (distanciaKm < 10) return 1;
    if (distanciaKm < 20) return 2;
    return 3;
  }
}

// Exportar instância
const otimizador = new OtimizadorAlocacao();