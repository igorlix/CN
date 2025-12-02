"""
Otimizador Genético NSGA-II para Alocação de Pacientes em UPAEs
Algoritmo Multi-Objetivo baseado em Non-dominated Sorting Genetic Algorithm II
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

# Parâmetros de referência para normalização
DIST_REF = 30.0   # distância de referência (km)
WREF = 30.0       # tempo de espera de referência (dias)
LAMBDA_D = 0.02   # sensibilidade distância vs no-show
LAMBDA_T = 0.5    # sensibilidade transporte vs no-show

# Soft constraint no-show
TH_NS = 0.7       # limite aceitável de no-show médio entre ATENDIDOS (70%)
PEN_NS = 10.0     # penalidade multiplicada pela violação do limite

# Penalização por paciente sem vaga
W_UNALLOC = 2.0

# Probabilidades base de no-show por especialidade
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

def can_fully_allocate(pacientes, upaes):
    """
    Verifica se, POR ESPECIALIDADE, há vagas suficientes para todos os pacientes.
    Retorna True se há capacidade suficiente, False se há escassez.

    Esta função é usada para determinar se devemos aplicar penalização forte
    em pacientes sem vaga (cenário de escassez).
    """
    from collections import defaultdict
    pats_per_spec = defaultdict(int)
    vagas_per_spec = defaultdict(int)

    # Conta pacientes por especialidade
    for p in pacientes:
        spec = p['especialidade'].lower()
        pats_per_spec[spec] += 1

    # Conta vagas por especialidade
    for u in upaes:
        for esp in u['especialidades']:
            esp_lower = esp.lower()
            vagas_per_spec[esp_lower] += 1

    # Verifica se há capacidade suficiente para cada especialidade
    for spec, n_pat in pats_per_spec.items():
        if vagas_per_spec.get(spec, 0) < n_pat:
            return False
    return True

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
# RESTRIÇÕES E VIABILIDADE
# ==========================================

def is_feasible(chromosome, pacientes, upaes, force_allocation=False):
    """
    Restrição dura:
    - Proibido: dois pacientes na mesma UPAE (sem sobrecarga)
    - Proibido: especialidade incompatível paciente-UPAE
    - Paciente sem vaga (upae_id = -1 ou None):
        * se force_allocation == True  -> proibido (cenário com capacidade suficiente)
        * se force_allocation == False -> permitido (cenário de escassez)
    """
    upae_map = {u['id']: u for u in upaes}
    used_upaes = set()

    for i, upae_id in enumerate(chromosome):
        if upae_id in (-1, None):
            if force_allocation:
                # Cenário com capacidade suficiente, não aceitamos paciente sem vaga
                return False
            else:
                # Cenário de escassez, permitimos paciente sem vaga
                continue

        upae = upae_map.get(upae_id)
        if upae is None:
            return False

        # Verifica especialidade compatível
        pac_esp = pacientes[i]['especialidade'].lower()
        upae_esps = [e.lower() for e in upae['especialidades']]

        if pac_esp not in upae_esps:
            return False

        # Verifica conflito de vaga (simplificado: 1 paciente por UPAE)
        if upae_id in used_upaes:
            return False

        used_upaes.add(upae_id)

    return True

# ==========================================
# POPULAÇÃO INICIAL
# ==========================================

def init_feasible_population(pop_size, pacientes, upaes):
    """
    Gera população inicial VIÁVEL:
    - Sem conflito de vaga
    - Especialidade compatível
    - Pacientes sem vaga quando não há UPAE disponível na especialidade
    """
    upaes_by_spec = defaultdict(list)
    for u in upaes:
        for spec in u['especialidades']:
            upaes_by_spec[spec.lower()].append(u['id'])

    population = []
    n_patients = len(pacientes)

    for _ in range(pop_size):
        chrom = [-1] * n_patients
        free_upaes_by_spec = {
            spec: upaes_by_spec[spec].copy()
            for spec in upaes_by_spec
        }
        idxs = list(range(n_patients))
        random.shuffle(idxs)

        for i in idxs:
            pat = pacientes[i]
            spec = pat['especialidade'].lower()
            free = free_upaes_by_spec.get(spec, [])
            if not free:
                chrom[i] = -1
            else:
                uid = random.choice(free)
                chrom[i] = uid
                free.remove(uid)

        # Validação extra de segurança
        if not is_feasible(chrom, pacientes, upaes):
            chrom = [-1 if not is_feasible([uid], [pacientes[i]], upaes) else uid
                     for i, uid in enumerate(chrom)]
        population.append(chrom)

    return population

# ==========================================
# OPERADORES GENÉTICOS
# ==========================================

def uniform_crossover(parent1, parent2, crossover_rate=0.9):
    if random.random() > crossover_rate:
        return parent1.copy(), parent2.copy()
    n = len(parent1)
    child1 = [None]*n
    child2 = [None]*n
    for i in range(n):
        if random.random() < 0.5:
            child1[i] = parent1[i]
            child2[i] = parent2[i]
        else:
            child1[i] = parent2[i]
            child2[i] = parent1[i]
    return child1, child2

def mutation(chromosome, pacientes, upaes, mutation_rate=0.3):
    if random.random() >= mutation_rate:
        return chromosome
    n = len(chromosome)
    op = random.random()
    if op < 0.4 and n > 1:
        # swap (apenas se houver pelo menos 2 pacientes)
        i, j = random.sample(range(n), 2)
        chromosome[i], chromosome[j] = chromosome[j], chromosome[i]
    elif op < 0.8:
        # reatribui um paciente para outra UPAE compatível ou sem vaga
        i = random.randrange(n)
        spec = pacientes[i]['especialidade'].lower()
        compat_upaes = [
            u['id'] for u in upaes
            if spec in [e.lower() for e in u['especialidades']]
        ]
        if compat_upaes:
            chromosome[i] = random.choice(compat_upaes + [-1])
        else:
            chromosome[i] = -1
    else:
        # shuffle em bloco
        if n >= 3:
            start = random.randint(0, n-3)
            end = min(n, start + random.randint(2, 5))
            subset = chromosome[start:end]
            random.shuffle(subset)
            chromosome[start:end] = subset
    return chromosome

def repair_chromosome(chromosome, pacientes, upaes, force_allocation=False):
    """
    Reparo em duas etapas:
    1ª passada: Limpa UPAEs inexistentes, conflitos de vaga e especialidade errada -> vira -1
    2ª passada: Se force_allocation == True, tenta preencher pacientes com -1
                usando QUALQUER UPAE livre compatível (sem otimizar distância)
    """
    upae_map = {u['id']: u for u in upaes}
    used_upaes = set()

    # 1ª passada: limpar inconsistências
    for i, uid in enumerate(chromosome):
        if uid in (-1, None):
            continue

        upae = upae_map.get(uid)
        pac_esp = pacientes[i]['especialidade'].lower()

        # Verifica se UPAE existe, se especialidade é compatível e se não há conflito
        if upae is None:
            chromosome[i] = -1
        elif pac_esp not in [e.lower() for e in upae['especialidades']]:
            chromosome[i] = -1
        elif uid in used_upaes:
            chromosome[i] = -1
        else:
            used_upaes.add(uid)

    if not force_allocation:
        # Cenário de escassez: podemos deixar -1
        return chromosome

    # 2ª passada (somente se force_allocation == True):
    # preenche -1 com UPAEs livres compatíveis (sem otimizar distância)
    free_upaes_by_spec = defaultdict(list)
    for u in upaes:
        if u['id'] not in used_upaes:
            for esp in u['especialidades']:
                free_upaes_by_spec[esp.lower()].append(u['id'])

    for i, uid in enumerate(chromosome):
        if uid in (-1, None):
            spec = pacientes[i]['especialidade'].lower()
            free_list = free_upaes_by_spec.get(spec)
            if free_list:
                new_uid = free_list.pop(0)  # escolhe qualquer um disponível
                chromosome[i] = new_uid
                used_upaes.add(new_uid)

    return chromosome

# ==========================================
# NSGA-II - DOMINÂNCIA E PARETO
# ==========================================

def dominates(obj_a, obj_b):
    """
    Minimização: obj_a domina obj_b se:
    - não é pior em nenhum objetivo
    - é melhor em pelo menos um
    """
    not_worse = all(a <= b for a, b in zip(obj_a, obj_b))
    strictly_better = any(a < b for a, b in zip(obj_a, obj_b))
    return not_worse and strictly_better

def fast_nondominated_sort(population, objectives_list):
    S = [[] for _ in population]
    n = [0 for _ in population]
    fronts = [[]]

    for p in range(len(population)):
        for q in range(len(population)):
            if p == q:
                continue
            if dominates(objectives_list[p], objectives_list[q]):
                S[p].append(q)
            elif dominates(objectives_list[q], objectives_list[p]):
                n[p] += 1
        if n[p] == 0:
            fronts[0].append(p)

    i = 0
    while fronts[i]:
        next_front = []
        for p in fronts[i]:
            for q in S[p]:
                n[q] -= 1
                if n[q] == 0:
                    next_front.append(q)
        i += 1
        fronts.append(next_front)

    if not fronts[-1]:
        fronts.pop()
    return fronts

def crowding_distance(front, objectives_list):
    distance = {i: 0.0 for i in front}
    if len(front) == 0:
        return distance
    num_obj = len(objectives_list[0])

    for m in range(num_obj):
        front_sorted = sorted(front, key=lambda i: objectives_list[i][m])
        f_min = objectives_list[front_sorted[0]][m]
        f_max = objectives_list[front_sorted[-1]][m]
        if f_max == f_min:
            continue
        distance[front_sorted[0]]  = float('inf')
        distance[front_sorted[-1]] = float('inf')
        for k in range(1, len(front_sorted)-1):
            prev_idx = front_sorted[k-1]
            next_idx = front_sorted[k+1]
            dist = (objectives_list[next_idx][m] - objectives_list[prev_idx][m]) / (f_max - f_min)
            distance[front_sorted[k]] += dist

    return distance

def mo_tournament_selection(population, fronts, crowding, k=2):
    # mapa idx -> rank (nível da frente)
    rank = {}
    for r, front in enumerate(fronts):
        for idx in front:
            rank[idx] = r

    candidates = random.sample(range(len(population)), k)
    best = candidates[0]
    for idx in candidates[1:]:
        if rank[idx] < rank[best]:
            best = idx
        elif rank[idx] == rank[best]:
            if crowding.get(idx, 0.0) > crowding.get(best, 0.0):
                best = idx
    return population[best]

# ==========================================
# AVALIAÇÃO DE OBJETIVOS (MULTI-OBJETIVO)
# ==========================================

def evaluate_objectives(chromosome, pacientes, upaes, base_no_show_dict, high_penalty_unalloc=False):
    """
    Objetivos (MINIMIZAR), dividindo por número de atendidos para normalização:

    1) adj_trav : soma da distância relativa (normalizada)
    2) adj_wait : soma da espera relativa + penalizações (normalizada)

    Penalizações:
      - W_UNALLOC (ou peso alto se high_penalty_unalloc) * num_unallocated
      - Soft constraint: no-show médio > TH_NS

    Normalização: Divide custos por assigned_count para evitar viés contra
                  soluções com mais pacientes alocados.

    high_penalty_unalloc: Se True, aplica penalização 50x maior para pacientes
                         sem vaga (usado em cenário de escassez)
    """

    upae_map = {u['id']: u for u in upaes}

    TravelCost = 0.0
    WaitCost   = 0.0
    NoShowSum  = 0.0  # Soma de probabilidades
    num_unallocated = 0
    assigned_count  = 0

    for i, upae_id in enumerate(chromosome):
        pat = pacientes[i]

        # paciente sem vaga (permitido, mas penalizado)
        if upae_id in (-1, None):
            num_unallocated += 1
            continue

        upae = upae_map.get(upae_id)
        if upae is None:
            num_unallocated += 1
            continue

        # distância relativa
        dist = haversine(pat['lat'], pat['lon'], upae['lat'], upae['lon'])
        TravelCost += (dist / DIST_REF)

        # espera relativa
        days_wait = upae.get('tempo_espera_dias', 0)
        WaitCost += (days_wait / WREF)

        # no-show (somente para teste do limite)
        base = base_no_show_dict.get(pat['especialidade'].lower(), 0.3)
        p_ns, _ = compute_p_noshow(pat, upae, base)
        NoShowSum += p_ns

        assigned_count += 1

    # Penalização por pacientes sem vaga
    # Cenário de escassez: penalização MUITO maior
    w_unalloc = 50.0 if high_penalty_unalloc else W_UNALLOC
    penalty_unalloc = w_unalloc * num_unallocated

    # Soft constraint de no-show
    if assigned_count > 0 and NoShowSum > TH_NS * assigned_count:
        viol = NoShowSum - TH_NS * assigned_count
        penalty_ns = PEN_NS * viol
    else:
        penalty_ns = 0.0

    # Normalização: dividir por num_assigned para evitar viés
    if assigned_count > 0:
        TravelCost /= assigned_count
        WaitCost   /= assigned_count

    adj_trav = TravelCost
    adj_wait = WaitCost + penalty_unalloc + penalty_ns

    return (adj_trav, adj_wait)

# ==========================================
# DIAGNÓSTICOS PARA SOLUÇÃO
# ==========================================

def diagnostics_for_solution(chromosome, pacientes, upaes, base_no_show_dict):
    upae_map = {u['id']: u for u in upaes}

    total_dist = 0.0
    total_wait = 0.0
    ExpNoShowCost = 0.0
    num_unallocated = 0
    assigned_count = 0

    for i, uid in enumerate(chromosome):
        pat = pacientes[i]
        if uid in (-1, None):
            num_unallocated += 1
            continue

        upae = upae_map.get(uid)
        if upae is None:
            num_unallocated += 1
            continue

        dist = haversine(pat['lat'], pat['lon'], upae['lat'], upae['lon'])
        total_dist += dist

        days_wait = upae.get('tempo_espera_dias', 0)
        total_wait += days_wait

        base = base_no_show_dict.get(pat['especialidade'].lower(), 0.3)
        p_ns, _ = compute_p_noshow(pat, upae, base)
        ExpNoShowCost += p_ns

        assigned_count += 1

    # evita divisão por zero
    if assigned_count > 0:
        mean_dist = total_dist / assigned_count
        mean_wait = total_wait / assigned_count
        mean_noshow = ExpNoShowCost / assigned_count
    else:
        mean_dist = 0.0
        mean_wait = 0.0
        mean_noshow = 0.0

    return {
        'distancia_media_km': mean_dist,
        'espera_media_dias': mean_wait,
        'prob_noshow_media': mean_noshow,
        'faltas_esperadas': ExpNoShowCost,
        'pacientes_atendidos': assigned_count,
        'pacientes_sem_vaga': num_unallocated,
        'total_pacientes': len(pacientes)
    }

# ==========================================
# NSGA-II - LOOP PRINCIPAL
# ==========================================

def run_nsga2(pacientes, upaes, base_ns=None,
              pop_size=120, generations=200,
              crossover_rate=0.9, mutation_rate=0.3):
    """
    Executa o NSGA-II para otimização multi-objetivo.
    Retorna as soluções da frente de Pareto.

    Melhorias implementadas:
    - Detecção automática de capacidade (force_allocation)
    - Penalização adaptativa para cenários de escassez
    - Normalização de objetivos por número de pacientes atendidos
    """
    if base_ns is None:
        base_ns = BASE_NO_SHOW

    # 1) Detecta se há capacidade suficiente por especialidade
    force_allocation = can_fully_allocate(pacientes, upaes)
    # Se NÃO há capacidade, vamos usar penalidade forte em pacientes sem vaga
    high_penalty_unalloc = not force_allocation

    print(f"[NSGA-II] force_allocation = {force_allocation}  "
          f"(capacidade suficiente por especialidade? {'SIM' if force_allocation else 'NÃO'})")

    # 2) População inicial (já viável)
    population = init_feasible_population(pop_size, pacientes, upaes)
    history = []

    for gen in range(generations):
        # 3) Avalia população
        objectives_list = [
            evaluate_objectives(ch, pacientes, upaes, base_ns, high_penalty_unalloc)
            for ch in population
        ]

        fronts = fast_nondominated_sort(population, objectives_list)

        crowding = {}
        for front in fronts:
            cd = crowding_distance(front, objectives_list)
            crowding.update(cd)

        # média dos objetivos da frente 1 (para histórico)
        front0 = fronts[0]
        f0_vals = [objectives_list[i] for i in front0]
        mean_front0 = tuple(
            sum(v[j] for v in f0_vals) / len(f0_vals)
            for j in range(len(f0_vals[0]))
        )
        history.append((gen, mean_front0))

        # 4) gerar filhos viáveis
        offspring = []
        max_attempts = 5 * pop_size
        attempts = 0

        while len(offspring) < pop_size and attempts < max_attempts:
            attempts += 1
            p1 = mo_tournament_selection(population, fronts, crowding, k=2)
            p2 = mo_tournament_selection(population, fronts, crowding, k=2)
            c1, c2 = uniform_crossover(p1, p2, crossover_rate)
            c1 = mutation(c1, pacientes, upaes, mutation_rate)
            c2 = mutation(c2, pacientes, upaes, mutation_rate)

            # reparo leve, mas com preenchimento em cenário force_allocation
            c1 = repair_chromosome(c1, pacientes, upaes, force_allocation)
            c2 = repair_chromosome(c2, pacientes, upaes, force_allocation)

            if is_feasible(c1, pacientes, upaes, force_allocation):
                offspring.append(c1)
            if len(offspring) < pop_size and is_feasible(c2, pacientes, upaes, force_allocation):
                offspring.append(c2)

        # se não conseguimos filhos suficientes, preenche com cópias
        while len(offspring) < pop_size:
            offspring.append(random.choice(population).copy())

        # 5) Seleção elitista
        combined = population + offspring
        combined_objs = [
            evaluate_objectives(ch, pacientes, upaes, base_ns, high_penalty_unalloc)
            for ch in combined
        ]
        combined_fronts = fast_nondominated_sort(combined, combined_objs)

        new_pop = []
        for front in combined_fronts:
            if len(new_pop) + len(front) <= pop_size:
                for idx in front:
                    new_pop.append(combined[idx])
            else:
                cd = crowding_distance(front, combined_objs)
                sorted_front = sorted(front, key=lambda i: cd[i], reverse=True)
                remaining = pop_size - len(new_pop)
                for idx in sorted_front[:remaining]:
                    new_pop.append(combined[idx])
                break

        population = new_pop

    # 6) Pareto final
    final_objs = [
        evaluate_objectives(ch, pacientes, upaes, base_ns, high_penalty_unalloc)
        for ch in population
    ]
    final_fronts = fast_nondominated_sort(population, final_objs)
    pareto_indices = final_fronts[0]

    pareto_solutions = []
    for idx in pareto_indices:
        chrom = population[idx]
        objs = final_objs[idx]
        diag = diagnostics_for_solution(chrom, pacientes, upaes, base_ns)
        pareto_solutions.append({
            'chromosome': chrom,
            'objectives': objs,
            'diagnostics': diag
        })

    return {
        'pareto_solutions': pareto_solutions,
        'population': population,
        'objectives': final_objs,
        'fronts': final_fronts,
        'history': history
    }

# ==========================================
# WRAPPER PARA COMPATIBILIDADE COM GA MONO-OBJETIVO
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
    Wrapper para compatibilidade retroativa com código existente.
    Executa NSGA-II mas retorna apenas a melhor solução de compromisso.
    """
    res = run_nsga2(
        pacientes, upaes, base_no_show_dict,
        pop_size=pop_size,
        generations=generations,
        crossover_rate=crossover_rate,
        mutation_rate=mutation_rate
    )

    pareto_solutions = res['pareto_solutions']

    if not pareto_solutions:
        # Fallback: retorna solução vazia
        return {
            'best_chromosome': [-1] * len(pacientes),
            'best_fitness': 0.0,
            'best_diag': diagnostics_for_solution([-1] * len(pacientes), pacientes, upaes, base_no_show_dict or BASE_NO_SHOW),
            'history': res['history'],
            'pareto_solutions': []
        }

    # Seleciona solução de compromisso (menor soma dos objetivos normalizados)
    sol_comp = min(pareto_solutions, key=lambda s: sum(s['objectives']))

    # Calcula fitness como inverso da soma dos objetivos (para compatibilidade)
    total_cost = sum(sol_comp['objectives'])
    fitness = 1.0 / (1.0 + total_cost)

    return {
        'best_chromosome': sol_comp['chromosome'],
        'best_fitness': fitness,
        'best_diag': sol_comp['diagnostics'],
        'history': res['history'],
        'pareto_solutions': pareto_solutions  # NOVO: inclui todas as soluções de Pareto
    }

# ==========================================
# INTERFACE SIMPLIFICADA PARA API (SINGLE PATIENT)
# ==========================================

def otimizar_alocacao_paciente(paciente_data, upaes_disponiveis):
    """
    Wrapper para rodar o NSGA-II focado na alocação de um único paciente (entrando via API).
    Retorna a melhor opção E múltiplas alternativas do front de Pareto.
    """
    # Cria lista com único paciente
    pacientes = [paciente_data]

    # Executa NSGA-II com parâmetros otimizados para velocidade
    result = run_nsga2(
        pacientes,
        upaes_disponiveis,
        pop_size=50,
        generations=100,
        crossover_rate=0.9,
        mutation_rate=0.3
    )

    pareto_solutions = result['pareto_solutions']

    if not pareto_solutions:
        return {
            'sucesso': False,
            'mensagem': 'Nenhuma UPAE compatível encontrada para esta especialidade.'
        }

    # Ordena soluções por diferentes critérios
    sol_dist = min(pareto_solutions, key=lambda s: s['objectives'][0])  # Melhor em distância
    sol_wait = min(pareto_solutions, key=lambda s: s['objectives'][1])  # Melhor em espera

    candidatos = [
        s for s in pareto_solutions
        if s not in (sol_dist, sol_wait)
    ]

    # Solução de compromisso (menor soma dos objetivos)
    sol_comp = min(candidatos, key=lambda s: sum(s['objectives'])) if candidatos else sol_wait

    # Usa solução de compromisso como principal
    best_chromosome = sol_comp['chromosome']
    upae_id = best_chromosome[0]

    if upae_id == -1 or upae_id is None:
        return {
            'sucesso': False,
            'mensagem': 'Nenhuma UPAE compatível encontrada para esta especialidade.'
        }

    # Encontra o objeto UPAE correspondente
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
        'prob_noshow': round(p_noshow * 100, 1),
        'tempo_espera_dias': upae_alocada.get('tempo_espera_dias', 0),
        'tipo': 'compromisso',
        'objetivos': {
            'custo_distancia': round(sol_comp['objectives'][0], 2),
            'custo_espera': round(sol_comp['objectives'][1], 2)
        }
    }

    # ==== GERAR ALTERNATIVAS DO PARETO FRONT ====
    alternativas = []

    # Adiciona solução focada em distância (se diferente da principal)
    if sol_dist['chromosome'][0] != upae_id:
        upae_dist = next((u for u in upaes_disponiveis if u['id'] == sol_dist['chromosome'][0]), None)
        if upae_dist:
            p_ns_dist, d_dist = compute_p_noshow(paciente_data, upae_dist, base_ns)
            alternativas.append({
                'upae': upae_dist,
                'distancia_km': round(d_dist, 2),
                'prob_noshow': round(p_ns_dist * 100, 1),
                'tempo_espera_dias': upae_dist.get('tempo_espera_dias', 0),
                'tipo': 'minima_distancia',
                'objetivos': {
                    'custo_distancia': round(sol_dist['objectives'][0], 2),
                    'custo_espera': round(sol_dist['objectives'][1], 2)
                }
            })

    # Adiciona solução focada em espera (se diferente da principal)
    if sol_wait['chromosome'][0] != upae_id and sol_wait['chromosome'][0] != (sol_dist['chromosome'][0] if sol_dist else None):
        upae_wait = next((u for u in upaes_disponiveis if u['id'] == sol_wait['chromosome'][0]), None)
        if upae_wait:
            p_ns_wait, d_wait = compute_p_noshow(paciente_data, upae_wait, base_ns)
            alternativas.append({
                'upae': upae_wait,
                'distancia_km': round(d_wait, 2),
                'prob_noshow': round(p_ns_wait * 100, 1),
                'tempo_espera_dias': upae_wait.get('tempo_espera_dias', 0),
                'tipo': 'minima_espera',
                'objetivos': {
                    'custo_distancia': round(sol_wait['objectives'][0], 2),
                    'custo_espera': round(sol_wait['objectives'][1], 2)
                }
            })

    # Adiciona outras soluções de Pareto diversas (até 2 mais)
    outras_solucoes = [
        s for s in pareto_solutions
        if s['chromosome'][0] not in [upae_id, sol_dist['chromosome'][0], sol_wait['chromosome'][0]]
    ]

    for sol in outras_solucoes[:2]:
        upae_other = next((u for u in upaes_disponiveis if u['id'] == sol['chromosome'][0]), None)
        if upae_other:
            p_ns_other, d_other = compute_p_noshow(paciente_data, upae_other, base_ns)
            alternativas.append({
                'upae': upae_other,
                'distancia_km': round(d_other, 2),
                'prob_noshow': round(p_ns_other * 100, 1),
                'tempo_espera_dias': upae_other.get('tempo_espera_dias', 0),
                'tipo': 'pareto_alternativa',
                'objetivos': {
                    'custo_distancia': round(sol['objectives'][0], 2),
                    'custo_espera': round(sol['objectives'][1], 2)
                }
            })

    return {
        'sucesso': True,
        'melhor_opcao': melhor_opcao,
        'alternativas': alternativas,
        'diagnosticos': sol_comp['diagnostics'],
        'num_solucoes_pareto': len(pareto_solutions)
    }
