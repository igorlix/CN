# Sistema de Otimização e Transparência na Distribuição de Pacientes nas UPAs

Sistema inteligente para agendamento e alocação otimizada de consultas médicas desenvolvido com HTML, Tailwind CSS, JavaScript e integração com Google Maps API.

## Funcionalidades Principais

### 1. Formulário de Agendamento


### 2. Integração com Google Maps
- Cálculo de distância real (não em linha reta)
- Rotas de transporte público com transferências
- Estimativa de tempo de viagem
- Estimativa de custo (ônibus e aplicativo)
- Visualização em mapa interativo


## Tecnologias Utilizadas

### Frontend
- **HTML5** 
- **Tailwind CSS 3.4+** 
- **JavaScript ES6+** 
- **Chart.js** 

### APIs e Integrações
- **Google Maps API** - Rotas, distâncias e mapas
- **ViaCEP** - Busca de endereços

### Algoritmos
- **Otimização Multiobjetivo**
- **Algoritmo Genético** 

## Formato dos Dados

### Dados do Agendamento
```json
{
  "nome": "João da Silva",
  "cpf": "123.456.789-00",
  "idade": 45,
  "gestante": false,
  "deficiencia": false,
  "urgente": false,
  "especialidade": "cardiologia",
  "municipio": "recife",
  "endereco": "Rua Exemplo, 123",
  "consentimentoLocalizacao": true,
  "dataEnvio": "2025-01-15T10:30:00.000Z"
}
```

### Resultado da Otimização
```json
{
  "sucesso": true,
  "melhorOpcao": {
    "especialista": { /* dados */ },
    "score": 0.234,
    "detalhes": {
      "distancia": 12.5,
      "tempoEspera": 5,
      "custo": 4.10,
      "custoUber": 35.50,
      "numeroTransferencias": 1
    },
    "viavel": true
  },
  "explicacao": { /* transparência */ },
  "alternativas": [ /* outras opções */ ]
}
```
