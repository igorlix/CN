class OtimizadorAlocacao {
  constructor() {
    this.apiUrl = APP_CONFIG.API.OTIMIZADOR_GA || 'http://localhost:5000/api/otimizar';
  }

  async encontrarMelhorAlocacao(paciente, especialistasDisponiveis) {
    console.log(`Iniciando otimização genética para: ${paciente.nome}`);

    const upaesPayload = especialistasDisponiveis.map(u => {
      if (!u.lat || !u.lon) {
        throw new Error(`UPAE ${u.nome} não possui coordenadas válidas.`);
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

    if (!paciente.lat || !paciente.lon) {
      throw new Error('Não foi possível geocodificar o endereço do paciente.');
    }

    const pacientePayload = { ...paciente, lat: paciente.lat, lon: paciente.lon };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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

      return this.adaptarRespostaGA(dados, paciente);

    } catch (error) {
      console.error('Erro crítico na otimização:', error);

      if (error.name === 'AbortError') {
        throw new Error('O servidor de otimização demorou muito para responder.');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Não foi possível conectar ao servidor de IA.');
      }

      throw error;
    }
  }

  adaptarRespostaGA(dados, paciente) {

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
    return this.estimarTransferencias(distanciaKm) * 4.30;
  }

  estimarTempoViagem(distanciaKm) {
    const minutos = Math.round((distanciaKm / 20) * 60);
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h${m > 0 ? m + 'min' : ''}`;
  }

  estimarTransferencias(distanciaKm) {
    if (distanciaKm < 10) return 1;
    if (distanciaKm < 20) return 2;
    return 3;
  }
}

const otimizador = new OtimizadorAlocacao();