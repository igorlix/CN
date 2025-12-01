# Servidor de Otimização UPAE

API REST para otimização de alocação de pacientes em UPAEs usando Algoritmo Genético.

## Instalação

1. Instale as dependências:
```bash
pip install -r requirements.txt
```

## Execução

1. Inicie o servidor:
```bash
python api_server.py
```

2. O servidor estará rodando em `http://localhost:5000`

## Endpoints

### POST /api/otimizar
Otimiza alocação de um único paciente.

**Request:**
```json
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
}
```

**Response:**
```json
{
  "sucesso": true,
  "upae": {...},
  "distancia_km": 12.5,
  "prob_noshow": 8.3,
  "tempo_espera_dias": 5,
  "fitness": 0.85,
  "diagnosticos": {...}
}
```

### POST /api/otimizar-lote
Otimiza alocação de múltiplos pacientes simultaneamente.

### GET /health
Health check do servidor.

## Algoritmo

O algoritmo genético considera múltiplos objetivos:

- **Distância**: Minimizar deslocamento do paciente
- **Tempo de Espera**: Minimizar dias até consulta
- **Probabilidade de No-Show**: Minimizar faltas
- **Transporte Público**: Priorizar locais com melhor acesso

### Parâmetros do GA

- População: 120 indivíduos
- Gerações: 400
- Taxa de Crossover: 0.7
- Taxa de Mutação: 0.3
- Elitismo: 15%

## Integração com Frontend

O frontend em `index.html` deve fazer requisições POST para `/api/otimizar` passando os dados do paciente e lista de UPAEs disponíveis.
