// Integração com Google Maps API
class MapsIntegration {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.directionsService = null;
    this.distanceMatrixService = null;
    this.geocoder = null;
    this.initialized = false;
  }

  // Inicializar serviços do Google Maps
  async init() {
    if (this.initialized) return true;

    try {
      // Carregar script do Google Maps
      await this.loadGoogleMapsScript();

      // Inicializar serviços
      this.directionsService = new google.maps.DirectionsService();
      this.distanceMatrixService = new google.maps.DistanceMatrixService();
      this.geocoder = new google.maps.Geocoder();

      this.initialized = true;
      console.log('Google Maps API inicializada com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar Google Maps:', error);
      return false;
    }
  }

  // Carregar script do Google Maps dinamicamente
  loadGoogleMapsScript() {
    return new Promise((resolve, reject) => {
      // Verificar se já está carregado
      if (typeof google !== 'undefined' && google.maps) {
        console.log('✓ Google Maps já carregado');
        resolve();
        return;
      }

      console.log('📡 Carregando Google Maps API...');

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('✓ Script do Google Maps carregado');

        // Verificar se houve erro de autenticação ou quota
        if (typeof google === 'undefined' || !google.maps) {
          const errorMsg = 'Google Maps não inicializou corretamente. Possíveis causas: chave API inválida, quota excedida, ou APIs não habilitadas.';
          console.error('❌', errorMsg);
          reject(new Error(errorMsg));
          return;
        }

        resolve();
      };

      script.onerror = (error) => {
        const errorMsg = `Erro ao carregar script do Google Maps. Verifique: 1) Conexão com internet, 2) Chave API válida, 3) CORS permitido`;
        console.error('❌', errorMsg, error);
        reject(new Error(errorMsg));
      };

      document.head.appendChild(script);

      // Timeout de 10 segundos
      setTimeout(() => {
        if (!this.initialized) {
          reject(new Error('Timeout ao carregar Google Maps API (10s). Verifique sua conexão.'));
        }
      }, 10000);
    });
  }

  // Calcular distância e tempo entre dois pontos
  async calcularDistanciaETempo(origem, destino, modoTransporte = 'TRANSIT') {
    if (!this.initialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const request = {
        origins: [origem],
        destinations: [destino],
        travelMode: google.maps.TravelMode[modoTransporte],
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      };

      this.distanceMatrixService.getDistanceMatrix(request, (response, status) => {
        if (status === 'OK') {
          const result = response.rows[0].elements[0];

          if (result.status === 'OK') {
            resolve({
              distancia: {
                valor: result.distance.value, // em metros
                texto: result.distance.text   // formatado
              },
              duracao: {
                valor: result.duration.value, // em segundos
                texto: result.duration.text   // formatado
              },
              origem: response.originAddresses[0],
              destino: response.destinationAddresses[0]
            });
          } else {
            reject(new Error(`Rota não encontrada: ${result.status}`));
          }
        } else {
          reject(new Error(`Erro na API: ${status}`));
        }
      });
    });
  }

  // Calcular rotas com transporte público
  async calcularRotaTransportePublico(origem, destino) {
    if (!this.initialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const request = {
        origin: origem,
        destination: destino,
        travelMode: google.maps.TravelMode.TRANSIT,
        transitOptions: {
          modes: ['BUS', 'RAIL', 'SUBWAY'],
          routingPreference: google.maps.TransitRoutePreference.FEWER_TRANSFERS
        },
        provideRouteAlternatives: true
      };

      this.directionsService.route(request, (result, status) => {
        if (status === 'OK') {
          const rotas = result.routes.map(rota => {
            const perna = rota.legs[0];

            return {
              distancia: {
                valor: perna.distance.value,
                texto: perna.distance.text
              },
              duracao: {
                valor: perna.duration.value,
                texto: perna.duration.text
              },
              passos: perna.steps.map(passo => ({
                modoViagem: passo.travel_mode,
                instrucoes: passo.instructions,
                distancia: passo.distance.text,
                duracao: passo.duration.text,
                transitDetails: passo.transit ? {
                  linha: passo.transit.line.short_name || passo.transit.line.name,
                  veiculo: passo.transit.line.vehicle.name,
                  partida: passo.transit.departure_stop.name,
                  chegada: passo.transit.arrival_stop.name,
                  numParadas: passo.transit.num_stops,
                  // Tentar capturar tarifa real da API (quando disponível)
                  tarifa: passo.transit.fare ? parseFloat(passo.transit.fare.value) : null
                } : null
              })),
              // Capturar tarifa total da perna (se disponível)
              tarifaTotal: perna.fare ? parseFloat(perna.fare.value) : null,
              resumo: rota.summary
            };
          });

          resolve(rotas);
        } else {
          reject(new Error(`Erro ao calcular rota: ${status}`));
        }
      });
    });
  }

  // Estimar custo de transporte
  async estimarCustoTransporte(origem, destino) {
    try {
      const rotas = await this.calcularRotaTransportePublico(origem, destino);

      if (rotas.length === 0) {
        return {
          custoTransportePublico: null,
          erro: 'Nenhuma rota de transporte público encontrada'
        };
      }

      const melhorRota = rotas[0];
      const distanciaKm = melhorRota.distancia.valor / 1000;

      // Extrair informações reais de tarifa da API (se disponível)
      const passosTransito = melhorRota.passos.filter(p => p.transitDetails);
      const numeroTransferencias = passosTransito.length;

      let custoTransportePublico = 0;
      let usouTarifaReal = false;

      // PRIORIDADE 1: Tentar usar tarifa total da rota (mais preciso)
      if (melhorRota.tarifaTotal && melhorRota.tarifaTotal > 0) {
        custoTransportePublico = melhorRota.tarifaTotal;
        usouTarifaReal = true;
        console.log('✓ Usando tarifa REAL da API:', custoTransportePublico);
      }
      // PRIORIDADE 2: Somar tarifas individuais de cada trecho
      else {
        let tarifasIndividuais = 0;
        let temTarifaIndividual = false;

        passosTransito.forEach(passo => {
          if (passo.transitDetails && passo.transitDetails.tarifa && passo.transitDetails.tarifa > 0) {
            tarifasIndividuais += passo.transitDetails.tarifa;
            temTarifaIndividual = true;
          }
        });

        if (temTarifaIndividual) {
          custoTransportePublico = tarifasIndividuais;
          usouTarifaReal = true;
          console.log('✓ Usando tarifas individuais da API:', custoTransportePublico);
        }
      }

      // PRIORIDADE 3: Se API não retornou tarifa, calcular com base no número de embarques
      // A API sempre retorna o número correto de ônibus necessários
      if (!usouTarifaReal) {
        // Usar tarifa real da região (API do Google não retorna valores de tarifa para Brasil)
        const tarifaPorRegiao = this.obterTarifaPorRegiao(origem, destino);

        // O número de transferências da API indica quantos ônibus diferentes são necessários
        // Cada embarque = 1 passagem
        custoTransportePublico = tarifaPorRegiao * Math.max(numeroTransferencias, 1);

        console.log('ℹ️ Google Maps API não fornece tarifas para Brasil.');
        console.log('   Usando tarifa real de PE:', tarifaPorRegiao, '× número de embarques da API:', numeroTransferencias, '=', custoTransportePublico);
      }

      return {
        custoTransportePublico: parseFloat(custoTransportePublico.toFixed(2)),
        numeroTransferencias,
        distanciaKm: parseFloat(distanciaKm.toFixed(2)),
        tempoViagem: melhorRota.duracao.texto,
        detalhesRota: melhorRota,
        usouTarifaReal: usouTarifaReal
      };
    } catch (error) {
      console.error('❌ Erro ao calcular rota de transporte público:', error);

      // Tentar ao menos calcular distância e tempo com modo DRIVING
      try {
        console.log('🔄 Tentando calcular com modo DRIVING como fallback...');

        const resultadoDriving = await this.calcularDistanciaETempo(origem, destino, 'DRIVING');

        // Usar tarifa real da região
        const tarifaPorRegiao = this.obterTarifaPorRegiao(origem, destino);

        // Estimar 1 ônibus a cada 15km (estimativa conservadora)
        const numeroOnibusEstimado = Math.max(1, Math.ceil(resultadoDriving.distancia.valor / 15000));

        console.log('ℹ️ Transporte público não disponível para esta rota.');
        console.log('   Estimando', numeroOnibusEstimado, 'ônibus necessários baseado na distância de', (resultadoDriving.distancia.valor / 1000).toFixed(1), 'km');

        return {
          custoTransportePublico: parseFloat((tarifaPorRegiao * numeroOnibusEstimado).toFixed(2)),
          numeroTransferencias: numeroOnibusEstimado,
          distanciaKm: parseFloat((resultadoDriving.distancia.valor / 1000).toFixed(2)),
          tempoViagem: resultadoDriving.duracao.texto + ' (carro)',
          detalhesRota: null,
          metodoCalculo: 'fallback-driving',
          usouTarifaReal: false,
          avisoTransportePublico: 'Rota de transporte público não disponível. Valores estimados com base na distância.'
        };
      } catch (errorDriving) {
        console.error('❌ Erro ao calcular rota com modo DRIVING:', errorDriving);

        // Se nem DRIVING funcionar, retornar erro
        throw new Error('Não foi possível calcular rota entre origem e destino. Verifique os endereços.');
      }
    }
  }

  // Calcular distância simples (linha reta) entre coordenadas
  async calcularDistanciaSimples(origem, destino) {
    if (!this.initialized) {
      await this.init();
    }

    const p1 = await this.geocodificar(origem);
    const p2 = await this.geocodificar(destino);

    const distancia = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(p1.lat, p1.lng),
      new google.maps.LatLng(p2.lat, p2.lng)
    );

    return distancia; // em metros
  }

  // Geocodificar endereço para obter coordenadas
  async geocodificar(endereco) {
    if (!this.initialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address: endereco }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng(),
            enderecoFormatado: results[0].formatted_address
          });
        } else {
          reject(new Error(`Geocodificação falhou: ${status}`));
        }
      });
    });
  }

  // Calcular múltiplas distâncias (otimização)
  async calcularMatrizDistancias(origens, destinos) {
    if (!this.initialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const request = {
        origins: origens,
        destinations: destinos,
        travelMode: google.maps.TravelMode.TRANSIT,
        unitSystem: google.maps.UnitSystem.METRIC
      };

      this.distanceMatrixService.getDistanceMatrix(request, (response, status) => {
        if (status === 'OK') {
          const matriz = response.rows.map((row, i) => ({
            origem: response.originAddresses[i],
            destinos: row.elements.map((element, j) => ({
              destino: response.destinationAddresses[j],
              status: element.status,
              distancia: element.status === 'OK' ? element.distance : null,
              duracao: element.status === 'OK' ? element.duration : null
            }))
          }));

          resolve(matriz);
        } else {
          reject(new Error(`Erro na matriz de distâncias: ${status}`));
        }
      });
    });
  }

  // Obter tarifa por região (valores atualizados 2025)
  obterTarifaPorRegiao(origem, destino) {
    // Tarifas por sistema de transporte em PE (2025)
    const tarifas = {
      // Região Metropolitana do Recife (RMR)
      'recife': 4.30,
      'jaboatao': 4.30,
      'olinda': 4.30,
      'paulista': 4.30,
      'cabo': 4.30,
      'igarassu': 4.30,
      'abreu_e_lima': 4.30,
      'camaragibe': 4.30,

      // Interior (valores médios)
      'caruaru': 4.00,
      'petrolina': 4.00,
      'garanhuns': 3.80,
      'vitoria': 3.80,

      // Padrão para outras localidades
      'default': 4.10
    };

    // Detectar município de origem e destino
    const detectarMunicipio = (local) => {
      const localLower = local.toLowerCase();

      if (localLower.includes('recife')) return 'recife';
      if (localLower.includes('jaboatão') || localLower.includes('jaboatao')) return 'jaboatao';
      if (localLower.includes('olinda')) return 'olinda';
      if (localLower.includes('paulista')) return 'paulista';
      if (localLower.includes('cabo')) return 'cabo';
      if (localLower.includes('igarassu')) return 'igarassu';
      if (localLower.includes('abreu')) return 'abreu_e_lima';
      if (localLower.includes('camaragibe')) return 'camaragibe';
      if (localLower.includes('caruaru')) return 'caruaru';
      if (localLower.includes('petrolina')) return 'petrolina';
      if (localLower.includes('garanhuns')) return 'garanhuns';
      if (localLower.includes('vitoria') || localLower.includes('vitória')) return 'vitoria';

      return 'default';
    };

    const municipioOrigem = detectarMunicipio(origem);
    const municipioDestino = detectarMunicipio(destino);

    // Se origem e destino estão na mesma região tarifária, usar essa tarifa
    const tarifaOrigem = tarifas[municipioOrigem] || tarifas.default;
    const tarifaDestino = tarifas[municipioDestino] || tarifas.default;

    // Retornar a tarifa maior (geralmente são iguais na mesma região)
    return Math.max(tarifaOrigem, tarifaDestino);
  }

  // Renderizar mapa em um elemento HTML
  renderizarMapa(elementId, centro, zoom = 10) {
    const mapOptions = {
      center: centro,
      zoom: zoom,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    return new google.maps.Map(document.getElementById(elementId), mapOptions);
  }

  // Adicionar marcador ao mapa
  adicionarMarcador(mapa, posicao, titulo, icone = null) {
    const marcador = new google.maps.Marker({
      position: posicao,
      map: mapa,
      title: titulo,
      icon: icone
    });

    return marcador;
  }

  // Desenhar rota no mapa
  desenharRota(mapa, origem, destino, cor = '#2563eb') {
    const request = {
      origin: origem,
      destination: destino,
      travelMode: google.maps.TravelMode.TRANSIT
    };

    this.directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map: mapa,
          directions: result,
          polylineOptions: {
            strokeColor: cor,
            strokeWeight: 4
          }
        });
      }
    });
  }

  // Geocodificar endereço (converter endereço em coordenadas lat/lng)
  async geocodificarEndereco(endereco) {
    if (!this.initialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address: endereco }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng(),
            enderecoFormatado: results[0].formatted_address
          });
        } else {
          reject(new Error(`Geocodificação falhou: ${status}`));
        }
      });
    });
  }
}

// Criar instância global
const mapsIntegration = new MapsIntegration(APP_CONFIG.GOOGLE_MAPS_API_KEY);

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapsIntegration;
}
