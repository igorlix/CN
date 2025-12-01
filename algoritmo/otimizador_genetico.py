"""
Otimizador Genético para Alocação de Pacientes em UPAEs
Baseado no algoritmo do notebook teste2.ipynb
Adaptado para uso via API REST
"""

import random
import math
from datetime import datetime, timedelta
from collections import defaultdict

# Seed para reprodutibilidade (opcional em produção, bom para debug)
random.seed(42)

# ==========================================
# CONFIGURAÇÃO DE PESOS E PARÂMETROS
# ==========================================

# Pesos da função objetivo (normalizados por paciente)
ALPHA = 5.0    # peso do no-show médio
BETA = 1.0     # peso do deslocamento médio
GAMMA = 1.0    # peso da espera média
ZETA = 1000.0  # penalidade por violação de restrições (hard constraints)

# Parâmetros de referência para normalização
DIST_REF = 30.0   # distância de referência (km)
WREF = 30.0       # tempo de espera de referência (dias)
LAMBDA_D = 0.02   # sensibilidade distância vs no-show
LAMBDA_T = 0.5    # sensibilidade transporte vs no-show
C_MISS = 1.0      # custo abstrato de uma falta (no-show)

# Probabilidades base de no-show por especialidade
# Inclui especialidades Médicas e Não Médicas (Multiprofissionais)
BASE_NO_SHOW = {
    # --- Especialidades Médicas ---
    'cardiologia': 0.05,
    'endocrinologia': 0.40,
    'ortopedia': 0.25,
    'dermatologia': 0.20,
    'alergologia': 0.15,
    'angiologia': 0.10,
    'gastroenterologia': 0.15,
    'geriatria': 0.10,
    'infectologia': 0.08,
    'nefrologia': 0.12,
    'neurologia': 0.18,
    'oftalmologia': 0.22,
    'otorrinolaringologia': 0.20,
    'pneumologia': 0.12,
    'psiquiatria': 0.35,
    'reumatologia': 0.15,
    'urologia': 0.18,
    'colposcopia': 0.20,
    'pediatria': 0.15,
    'endocrinologia infantil': 0.20,
    'neuropediatria': 0.18,
    'psiquiatria infantil': 0.25,
    'cirurgia geral': 0.10,
    'mastologia': 0.12,
    'radiologia': 0.05,
    'anestesiologia': 0.05,

    # --- Especialidades Não Médicas / Multiprofissionais ---
    'nutrição': 0.15,
    'psicologia': 0.10,
    'fisioterapia': 0.12,
    'fonoaudiologia': 0.15,
    'terapia ocupacional': 0.12,
    'enfermagem': 0.05,
    'serviço social': 0.05,
    'farmácia': 0.05,
    'estomaterapia': 0.08,
    'educação física': 0.10,
    'odontologia': 0.15,
    'psicopedagogia': 0.12
}

# ==========================================
# FUNÇÕES AUXILIARES
# ==========================================

def haversine(lat1, lon1, lat2, lon2):
    """Calcula distância em km entre dois pontos geográficos usando fórmula de Haversine"""
    R = 6371.0  # Raio da Terra em km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * (math.sin(dl/2)**2)
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def clamp(x, a=0.0, b=0.95):
    """Limita valor entre a e b"""
    return max(a, min(b, x))

def compute_p_noshow(paciente, upae, base_no_show):
    """
    Calcula probabilidade de no-show baseada em:
    - Distância geográfica (quanto mais longe, maior a chance de faltar)
    - Qualidade do transporte público (score da UPAE)
    - Probabilidade base da especialidade
    """
    dist = haversine(
        paciente['lat'], paciente['lon'],
        upae['lat'], upae['lon']
    )
    transport_score = upae.get('transport_score', 0.5)

    # Fórmula ajustada: prob aumenta com distância e diminui com bom transporte
    p = base_no_show * (1 + LAMBDA_D * (dist / DIST_REF)) * (1 - LAMBDA_T * transport_score)
    return clamp(p, 0.0, 0.95), dist

# ==========================================
# FUNÇÃO DE FITNESS
# ==========================================

def fitness_of_chromosome(chromosome, pacientes, upaes, base_no_show_dict):
    """
    Calcula o quão boa é uma solução (cromossomo).
    Considera: No-Show, Distância, Tempo de Espera e Penalidades.
    Retorna: (fitness, diagnostics)
    """
    upae_map = {u['id']: u for u in upaes}
    N = len(pacientes)

    # Mapeamento upae -> lista de indices de pacientes alocados
    upae_assignments = defaultdict(list)
    for i, upae_id in enumerate(chromosome):
        if upae_id is None or upae_id == -1:
            continue
        upae_assignments[upae_id].append(i)

    # --- Cálculo de Penalidades (Restrições Fortes) ---
    conflicts = 0  # Múltiplos pacientes na mesma vaga (simplificação: 1 vaga por paciente)
    invalids = 0   # Especialidade incompatível

    for upae_id, patient_list in upae_assignments.items():
        upae = upae_map.get(upae_id)
        
        # Se alocar mais pacientes que a capacidade (aqui assumimos 1 vaga por slot de tempo genérico)
        # Em um sistema real, validaria contra 'vagasDisponiveis' da UPAE
        # Por hora, penalizamos aglomeração excessiva se desejado, ou apenas incompatibilidade
        
        # Validação de especialidade
        for pi in patient_list:
            pac = pacientes[pi]
            if upae is None:
                invalids += 1
                continue
                
            # Verifica se a UPAE atende a especialidade do paciente (Case Insensitive)
            pac_esp = pac['especialidade'].lower()
            upae_esps = [e.lower() for e in upae['especialidades']]
            
            if pac_esp not in upae_esps:
                invalids += 1

    num_unallocated = sum(1 for s in chromosome if s == -1 or s is None)
    
    # Penalidade total
    SlotConstraintPenalty = conflicts + invalids + num_unallocated

    # --- Cálculo dos Objetivos (Soft Constraints) ---
    ExpNoShowCost = 0.0
    TravelCost = 0.0
    WaitCost = 0.0
    expected_noshows_sum = 0.0

    for i, upae_id in enumerate(chromosome):
        # Ignora pacientes não alocados no cálculo de custo (já foram penalizados acima)
        if upae_id in (-1, None):
            continue

        pac = pacientes[i]
        upae = upae_map.get(upae_id)
        if upae is None:
            continue

        # Probabilidade de no-show (com fallback seguro para especialidades novas)
        base = base_no_show_dict.get(pac['especialidade'].lower(), 0.3)
        
        p_ns, dist = compute_p_noshow(pac, upae, base)

        ExpNoShowCost += p_ns * C_MISS
        expected_noshows_sum += p_ns
        TravelCost += (dist / DIST_REF)

        # Tempo de espera (dias)
        days_wait = upae.get('tempo_espera_dias', 0)
        WaitCost += (days_wait / WREF)

    # Normalização por número de pacientes
    norm_ns = ExpNoShowCost / N if N > 0 else 0
    norm_trav = TravelCost / N if N > 0 else 0
    norm_wait = WaitCost / N if N > 0 else 0
    norm_pen = SlotConstraintPenalty / N if N > 0 else 0

    # Custo total ponderado
    total_cost = (
        ALPHA * norm_ns +
        BETA * norm_trav +
        GAMMA * norm_wait +
        ZETA * norm_pen
    )

    # Fitness é o inverso do custo (quanto menor o custo, maior o fitness)
    fitness = 1.0 / (1.0 + total_cost)

    diagnostics = {
        'fitness': fitness,
        'total_cost': total_cost,
        'exp_noshows': ExpNoShowCost,
        'travel_cost': TravelCost,
        'wait_cost': WaitCost,
        'slot_penalty': SlotConstraintPenalty,
        'invalids': invalids,
        'unallocated': num_unallocated
    }

    return fitness, diagnostics

# ==========================================
# OPERADORES GENÉTICOS
# ==========================================

def get_compatible_upaes_for_patient(patient, upaes):
    """Retorna lista de IDs de UPAEs compatíveis com especialidade do paciente"""
    especialidade_paciente = patient['especialidade'].lower()
    return [
        u['id'] for u in upaes
        if especialidade_paciente in [e.lower() for e in u['especialidades']]
    ]

def init_population(pop_size, pacientes, upaes):
    """Inicializa população com soluções aleatórias, respeitando compatibilidade básica"""
    compat_map = [get_compatible_upaes_for_patient(p, upaes) for p in pacientes]
    population = []

    for _ in range(pop_size):
        chrom = []
        for compat in compat_map:
            if not compat:
                chrom.append(-1)  # Sem UPAE compatível
            else:
                chrom.append(random.choice(compat))
        population.append(chrom)

    return population

def tournament_selection(population, fitnesses, k=3):
    """Seleção por torneio: escolhe k aleatórios e pega o melhor"""
    selected_indices = random.sample(range(len(population)), k)
    best_idx = max(selected_indices, key=lambda idx: fitnesses[idx])
    return population[best_idx]

def uniform_crossover(parent1, parent2, crossover_rate=0.9):
    """Crossover uniforme: cada gene tem 50% de chance de vir de cada pai"""
    if random.random() > crossover_rate:
        return parent1.copy(), parent2.copy()

    n = len(parent1)
    child1 = [None] * n
    child2 = [None] * n

    for i in range(n):
        if random.random() < 0.5:
            child1[i] = parent1[i]
            child2[i] = parent2[i]
        else:
            child1[i] = parent2[i]
            child2[i] = parent1[i]

    return child1, child2

def mutation(chromosome, pacientes, upaes, mutation_rate):
    """Mutação com múltiplas estratégias para escapar de mínimos locais"""
    n = len(chromosome)

    if random.random() < mutation_rate:
        op = random.random()

        if op < 0.4:
            # Estratégia 1: Swap simples (troca dois pacientes de lugar)
            if n > 1:
                i, j = random.sample(range(n), 2)
                chromosome[i], chromosome[j] = chromosome[j], chromosome[i]

        elif op < 0.8:
            # Estratégia 2: Reatribuição aleatória
            i = random.randrange(n)
            compat = get_compatible_upaes_for_patient(pacientes[i], upaes)
            if compat:
                chromosome[i] = random.choice(compat)
            else:
                chromosome[i] = -1
        else:
            # Estratégia 3: Shuffle de bloco (embaralha um segmento)
            if n > 3:
                start = random.randint(0, n-3)
                end = min(n, start + random.randint(2, 5))
                subset = chromosome[start:end]
                random.shuffle(subset)
                chromosome[start:end] = subset

    return chromosome

def repair_chromosome(chromosome, pacientes, upaes):
    """
    Repara o cromossomo.
    Tenta resolver conflitos ou preencher vagas vazias com a opção mais próxima.
    """
    upae_map = {u['id']: u for u in upaes}
    
    for i, upae_id in enumerate(chromosome):
        # Se inválido ou não alocado, tenta encontrar a UPAE compatível mais próxima
        pac = pacientes[i]
        
        # Verifica se a alocação atual é válida (especialidade bate?)
        is_valid = False
        if upae_id in upae_map:
            upae = upae_map[upae_id]
            if pac['especialidade'].lower() in [e.lower() for e in upae['especialidades']]:
                is_valid = True
        
        if not is_valid:
            # Busca compatíveis
            compat_upaes = [
                u for u in upaes
                if pac['especialidade'].lower() in [e.lower() for e in u['especialidades']]
            ]
            
            if compat_upaes:
                # Escolhe a geograficamente mais próxima (Greedy repair)
                best_upae = min(
                    compat_upaes,
                    key=lambda u: haversine(pac['lat'], pac['lon'], u['lat'], u['lon'])
                )
                chromosome[i] = best_upae['id']
            else:
                chromosome[i] = -1

    return chromosome

# ==========================================
# FUNÇÃO PRINCIPAL DE EXECUÇÃO (LOOP GA)
# ==========================================

def run_genetic_algorithm(
    pacientes,
    upaes,
    base_no_show_dict=None,
    pop_size=120,
    generations=400,
    crossover_rate=0.7,
    mutation_rate=0.3,
    elitism=0.15
):
    """
    Executa o loop principal do Algoritmo Genético.
    """
    if base_no_show_dict is None:
        base_no_show_dict = BASE_NO_SHOW

    # 1. Inicializar população
    population = init_population(pop_size, pacientes, upaes)
    best_history = []

    # 2. Loop evolutivo
    for gen in range(generations):
        # Avaliar fitness de toda a população
        fitnesses = [
            fitness_of_chromosome(ch, pacientes, upaes, base_no_show_dict)[0]
            for ch in population
        ]

        # Registrar o melhor desta geração
        best_idx = max(range(len(population)), key=lambda i: fitnesses[i])
        best_history.append((gen, fitnesses[best_idx]))

        new_pop = []

        # Elitismo: Mantém os melhores inalterados
        num_elite = max(1, int(elitism * pop_size))
        elite_indices = sorted(
            range(len(population)),
            key=lambda i: fitnesses[i],
            reverse=True
        )[:num_elite]

        for i in elite_indices:
            new_pop.append(population[i].copy())

        # Reprodução para preencher o resto da população
        while len(new_pop) < pop_size:
            # Seleção
            parent1 = tournament_selection(population, fitnesses, k=3)
            parent2 = tournament_selection(population, fitnesses, k=3)

            # Cruzamento
            child1, child2 = uniform_crossover(parent1, parent2, crossover_rate)

            # Mutação
            child1 = mutation(child1, pacientes, upaes, mutation_rate)
            child2 = mutation(child2, pacientes, upaes, mutation_rate)

            # Reparo (Heurística para melhorar qualidade)
            child1 = repair_chromosome(child1, pacientes, upaes)
            child2 = repair_chromosome(child2, pacientes, upaes)

            new_pop.append(child1)
            if len(new_pop) < pop_size:
                new_pop.append(child2)

        population = new_pop

    # 3. Resultado final: Melhor solução encontrada
    fitnesses = [
        fitness_of_chromosome(ch, pacientes, upaes, base_no_show_dict)[0]
        for ch in population
    ]
    best_idx = max(range(len(population)), key=lambda i: fitnesses[i])
    best_chrom = population[best_idx]
    
    best_fitness, best_diag = fitness_of_chromosome(
        best_chrom, pacientes, upaes, base_no_show_dict
    )

    return {
        'best_chromosome': best_chrom,
        'best_fitness': best_fitness,
        'best_diag': best_diag,
        'history': best_history
    }

# ==========================================
# INTERFACE SIMPLIFICADA PARA API (SINGLE PATIENT)
# ==========================================

def otimizar_alocacao_paciente(paciente_data, upaes_disponiveis):
    """
    Wrapper para rodar o GA focado na alocação de um único paciente (entrando via API).
    Retorna a melhor opção E alternativas ranqueadas.
    """
    # Cria lista com único paciente
    pacientes = [paciente_data]

    # Executa GA com parâmetros otimizados para velocidade (menos gerações/população)
    result = run_genetic_algorithm(
        pacientes,
        upaes_disponiveis,
        pop_size=50,
        generations=100,
        crossover_rate=0.7,
        mutation_rate=0.3,
        elitism=0.15
    )

    # Extrai a alocação
    best_chromosome = result['best_chromosome']
    upae_id = best_chromosome[0]

    if upae_id == -1 or upae_id is None:
        return {
            'sucesso': False,
            'mensagem': 'Nenhuma UPAE compatível encontrada para esta especialidade.'
        }

    # Encontra o objeto UPAE correspondente ao ID escolhido
    upae_alocada = next((u for u in upaes_disponiveis if u['id'] == upae_id), None)

    if not upae_alocada:
        return {
            'sucesso': False,
            'mensagem': 'Erro interno na identificação da UPAE alocada.'
        }

    # Calcula métricas finais para a melhor opção
    base_ns = BASE_NO_SHOW.get(paciente_data['especialidade'].lower(), 0.3)
    p_noshow, dist = compute_p_noshow(paciente_data, upae_alocada, base_ns)

    melhor_opcao = {
        'upae': upae_alocada,
        'distancia_km': round(dist, 2),
        'prob_noshow': round(p_noshow * 100, 1), # Porcentagem
        'tempo_espera_dias': upae_alocada.get('tempo_espera_dias', 0),
        'fitness': result['best_fitness'],
        'score': result['best_fitness']
    }

    # ==== GERAR ALTERNATIVAS ====
    # Calcula score para todas as UPAEs compatíveis
    especialidade_paciente = paciente_data['especialidade'].lower()
    upaes_compativeis = [
        u for u in upaes_disponiveis
        if especialidade_paciente in [e.lower() for e in u['especialidades']]
    ]

    alternativas = []
    for upae in upaes_compativeis:
        if upae['id'] == upae_id:
            continue  # Pula a melhor opção (já está no retorno principal)

        # Calcula métricas para esta UPAE
        p_ns, d = compute_p_noshow(paciente_data, upae, base_ns)

        # Calcula fitness para esta UPAE individualmente
        # Usa o mesmo cálculo do GA, mas para uma única alocação
        temp_chrom = [upae['id']]
        temp_fit, _ = fitness_of_chromosome(temp_chrom, pacientes, upaes_disponiveis, {paciente_data['especialidade'].lower(): base_ns})

        alternativas.append({
            'upae': upae,
            'distancia_km': round(d, 2),
            'prob_noshow': round(p_ns * 100, 1),
            'tempo_espera_dias': upae.get('tempo_espera_dias', 0),
            'fitness': temp_fit,
            'score': temp_fit
        })

    # Ordena alternativas por fitness (melhor primeiro) e pega top 4
    alternativas = sorted(alternativas, key=lambda x: x['fitness'], reverse=True)[:4]

    return {
        'sucesso': True,
        'melhor_opcao': melhor_opcao,
        'alternativas': alternativas,
        'diagnosticos': result['best_diag']
    }