// Aplicação de Agendamento de Consulta
// Arquivo principal com validações e lógica do formulário

// Utilitários
const Utils = {
  validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
  },

  mascaraCPF(value) {
    return value.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toast.className = `toast toast-${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), APP_CONFIG.TOAST_DURATION);
  },

  async buscarCEP(cep) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado');
      return data;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      return null;
    }
  }
};

// Validação de Formulário e Lógica de Negócio
class FormValidator {
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.inputs = {};
    this.errors = {};
    
    // Lista de especialidades não médicas para agrupamento
    this.naoMedicas = new Set([
      'Nutrição', 'Psicologia', 'Fisioterapia', 'Fonoaudiologia',
      'Terapia Ocupacional', 'Enfermagem', 'Serviço Social', 'Farmácia',
      'Estomaterapia', 'Educação Física', 'Odontologia', 'Psicopedagogia'
    ]);

    this.initializeInputs();
    this.setupEventListeners();

    // Estado inicial: Especialidade bloqueada
    this.inputs.especialidade.disabled = true;
  }

  initializeInputs() {
    this.inputs = {
      nome: document.getElementById('nome'),
      documento: document.getElementById('documento'),
      sexo: document.getElementById('sexo'),   // Novo
      idade: document.getElementById('idade'), // Novo
      especialidade: document.getElementById('especialidade'),
      municipio: document.getElementById('municipio'),
      endereco: document.getElementById('endereco'),
      consentimento: document.querySelectorAll('input[name="consentimento"]')
    };
  }

  setupEventListeners() {
    // Validação básica
    this.inputs.nome.addEventListener('blur', () => this.validateNome());
    this.inputs.documento.addEventListener('blur', () => this.validateCPF());
    
    // Máscaras
    this.inputs.documento.addEventListener('input', (e) => {
      e.target.value = Utils.mascaraCPF(e.target.value);
    });

    // Endereço Automático
    this.inputs.endereco.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      if (value.length === 8) this.buscarCEPAutomatico(value);
    });

    // --- LOGICA DE FILTRO DE ESPECIALIDADE ---
    // Sempre que Sexo ou Idade mudar, atualiza a lista
    this.inputs.sexo.addEventListener('change', () => this.atualizarListaEspecialidades());
    this.inputs.idade.addEventListener('input', () => this.atualizarListaEspecialidades());

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  // Lógica principal de filtro com AGRUPAMENTO
  atualizarListaEspecialidades() {
    const sexo = this.inputs.sexo.value;
    const idade = parseInt(this.inputs.idade.value);
    const select = this.inputs.especialidade;

    // Se faltar dados, bloqueia e avisa
    if (!sexo || isNaN(idade)) {
      select.disabled = true;
      select.innerHTML = '<option value="" disabled selected>Preencha sexo e idade primeiro</option>';
      return;
    }

    // Libera o campo
    select.disabled = false;
    select.innerHTML = '<option value="" disabled selected>Selecione a especialidade</option>';

    // 1. Pega todas as especialidades únicas de todas as UPAEs
    const todasEspecialidades = new Set();
    APP_CONFIG.UPAES.forEach(upae => {
      upae.especialidades.forEach(esp => todasEspecialidades.add(esp));
    });

    // 2. Ordena alfabeticamente
    const listaOrdenada = Array.from(todasEspecialidades).sort();

    // 3. Cria os grupos (optgroup)
    const grupoMedicas = document.createElement('optgroup');
    grupoMedicas.label = "Especialidades Médicas";

    const grupoNaoMedicas = document.createElement('optgroup');
    grupoNaoMedicas.label = "Equipe Multidisciplinar";

    let countMedicas = 0;
    let countNaoMedicas = 0;

    // 4. Aplica as regras de negócio e distribui nos grupos
    listaOrdenada.forEach(esp => {
      if (this.isEspecialidadePermitida(esp, sexo, idade)) {
        const option = document.createElement('option');
        option.value = esp;
        option.textContent = esp;

        if (this.naoMedicas.has(esp)) {
          grupoNaoMedicas.appendChild(option);
          countNaoMedicas++;
        } else {
          grupoMedicas.appendChild(option);
          countMedicas++;
        }
      }
    });

    // 5. Adiciona os grupos ao select (se tiverem itens)
    if (countMedicas > 0) select.appendChild(grupoMedicas);
    if (countNaoMedicas > 0) select.appendChild(grupoNaoMedicas);

    if (countMedicas + countNaoMedicas === 0) {
      const option = document.createElement('option');
      option.textContent = "Nenhuma especialidade disponível para este perfil";
      option.disabled = true;
      select.appendChild(option);
    }
  }

  isEspecialidadePermitida(nomeEspecialidade, sexoPaciente, idadePaciente) {
    // Busca a regra específica ou usa o default (liberado para todos)
    const regra = APP_CONFIG.REGRAS_ESPECIALIDADES[nomeEspecialidade] || APP_CONFIG.REGRAS_ESPECIALIDADES['default'];

    // Verifica Sexo
    if (regra.sexo !== 'ambos' && regra.sexo !== sexoPaciente) {
      return false;
    }

    // Verifica Idade Mínima
    if (regra.minIdade && idadePaciente < regra.minIdade) {
      return false;
    }

    // Verifica Idade Máxima
    if (regra.maxIdade && idadePaciente > regra.maxIdade) {
      return false;
    }

    return true;
  }

  // --- Validações Individuais ---

  validateNome() {
    const val = this.inputs.nome.value.trim();
    if (val.length < 3) {
      this.setError('nome', 'Nome inválido'); return false;
    }
    this.setSuccess('nome'); return true;
  }

  validateCPF() {
    if (!Utils.validarCPF(this.inputs.documento.value)) {
      this.setError('documento', 'CPF inválido'); return false;
    }
    this.setSuccess('documento'); return true;
  }

  // ... Validações simples
  validateMunicipio() { return this.inputs.municipio.value !== "" ? (this.setSuccess('municipio'), true) : (this.setError('municipio', 'Obrigatório'), false); }
  validateEndereco() { return this.inputs.endereco.value.length > 5 ? (this.setSuccess('endereco'), true) : (this.setError('endereco', 'Obrigatório'), false); }
  validateEspecialidade() { return this.inputs.especialidade.value !== "" ? (this.setSuccess('especialidade'), true) : (this.setError('especialidade', 'Obrigatório'), false); }

  setError(field, msg) {
    const input = this.inputs[field];
    input.classList.add('border-red-500');
  }
  
  setSuccess(field) {
    const input = this.inputs[field];
    input.classList.remove('border-red-500');
    input.classList.add('border-green-500');
  }

  async buscarCEPAutomatico(cep) {
    this.inputs.endereco.disabled = true;
    this.inputs.endereco.value = "Buscando...";
    const dados = await Utils.buscarCEP(cep);
    
    if (dados) {
      this.inputs.endereco.value = `${dados.logradouro}, ${dados.bairro}, ${dados.localidade} - ${dados.uf}`;
      Utils.showToast('Endereço encontrado!');
    } else {
      this.inputs.endereco.value = "";
      Utils.showToast('CEP não encontrado', 'error');
    }
    this.inputs.endereco.disabled = false;
    this.inputs.endereco.focus();
  }

  validateAll() {
    const sexoOk = this.inputs.sexo.value !== "";
    const idadeOk = this.inputs.idade.value !== "" && parseInt(this.inputs.idade.value) >= 0;

    return this.validateNome() && this.validateCPF() && sexoOk && idadeOk &&
           this.validateEspecialidade() && this.validateMunicipio() && this.validateEndereco();
  }

  async handleSubmit(event) {
    event.preventDefault();

    if (!this.validateAll()) {
      Utils.showToast('Preencha todos os campos corretamente', 'error');
      return;
    }

    const btn = this.form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Processando...';

    try {
      const formData = this.getFormData();

      // 1. Geocodificar endereço do paciente
      console.log('Geocodificando endereço do paciente...');
      const coordsPaciente = await mapsIntegration.geocodificarEndereco(formData.endereco);
      console.log('Coordenadas obtidas:', coordsPaciente);

      // 2. Buscar especialistas e geocodificar suas UPAEs
      console.log('Buscando UPAEs compatíveis...');
      const especialistas = await this.buscarEspecialistas(formData);

      if (especialistas.length === 0) {
        throw new Error('Nenhuma unidade encontrada para esta especialidade.');
      }

      // 3. Geocodificar endereços das UPAEs
      console.log('Geocodificando UPAEs...');
      for (const esp of especialistas) {
        try {
          const coords = await mapsIntegration.geocodificarEndereco(esp.endereco);
          esp.lat = coords.lat;
          esp.lon = coords.lng;
          console.log(`${esp.nome}: ${coords.lat}, ${coords.lng}`);
        } catch (error) {
          console.error(`Erro ao geocodificar ${esp.nome}:`, error);
          throw new Error(`Não foi possível localizar a UPAE ${esp.municipio}. Verifique sua conexão.`);
        }
      }

      // 4. Otimizar com algoritmo genético
      console.log('Executando otimização genética...');
      const pacienteComCoordenadas = {
        ...this.formatarPaciente(formData),
        lat: coordsPaciente.lat,
        lon: coordsPaciente.lng
      };

      const resultado = await otimizador.encontrarMelhorAlocacao(
        pacienteComCoordenadas,
        especialistas
      );

      if (!resultado.sucesso) throw new Error('Não foi possível alocar.');

      // 5. Salvar e Redirecionar
      localStorage.setItem('resultadoAgendamento', JSON.stringify(resultado));
      window.location.href = 'resultado.html';

    } catch (error) {
      console.error('Erro:', error);
      Utils.showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  getFormData() {
    const consentimento = Array.from(this.inputs.consentimento)
      .find(radio => radio.checked)?.id === 'consentimento-sim';

    return {
      nome: this.inputs.nome.value.trim(),
      cpf: this.inputs.documento.value,
      sexo: this.inputs.sexo.value,
      idade: parseInt(this.inputs.idade.value),
      especialidade: this.inputs.especialidade.value,
      municipio: this.inputs.municipio.value,
      endereco: this.inputs.endereco.value.trim(),
      consentimentoLocalizacao: consentimento,
      dataEnvio: new Date().toISOString()
    };
  }

  formatarPaciente(data) {
    // Cria objeto paciente para o otimizador
    return {
      id: 'pac-' + Date.now(),
      nome: data.nome,
      cpf: data.cpf,
      sexo: data.sexo,
      especialidade: data.especialidade,
      endereco: data.endereco,
      municipio: data.municipio,
      idade: data.idade,
      gestante: false,
      deficiencia: false,
      urgente: false
    };
  }

  async buscarEspecialistas(formData) {
    // Simula busca no backend filtrando UPAEs que tem a string da especialidade
    return APP_CONFIG.UPAES
      .filter(u => u.especialidades.includes(formData.especialidade))
      .map(u => ({
        id: u.id,
        unidade: u.nome, // Otimizador espera 'unidade'
        nome: u.nome,
        municipio: u.municipio,
        endereco: u.endereco,
        especialidade: formData.especialidade,
        tempoEsperaDias: Math.floor(Math.random() * 15), // Simulação
        vagasDisponiveis: 5
      }));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FormValidator('agendamento-form');
});