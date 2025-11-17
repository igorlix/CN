// Aplicação de Agendamento de Consulta
// Arquivo principal com validações e lógica do formulário

// Configuração e constantes
const CONFIG = {
  API_ENDPOINT: '/api/agendamento', // Ajustar conforme necessário
  TOAST_DURATION: 5000,
  CPF_REGEX: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  CEP_REGEX: /^\d{5}-?\d{3}$/
};

// Utilitários
const Utils = {
  // Validação de CPF
  validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');

    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;

    let soma = 0;
    let resto;

    for (let i = 1; i <= 9; i++) {
      soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++) {
      soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;

    return true;
  },

  // Máscaras de formatação
  mascaraCPF(value) {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  mascaraTelefone(value) {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  },

  mascaraCEP(value) {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  },

  // Toast notification
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    toast.className = `toast toast-${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, CONFIG.TOAST_DURATION);
  },

  // Buscar CEP via API
  async buscarCEP(cep) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP não encontrado');
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      return null;
    }
  }
};

// Validação de Formulário
class FormValidator {
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.inputs = {};
    this.errors = {};
    this.initializeInputs();
    this.setupEventListeners();
  }

  initializeInputs() {
    this.inputs = {
      nome: document.getElementById('nome'),
      documento: document.getElementById('documento'),
      genero: document.getElementById('genero'),
      telefone: document.getElementById('telefone'),
      especialidade: document.getElementById('especialidade'),
      municipio: document.getElementById('municipio'),
      endereco: document.getElementById('endereco'),
      consentimento: document.querySelectorAll('input[name="consentimento"]')
    };
  }

  setupEventListeners() {
    // Validação em tempo real
    this.inputs.nome.addEventListener('blur', () => this.validateNome());
    this.inputs.documento.addEventListener('blur', () => this.validateCPF());
    this.inputs.genero.addEventListener('change', () => {
      this.validateGenero();
      this.filtrarEspecialidadesPorGenero();
    });
    this.inputs.telefone.addEventListener('blur', () => this.validateTelefone());
    this.inputs.especialidade.addEventListener('change', () => this.validateEspecialidade());
    this.inputs.municipio.addEventListener('change', () => this.validateMunicipio());
    this.inputs.endereco.addEventListener('blur', () => this.validateEndereco());

    // Máscaras
    this.inputs.documento.addEventListener('input', (e) => {
      e.target.value = Utils.mascaraCPF(e.target.value);
    });

    this.inputs.telefone.addEventListener('input', (e) => {
      e.target.value = Utils.mascaraTelefone(e.target.value);
    });

    this.inputs.endereco.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      if (value.length === 8) {
        this.buscarCEPAutomatico(value);
      }
    });

    // Submit do formulário
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  filtrarEspecialidadesPorGenero() {
    const genero = this.inputs.genero.value;
    const especialidadeSelect = this.inputs.especialidade;
    const options = especialidadeSelect.querySelectorAll('option');

    // Especialidades específicas por gênero
    const especialidadesFemininas = [
      'ginecologia-geral', 'obstetricia', 'reproducao-humana',
      'uroginecologia', 'ginecologia-oncologica', 'climaterio'
    ];

    const especialidadesMasculinas = [
      'urologia'
    ];

    options.forEach(option => {
      const value = option.value;

      // Não desabilitar a opção padrão
      if (!value) {
        option.disabled = false;
        return;
      }

      // Regras de filtro
      if (genero === 'masculino' && especialidadesFemininas.includes(value)) {
        option.disabled = true;
        option.style.display = 'none';
      } else if (genero === 'feminino' && especialidadesMasculinas.includes(value)) {
        // Urologia pode atender ambos, então não desabilitar
        option.disabled = false;
        option.style.display = '';
      } else if (genero === 'outro') {
        // Para "outro", mostrar todas exceto ginecologia/obstetrícia
        if (especialidadesFemininas.includes(value)) {
          option.disabled = true;
          option.style.display = 'none';
        } else {
          option.disabled = false;
          option.style.display = '';
        }
      } else {
        option.disabled = false;
        option.style.display = '';
      }
    });

    // Resetar seleção se a especialidade atual foi desabilitada
    if (especialidadeSelect.value && especialidadeSelect.selectedOptions[0]?.disabled) {
      especialidadeSelect.value = '';
    }
  }

  validateNome() {
    const nome = this.inputs.nome.value.trim();
    const feedback = this.inputs.nome.nextElementSibling;

    if (!nome) {
      this.setError('nome', 'Nome é obrigatório');
      return false;
    }

    if (nome.length < 3) {
      this.setError('nome', 'Nome deve ter pelo menos 3 caracteres');
      return false;
    }

    if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(nome)) {
      this.setError('nome', 'Nome deve conter apenas letras');
      return false;
    }

    this.setSuccess('nome');
    return true;
  }

  validateCPF() {
    const cpf = this.inputs.documento.value;

    if (!cpf) {
      this.setError('documento', 'CPF é obrigatório');
      return false;
    }

    if (!Utils.validarCPF(cpf)) {
      this.setError('documento', 'CPF inválido');
      return false;
    }

    this.setSuccess('documento');
    return true;
  }

  validateEspecialidade() {
    const especialidade = this.inputs.especialidade.value;

    if (!especialidade) {
      this.setError('especialidade', 'Selecione uma especialidade');
      return false;
    }

    this.setSuccess('especialidade');
    return true;
  }

  validateMunicipio() {
    const municipio = this.inputs.municipio.value;

    if (!municipio) {
      this.setError('municipio', 'Selecione um município');
      return false;
    }

    this.setSuccess('municipio');
    return true;
  }

  validateGenero() {
    const genero = this.inputs.genero.value;

    if (!genero) {
      this.setError('genero', 'Selecione um gênero');
      return false;
    }

    this.setSuccess('genero');
    return true;
  }

  validateTelefone() {
    const telefone = this.inputs.telefone.value;

    if (!telefone) {
      this.setError('telefone', 'Telefone é obrigatório');
      return false;
    }

    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length < 10 || numeros.length > 11) {
      this.setError('telefone', 'Telefone inválido');
      return false;
    }

    this.setSuccess('telefone');
    return true;
  }

  validateEndereco() {
    const endereco = this.inputs.endereco.value.trim();

    if (!endereco) {
      this.setError('endereco', 'Endereço é obrigatório');
      return false;
    }

    if (endereco.length < 5) {
      this.setError('endereco', 'Endereço deve ter pelo menos 5 caracteres');
      return false;
    }

    this.setSuccess('endereco');
    return true;
  }

  setError(fieldName, message) {
    const input = this.inputs[fieldName];
    let feedback = input.parentElement.querySelector('.feedback-message');

    if (!feedback) {
      feedback = document.createElement('p');
      feedback.className = 'feedback-message feedback-error';
      input.parentElement.appendChild(feedback);
    }

    input.classList.add('input-error');
    input.classList.remove('input-success');
    feedback.textContent = message;
    feedback.classList.add('show', 'feedback-error');
    feedback.classList.remove('feedback-success');
    this.errors[fieldName] = message;
  }

  setSuccess(fieldName) {
    const input = this.inputs[fieldName];
    let feedback = input.parentElement.querySelector('.feedback-message');

    if (feedback) {
      feedback.classList.remove('show');
    }

    input.classList.remove('input-error');
    input.classList.add('input-success');
    delete this.errors[fieldName];
  }

  async buscarCEPAutomatico(cep) {
    const endereco = this.inputs.endereco;
    const originalValue = endereco.value;

    endereco.value = 'Buscando CEP...';
    endereco.disabled = true;

    const dados = await Utils.buscarCEP(cep);

    if (dados) {
      endereco.value = `${dados.logradouro}, ${dados.bairro}, ${dados.localidade} - ${dados.uf}`;
      Utils.showToast('CEP encontrado com sucesso!', 'success');
    } else {
      endereco.value = originalValue;
      Utils.showToast('CEP não encontrado. Digite manualmente.', 'warning');
    }

    endereco.disabled = false;
  }

  validateAll() {
    const isNomeValid = this.validateNome();
    const isCPFValid = this.validateCPF();
    const isGeneroValid = this.validateGenero();
    const isTelefoneValid = this.validateTelefone();
    const isEspecialidadeValid = this.validateEspecialidade();
    const isMunicipioValid = this.validateMunicipio();
    const isEnderecoValid = this.validateEndereco();

    return isNomeValid && isCPFValid && isGeneroValid && isTelefoneValid &&
           isEspecialidadeValid && isMunicipioValid && isEnderecoValid;
  }

  async handleSubmit(event) {
    event.preventDefault();

    if (!this.validateAll()) {
      Utils.showToast('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    const submitButton = this.form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;

    submitButton.disabled = true;
    submitButton.innerHTML = 'Processando... <span class="spinner"></span>';

    const formData = this.getFormData();

    try {
      // Buscar especialistas disponíveis
      submitButton.innerHTML = 'Buscando especialistas... <span class="spinner"></span>';
      const especialistas = await this.buscarEspecialistas(formData);

      if (especialistas.length === 0) {
        Utils.showToast('Nenhum especialista disponível no momento', 'error');
        return;
      }

      // Otimizar alocação
      submitButton.innerHTML = 'Calculando melhor opção... <span class="spinner"></span>';
      const resultado = await otimizador.encontrarMelhorAlocacao(
        this.formatarPaciente(formData),
        especialistas
      );

      if (!resultado.sucesso) {
        Utils.showToast('Não foi possível encontrar uma alocação adequada', 'error');
        return;
      }

      // Salvar agendamento
      submitButton.innerHTML = 'Confirmando agendamento... <span class="spinner"></span>';
      await this.enviarDados({
        ...formData,
        alocacao: resultado.melhorOpcao,
        explicacao: resultado.explicacao
      });

      // Redirecionar para página de resultado
      this.mostrarResultado(resultado);

    } catch (error) {
      console.error('Erro ao processar agendamento:', error);
      Utils.showToast('Erro ao processar solicitação. Tente novamente.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  }

  // Buscar especialistas disponíveis
  // IMPORTANTE: Função de demonstração - substituir por integração real com backend
  async buscarEspecialistas(formData) {
    // Simulação de chamada à API
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.warn('⚠️ ATENÇÃO: Usando dados de demonstração. Implemente integração real com backend.');

    // Dados realistas de UPAs de Pernambuco para demonstração
    const upasDisponiveis = [
      {
        municipio: 'recife',
        unidades: [
          { nome: 'UPA Imbiribeira', endereco: 'Av. Mal. Mascarenhas de Morais, Imbiribeira, Recife, PE' },
          { nome: 'UPA Torrões', endereco: 'Rua dos Coqueiros, Torrões, Recife, PE' }
        ]
      },
      {
        municipio: 'jaboatao',
        unidades: [
          { nome: 'UPA Cavaleiro', endereco: 'Av. Barreto de Menezes, Cavaleiro, Jaboatão dos Guararapes, PE' },
          { nome: 'UPA Prazeres', endereco: 'Av. Ayrton Senna, Prazeres, Jaboatão dos Guararapes, PE' }
        ]
      },
      {
        municipio: 'cabo',
        unidades: [
          { nome: 'UPA Ponte dos Carvalhos', endereco: 'Av. Francisco Domingos, Ponte dos Carvalhos, Cabo de Santo Agostinho, PE' }
        ]
      },
      {
        municipio: 'olinda',
        unidades: [
          { nome: 'UPA Jardim Atlântico', endereco: 'Av. Presidente Kennedy, Jardim Atlântico, Olinda, PE' }
        ]
      },
      {
        municipio: 'paulista',
        unidades: [
          { nome: 'UPA Janga', endereco: 'Av. Beira Mar, Janga, Paulista, PE' }
        ]
      },
      {
        municipio: 'igarassu',
        unidades: [
          { nome: 'UPA Igarassu', endereco: 'Centro, Igarassu, PE' }
        ]
      }
    ];

    const especialistas = [];

    upasDisponiveis.forEach(upaInfo => {
      const config = APP_CONFIG.MUNICIPIOS[upaInfo.municipio];
      if (!config) return;

      upaInfo.unidades.forEach((unidade, idx) => {
        especialistas.push({
          id: `${upaInfo.municipio}-${idx}`,
          nome: 'Aguardando designação pelo sistema de saúde',
          especialidade: formData.especialidade,
          municipio: config.nome,
          unidade: unidade.nome,
          endereco: unidade.endereco,
          coordenadas: { lat: config.lat, lng: config.lng },
          tempoEsperaDias: Math.floor(Math.random() * 20) + 1, // Simula fila real
          vagasDisponiveis: Math.floor(Math.random() * 10) + 1,
          observacao: 'Dados de demonstração - aguardando integração com sistema oficial'
        });
      });
    });

    return especialistas;
  }

  // Formatar dados do paciente
  formatarPaciente(formData) {
    return {
      id: 'pac-' + Date.now(),
      nome: formData.nome,
      cpf: formData.cpf,
      genero: formData.genero,
      telefone: formData.telefone,
      endereco: formData.endereco,
      municipioOrigem: formData.municipio,
      especialidade: formData.especialidade,
      idade: formData.idade || 30
    };
  }

  // Mostrar resultado da otimização
  mostrarResultado(resultado) {
    // Buscar dados do formulário para garantir que temos todas as informações
    const formData = this.getFormData();
    const pacienteCompleto = this.formatarPaciente(formData);

    // Garantir que os dados do paciente estão incluídos
    const dadosCompletos = {
      ...resultado,
      paciente: pacienteCompleto
    };

    console.log('Salvando dados completos:', dadosCompletos);

    // Armazenar no localStorage para exibir na próxima página
    localStorage.setItem('resultadoAgendamento', JSON.stringify(dadosCompletos));

    // Redirecionar
    window.location.href = 'resultado.html';
  }

  getFormData() {
    const consentimento = Array.from(this.inputs.consentimento)
      .find(radio => radio.checked)?.id === 'consentimento-sim';

    return {
      nome: this.inputs.nome.value.trim(),
      cpf: this.inputs.documento.value,
      genero: this.inputs.genero.value,
      telefone: this.inputs.telefone.value,
      idade: parseInt(document.getElementById('idade')?.value || 30),
      especialidade: this.inputs.especialidade.value,
      municipio: this.inputs.municipio.value,
      endereco: this.inputs.endereco.value.trim(),
      consentimentoLocalizacao: consentimento,
      dataEnvio: new Date().toISOString()
    };
  }

  async enviarDados(data) {
    // Simulação de delay de rede
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Dados enviados:', data);
        resolve({ success: true });
      }, 2000);
    });

    // Implementação real:
    /*
    const response = await fetch(CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Erro ao enviar dados');
    }

    return await response.json();
    */
  }
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
  console.log('Aplicação de Agendamento inicializada');

  // Inicializar validador de formulário
  const validator = new FormValidator('agendamento-form');

  // Adicionar animação de fade-in ao carregar
  document.querySelector('.form-container')?.classList.add('fade-in');
});
