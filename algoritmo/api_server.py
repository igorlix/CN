"""
API REST para Otimização de Alocação de Pacientes em UPAEs
Servidor Flask que expõe o algoritmo genético
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from otimizador_genetico import otimizar_alocacao_paciente, run_genetic_algorithm
import json

app = Flask(__name__)
CORS(app)  # Permitir requisições do frontend

@app.route('/api/otimizar', methods=['POST'])
def otimizar():
    """
    Endpoint para otimizar alocação de um paciente

    Request Body:
    {
        "paciente": {
            "id": "pac-123",
            "nome": "João Silva",
            "especialidade": "Cardiologia",
            "lat": -8.0476,
            "lon": -34.8770,
            "idade": 45,
            "gestante": false,
            "urgente": false
        },
        "upaes": [
            {
                "id": "upae-grande-recife",
                "nome": "UPAE Grande Recife",
                "endereco": "BR-101, 285...",
                "especialidades": ["Cardiologia", "Dermatologia", ...],
                "lat": -7.9086,
                "lon": -35.0054,
                "tempo_espera_dias": 5,
                "transport_score": 0.8
            },
            ...
        ]
    }

    Returns:
    {
        "sucesso": true,
        "upae": {...},
        "distancia_km": 12.5,
        "prob_noshow": 8.3,
        "tempo_espera_dias": 5,
        "fitness": 0.85,
        "diagnosticos": {...}
    }
    """
    try:
        data = request.get_json()

        if not data or 'paciente' not in data or 'upaes' not in data:
            return jsonify({
                'sucesso': False,
                'erro': 'Dados inválidos. Necessário enviar paciente e upaes.'
            }), 400

        paciente = data['paciente']
        upaes = data['upaes']

        # Validar dados do paciente
        campos_obrigatorios = ['especialidade', 'lat', 'lon']
        for campo in campos_obrigatorios:
            if campo not in paciente:
                return jsonify({
                    'sucesso': False,
                    'erro': f'Campo obrigatório ausente no paciente: {campo}'
                }), 400

        # Executar otimização
        resultado = otimizar_alocacao_paciente(paciente, upaes)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({
            'sucesso': False,
            'erro': str(e)
        }), 500

@app.route('/api/otimizar-lote', methods=['POST'])
def otimizar_lote():
    """
    Endpoint para otimizar alocação de múltiplos pacientes

    Request Body:
    {
        "pacientes": [...],
        "upaes": [...]
    }

    Returns:
    {
        "sucesso": true,
        "alocacoes": [
            {
                "paciente_id": "pac-1",
                "upae_id": "upae-arruda",
                "distancia_km": 10.2,
                ...
            },
            ...
        ],
        "estatisticas": {...}
    }
    """
    try:
        data = request.get_json()

        if not data or 'pacientes' not in data or 'upaes' not in data:
            return jsonify({
                'sucesso': False,
                'erro': 'Dados inválidos. Necessário enviar pacientes e upaes.'
            }), 400

        pacientes = data['pacientes']
        upaes = data['upaes']

        # Executar algoritmo genético para todo o lote
        resultado_ga = run_genetic_algorithm(
            pacientes,
            upaes,
            pop_size=120,
            generations=400,
            crossover_rate=0.7,
            mutation_rate=0.3,
            elitism=0.15
        )

        # Processar resultado
        best_chromosome = resultado_ga['best_chromosome']
        alocacoes = []

        upae_map = {u['id']: u for u in upaes}

        for i, upae_id in enumerate(best_chromosome):
            paciente = pacientes[i]

            if upae_id == -1 or upae_id is None:
                alocacoes.append({
                    'paciente_id': paciente.get('id', i),
                    'upae_id': None,
                    'status': 'nao_alocado',
                    'mensagem': 'Nenhuma UPAE compatível disponível'
                })
                continue

            upae = upae_map.get(upae_id)

            if not upae:
                continue

            from otimizador_genetico import compute_p_noshow, BASE_NO_SHOW, haversine

            base_ns = BASE_NO_SHOW.get(paciente['especialidade'].lower(), 0.3)
            p_noshow, dist = compute_p_noshow(paciente, upae, base_ns)

            alocacoes.append({
                'paciente_id': paciente.get('id', i),
                'paciente_nome': paciente.get('nome', 'N/A'),
                'upae_id': upae['id'],
                'upae_nome': upae['nome'],
                'status': 'alocado',
                'distancia_km': round(dist, 2),
                'prob_noshow': round(p_noshow * 100, 1),
                'tempo_espera_dias': upae.get('tempo_espera_dias', 0)
            })

        return jsonify({
            'sucesso': True,
            'alocacoes': alocacoes,
            'estatisticas': {
                'total_pacientes': len(pacientes),
                'pacientes_alocados': sum(1 for a in alocacoes if a['status'] == 'alocado'),
                'fitness': resultado_ga['best_fitness'],
                'diagnosticos': resultado_ga['best_diag']
            }
        })

    except Exception as e:
        return jsonify({
            'sucesso': False,
            'erro': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de health check"""
    return jsonify({
        'status': 'healthy',
        'service': 'UPAE Otimizador API'
    })

@app.route('/', methods=['GET'])
@app.route('/docs', methods=['GET'])
def docs():
    """Documentação da API"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>API Otimizador UPAE - Documentação</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; }
            h1 { color: #2563eb; }
            h2 { color: #1e40af; margin-top: 30px; }
            .endpoint { background: #f3f4f6; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .method { display: inline-block; padding: 5px 10px; border-radius: 4px; color: white; font-weight: bold; }
            .post { background: #10b981; }
            .get { background: #3b82f6; }
            pre { background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 8px; overflow-x: auto; }
            code { font-family: 'Courier New', monospace; }
            .test-section { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1>🧬 API Otimizador UPAE</h1>
        <p>Sistema de Otimização de Alocação de Pacientes usando Algoritmo Genético</p>

        <div class="test-section">
            <h3>✅ Status do Servidor</h3>
            <p><strong>Servidor ativo e funcionando!</strong></p>
            <p>Acesse: <a href="/health">/health</a> para verificar status</p>
        </div>

        <h2>Endpoints Disponíveis</h2>

        <div class="endpoint">
            <h3><span class="method post">POST</span> /api/otimizar</h3>
            <p>Otimiza alocação de um único paciente</p>

            <h4>Request Body:</h4>
            <pre><code>{
  "paciente": {
    "id": "pac-123",
    "nome": "João Silva",
    "especialidade": "Cardiologia",
    "lat": -8.0476,
    "lon": -34.8770,
    "idade": 45,
    "gestante": false,
    "urgente": false
  },
  "upaes": [
    {
      "id": "upae-arruda",
      "nome": "UPAE Arruda",
      "endereco": "Av. Prof. José dos Anjos, s/n",
      "especialidades": ["Cardiologia", "Dermatologia"],
      "lat": -8.0476,
      "lon": -34.9085,
      "tempo_espera_dias": 5,
      "transport_score": 0.8
    }
  ]
}</code></pre>

            <h4>Response:</h4>
            <pre><code>{
  "sucesso": true,
  "upae": {
    "id": "upae-arruda",
    "nome": "UPAE Arruda",
    ...
  },
  "distancia_km": 12.5,
  "prob_noshow": 8.3,
  "tempo_espera_dias": 5,
  "fitness": 0.85,
  "diagnosticos": {...}
}</code></pre>
        </div>

        <div class="endpoint">
            <h3><span class="method post">POST</span> /api/otimizar-lote</h3>
            <p>Otimiza alocação de múltiplos pacientes simultaneamente</p>

            <h4>Request Body:</h4>
            <pre><code>{
  "pacientes": [...],  // Array de pacientes
  "upaes": [...]       // Array de UPAEs
}</code></pre>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> /health</h3>
            <p>Health check do servidor</p>

            <h4>Response:</h4>
            <pre><code>{
  "status": "healthy",
  "service": "UPAE Otimizador API"
}</code></pre>
        </div>

        <h2>Teste Rápido com cURL</h2>
        <div class="test-section">
            <h3>Exemplo de Requisição:</h3>
            <pre><code>curl -X POST http://localhost:5000/api/otimizar \\
  -H "Content-Type: application/json" \\
  -d '{
    "paciente": {
      "id": "teste-1",
      "especialidade": "Cardiologia",
      "lat": -8.0476,
      "lon": -34.8770,
      "idade": 45
    },
    "upaes": [{
      "id": "upae-arruda",
      "nome": "UPAE Arruda",
      "especialidades": ["Cardiologia"],
      "lat": -8.0476,
      "lon": -34.9085,
      "tempo_espera_dias": 5,
      "transport_score": 0.8
    }]
  }'</code></pre>
        </div>

        <h2>Algoritmo Genético - Parâmetros</h2>
        <ul>
            <li><strong>População:</strong> 120 indivíduos</li>
            <li><strong>Gerações:</strong> 400 (ou 100 para otimização rápida)</li>
            <li><strong>Crossover:</strong> 70%</li>
            <li><strong>Mutação:</strong> 30%</li>
            <li><strong>Elitismo:</strong> 15%</li>
        </ul>

        <h2>Critérios de Otimização</h2>
        <ul>
            <li><strong>40%</strong> - Probabilidade de no-show</li>
            <li><strong>25%</strong> - Distância geográfica</li>
            <li><strong>25%</strong> - Tempo de espera</li>
            <li><strong>10%</strong> - Qualidade do transporte</li>
        </ul>

        <hr style="margin: 40px 0;">
        <p style="text-align: center; color: #6b7280;">
            <strong>Secretaria de Saúde do Estado de Pernambuco</strong><br>
            Sistema de Otimização de Alocação de Pacientes - UPAEs PE
        </p>
    </body>
    </html>
    """
    return html

if __name__ == '__main__':
    print("🚀 Servidor de Otimização UPAE iniciado")
    print("📍 Rodando em: http://localhost:5000")
    print("\nEndpoints disponíveis:")
    print("  POST /api/otimizar - Otimizar alocação de um paciente")
    print("  POST /api/otimizar-lote - Otimizar alocação de múltiplos pacientes")
    print("  GET  /health - Health check")

    app.run(debug=True, host='0.0.0.0', port=5000)
