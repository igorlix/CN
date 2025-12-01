// Configurações da aplicação
const APP_CONFIG = {
  // Google Maps API - Substitua pela sua chave real
  GOOGLE_MAPS_API_KEY: 'AIzaSyCb50vDWd3YK1Nzla_r2wZg3V1hd3nAPII', 

  // Endpoints da API
  API: {
    BASE_URL: '/api',
    AGENDAMENTO: '/api/agendamento',
    ESPECIALISTAS: '/api/especialistas',
    MUNICIPIOS: '/api/municipios',
    OTIMIZACAO: '/api/otimizacao',
    TRANSPORTE: '/api/transporte',
    OTIMIZADOR_GA: 'http://localhost:5000/api/otimizar'
  },

  // Configuração do Algoritmo
  USE_GENETIC_ALGORITHM: true, 

  OTIMIZACAO: {
    PESO_DISTANCIA: 0.4,
    PESO_TEMPO_ESPERA: 0.3,
    PESO_CUSTO: 0.2,
    PESO_TRANSPORTE: 0.1,
    MAX_DISTANCIA_KM: 100,
    MAX_TEMPO_ESPERA_DIAS: 30
  },

  PRIORIDADES: {
    URGENTE: { valor: 5, descricao: 'Caso urgente' },
    IDOSO: { valor: 4, descricao: 'Paciente idoso (60+)' },
    CRIANCA: { valor: 3, descricao: 'Criança (0-12 anos)' },
    DEFICIENCIA: { valor: 3, descricao: 'Pessoa com deficiência' },
    NORMAL: { valor: 1, descricao: 'Atendimento normal' }
  },

  // --- REGRAS DE NEGÓCIO (FILTRO) ---
  // Define quem pode ver qual especialidade
  REGRAS_ESPECIALIDADES: {
    // === ESPECIALIDADES MÉDICAS COM RESTRIÇÕES ===

    // Restrições de Sexo
    'Colposcopia': { sexo: 'feminino', minIdade: 12 },
    'Ginecologia': { sexo: 'feminino', minIdade: 10 },
    'Mastologia': { sexo: 'ambos', minIdade: 10 },

    // Restrições de Idade (Crianças)
    'Pediatria': { sexo: 'ambos', maxIdade: 13 },
    'Endocrinologia Infantil': { sexo: 'ambos', maxIdade: 13 },
    'Neuropediatria': { sexo: 'ambos', maxIdade: 13 },
    'Psiquiatria Infantil': { sexo: 'ambos', maxIdade: 13 },
    'Psicopedagogia': { sexo: 'ambos', maxIdade: 13 },

    // Restrições de Idade (Idosos)
    'Geriatria': { sexo: 'ambos', minIdade: 60 },

    // === ESPECIALIDADES MÉDICAS SEM RESTRIÇÕES ===
    'Alergologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Anestesiologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Angiologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Cardiologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Cirurgia Geral': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Dermatologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Endocrinologia': { sexo: 'ambos', minIdade: 14, maxIdade: 150 },
    'Endoscopia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Gastroenterologia': { sexo: 'ambos', minIdade: 14, maxIdade: 150 },
    'Gastroenterologia Clínica': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Infectologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Nefrologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Neurologia': { sexo: 'ambos', minIdade: 14, maxIdade: 150 },
    'Neurologia Clínica': { sexo: 'ambos', minIdade: 14, maxIdade: 150 },
    'Oftalmologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Ortopedia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Otorrinolaringologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Pneumologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Psiquiatria': { sexo: 'ambos', minIdade: 14, maxIdade: 150 },
    'Radiologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Reumatologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Urologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },

    // === ESPECIALIDADES NÃO MÉDICAS (Equipe Multidisciplinar) ===
    'Nutrição': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Psicologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Fisioterapia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Fonoaudiologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Terapia Ocupacional': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Enfermagem': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Serviço Social': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Farmácia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Estomaterapia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Educação Física': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },
    'Odontologia': { sexo: 'ambos', minIdade: 0, maxIdade: 150 },

    // === PADRÃO (Fallback) ===
    'default': { sexo: 'ambos', minIdade: 0, maxIdade: 150 }
  },

  // --- LISTA COMPLETA DE UPAES E SERVIÇOS ---
  UPAES: [
    {
      id: 'upae-grande-recife',
      nome: 'UPAE Grande Recife (Abreu e Lima)',
      municipio: 'Abreu e Lima',
      endereco: 'BR-101, 285 - Desterro, Abreu e Lima - PE, 53600-000',
      especialidades: [
        // Médicas
        'Alergologia', 'Anestesiologia', 'Cardiologia', 'Cirurgia Geral', 
        'Colposcopia', 'Dermatologia', 'Endocrinologia', 'Endoscopia', 
        'Gastroenterologia', 'Infectologia', 'Nefrologia', 'Neurologia Clínica', 
        'Otorrinolaringologia', 'Pneumologia', 'Radiologia', 'Reumatologia', 'Urologia',
        // Não Médicas
        'Nutrição', 'Psicologia', 'Fisioterapia', 'Fonoaudiologia', 
        'Terapia Ocupacional', 'Enfermagem', 'Serviço Social', 'Farmácia'
      ],
      regiao: 'RMR'
    },
    {
      id: 'upae-arruda',
      nome: 'UPAE Arruda (Recife)',
      municipio: 'Recife',
      endereco: 'Av. Prof. José dos Anjos, s/n - Arruda, Recife - PE, 52171-011',
      especialidades: [
        // Médicas
        'Reumatologia', 'Endocrinologia', 'Cardiologia', 'Neurologia', 
        'Nefrologia', 'Psiquiatria', 'Urologia', 'Pneumologia', 'Ortopedia',
        // Não Médicas
        'Fisioterapia', 'Terapia Ocupacional', 'Nutrição', 'Psicologia', 
        'Enfermagem', 'Farmácia', 'Serviço Social', 'Estomaterapia'
      ],
      regiao: 'RMR'
    },
    {
      id: 'upae-mustardinha',
      nome: 'UPAE Mustardinha (Recife)',
      municipio: 'Recife',
      endereco: 'R. Maj. Mario Portela, 279 - Mustardinha, Recife - PE, 50760-090',
      especialidades: [
        // Médicas
        'Cardiologia', 'Pediatria', 'Gastroenterologia Clínica', 
        'Endocrinologia Infantil', 'Pneumologia', 'Infectologia', 'Neurologia', 
        'Ortopedia', 'Reumatologia', 'Otorrinolaringologia', 'Psiquiatria',
        // Não Médicas
        'Odontologia', 'Fonoaudiologia', 'Fisioterapia', 'Terapia Ocupacional', 
        'Nutrição', 'Psicologia', 'Enfermagem', 'Estomaterapia', 'Serviço Social'
      ],
      regiao: 'RMR'
    },
    {
      id: 'upae-ibura',
      nome: 'UPAE Ibura (Recife)',
      municipio: 'Recife',
      endereco: 'Av. Dois Rios, 170 - Ibura, Recife - PE, 51230-000',
      especialidades: [
        // Médicas
        'Cardiologia', 'Pediatria', 'Gastroenterologia Clínica', 'Endocrinologia', 
        'Pneumologia', 'Infectologia', 'Neurologia', 'Ortopedia', 'Reumatologia', 
        'Otorrinolaringologia', 'Dermatologia', 'Oftalmologia', 'Psiquiatria', 
        'Neuropediatria', 'Psiquiatria Infantil',
        // Não Médicas
        'Fonoaudiologia', 'Fisioterapia', 'Terapia Ocupacional', 'Nutrição', 
        'Psicopedagogia', 'Psicologia', 'Enfermagem', 'Estomaterapia', 'Serviço Social'
      ],
      regiao: 'RMR'
    },
    {
      id: 'upae-r',
      nome: 'UPAE-R (Recife)',
      municipio: 'Recife',
      endereco: 'R. Interna, 801 - Ipsep, Recife - PE, 51350-351',
      especialidades: [
        // Médicas
        'Geriatria', 'Reumatologia', 'Angiologia',
        // Não Médicas
        'Fisioterapia', 'Terapia Ocupacional', 'Fonoaudiologia', 'Nutrição', 
        'Psicologia', 'Educação Física'
      ],
      regiao: 'RMR'
    }
  ],

  TOAST_DURATION: 5000,
  CPF_REGEX: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  CEP_REGEX: /^\d{5}-?\d{3}$/
};

// Exportar configuração
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}