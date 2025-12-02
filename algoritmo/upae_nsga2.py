import random, math
from datetime import datetime, timedelta
from collections import defaultdict
import matplotlib.pyplot as plt


random.seed(42)



def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = math.radians(lat1); phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1); dl = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*(math.sin(dl/2)**2)
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def clamp(x, a=0.0, b=0.95):
    return max(a, min(b, x))

def generate_pe_data(n_patients=60, n_slots=80):
    CITIES = {
        'Recife':   {'coords': (-8.05428, -34.8813), 'demand_weight': 0.3},
        'Jaboatao': {'coords': (-8.1765, -35.0326),  'demand_weight': 0.4},
        'Cabo':     {'coords': (-8.2839, -35.0321),  'demand_weight': 0.15},
        'Igarassu': {'coords': (-7.8306, -34.9085),  'demand_weight': 0.15}
    }
    SPECIALTIES = ('cardio', 'endo', 'ortopedia')
    patients = []
    slots = []
    start_date = datetime.now() + timedelta(days=1)
    city_names = list(CITIES.keys())
    city_weights = [CITIES[c]['demand_weight'] for c in city_names]

    # Pacientes
    for i in range(n_patients):
        city = random.choices(city_names, weights=city_weights, k=1)[0]
        base_lat, base_lon = CITIES[city]['coords']
        lat = base_lat + random.uniform(-0.03, 0.03)
        lon = base_lon + random.uniform(-0.03, 0.03)
        patients.append({
            'id': i,
            'city_origin': city,
            'lat': lat,
            'lon': lon,
            'specialty': random.choice(SPECIALTIES)
        })

    # Vagas
    for s in range(n_slots):
        city = random.choice(city_names)
        base_lat, base_lon = CITIES[city]['coords']
        lat = base_lat + random.uniform(-0.02, 0.02)
        lon = base_lon + random.uniform(-0.02, 0.02)
        if city in ['Recife', 'Jaboatao']:
            transport_score = random.uniform(0.7, 1.0)
        else:
            transport_score = random.uniform(0.2, 0.6)
        slots.append({
            'slot_id': s,
            'city_unit': city,
            'lat': lat,
            'lon': lon,
            'specialty': random.choice(SPECIALTIES),
            'date': start_date + timedelta(days=random.randint(0, 30)),
            'transport_score': transport_score
        })

    base_no_show_by_specialty = {
        'cardio': 0.05,
        'endo': 0.40,
        'ortopedia': 0.25
    }
    return patients, slots, base_no_show_by_specialty



DIST_REF = 30.0      # distância de referência (km)
WREF     = 30.0      #  espera (dias)

LAMBDA_D = 0.02      # sensibilidade da prob. de falta à distância
LAMBDA_T = 0.5       # sensibilidade da prob. de falta ao transporte

# Soft constraint no-show
TH_NS    = 0.7       # limite aceitável de no-show médio entre ATENDIDOS (70%)
PEN_NS   = 10.0       # penalidade multiplicada pela violação do limite

# Penalização por paciente sem vaga
W_UNALLOC = 2.0



def compute_p_noshow(patient, slot, base_no_show):
    dist = haversine(patient['lat'], patient['lon'], slot['lat'], slot['lon'])
    transport_score = slot.get('transport_score', 0.5)
    p = base_no_show * (1 + LAMBDA_D * (dist / DIST_REF)) * (1 - LAMBDA_T * transport_score)
    return clamp(p, 0.0, 0.95), dist



def is_feasible(chromosome, patients, slots):
    """
    Restrição dura:
    - Proibido: dois pacientes na mesma vaga
    - Proibido: especialidade incompatível paciente-slot
    - Permitido: paciente sem vaga (slot = -1 ou None)
    """
    slot_map = {s['slot_id']: s for s in slots}
    used_slots = set()

    for i, sid in enumerate(chromosome):
        if sid in (-1, None):
            continue

        slot = slot_map.get(sid)
        if slot is None:
            return False

        if slot['specialty'] != patients[i]['specialty']:
            return False

        if sid in used_slots:
            return False

        used_slots.add(sid)

    return True

def init_feasible_population(pop_size, patients, slots):
    """
    Gera população inicial VIÁVEL:
    - Sem conflito de vaga
    - Especialidade compatível
    - Pacientes sem vaga quando não há slot disponível na especialidade
    """
    slots_by_spec = defaultdict(list)
    for s in slots:
        slots_by_spec[s['specialty']].append(s['slot_id'])

    population = []
    n_patients = len(patients)

    for _ in range(pop_size):
        chrom = [-1] * n_patients
        free_slots_by_spec = {
            spec: slots_by_spec[spec].copy()
            for spec in slots_by_spec
        }
        idxs = list(range(n_patients))
        random.shuffle(idxs)

        for i in idxs:
            pat = patients[i]
            spec = pat['specialty']
            free = free_slots_by_spec.get(spec, [])
            if not free:
                chrom[i] = -1
            else:
                sid = random.choice(free)
                chrom[i] = sid
                free.remove(sid)

        # só por segurança:
        if not is_feasible(chrom, patients, slots):
            # em teoria não deveria acontecer, mas se acontecer, marca sem vaga
            chrom = [-1 if not is_feasible([sid], [patients[i]], slots) else sid
                     for i, sid in enumerate(chrom)]
        population.append(chrom)

    return population



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

def mutation(chromosome, patients, slots, mutation_rate=0.3):
    if random.random() >= mutation_rate:
        return chromosome
    n = len(chromosome)
    op = random.random()
    if op < 0.4:
        # swap
        i, j = random.sample(range(n), 2)
        chromosome[i], chromosome[j] = chromosome[j], chromosome[i]
    elif op < 0.8:
        # reatribui um paciente para outro slot compatível ou sem vaga
        i = random.randrange(n)
        spec = patients[i]['specialty']
        compat_slots = [s['slot_id'] for s in slots if s['specialty'] == spec]
        if compat_slots:
            chromosome[i] = random.choice(compat_slots + [-1])
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

def repair_chromosome(chromosome, patients, slots):
    """
    Reparo leve: corrige alguns conflitos usando proximidade.
    Depois ainda passamos por is_feasible; o que sobrar inválido é descartado.
    """
    slot_map = {s['slot_id']: s for s in slots}
    rev = defaultdict(list)
    for i, sid in enumerate(chromosome):
        if sid in (-1, None):
            continue
        rev[sid].append(i)

    free_slots = set(s['slot_id'] for s in slots)

    # remover slots inexistentes
    for sid, lst in list(rev.items()):
        if sid not in slot_map:
            for i in lst:
                chromosome[i] = -1
            rev.pop(sid, None)

    # tratar conflitos
    for sid, lst in rev.items():
        slot = slot_map[sid]
        valid = [i for i in lst if patients[i]['specialty'] == slot['specialty']]
        invalid = [i for i in lst if patients[i]['specialty'] != slot['specialty']]
        for i in invalid:
            chromosome[i] = -1
        if not valid:
            continue
        dists = [
            (i, haversine(patients[i]['lat'], patients[i]['lon'],
                          slot['lat'], slot['lon']))
            for i in valid
        ]
        dists.sort(key=lambda x: x[1])
        for i, _ in dists[1:]:
            chromosome[i] = -1
        free_slots.discard(sid)

    # realocar alguns sem vaga para slots livres compatíveis
    free_slot_list = list(free_slots)
    for i, sid in enumerate(chromosome):
        if sid not in (-1, None):
            continue
        compat = [
            s for s in slots
            if s['specialty'] == patients[i]['specialty'] and s['slot_id'] in free_slot_list
        ]
        if not compat:
            chromosome[i] = -1
            continue
        best = min(
            compat,
            key=lambda s: haversine(patients[i]['lat'], patients[i]['lon'], s['lat'], s['lon'])
        )
        chromosome[i] = best['slot_id']
        free_slot_list.remove(best['slot_id'])

    return chromosome



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



def evaluate_objectives(chromosome, patients, slots, base_no_show_by_specialty):
    """
    Objetivos (MINIMIZAR), sem dividir por N:

    1) adj_trav : soma da distância relativa + penalizações
    2) adj_wait : soma da espera relativa + penalizações

    Penalizações:
      - W_UNALLOC * num_unallocated
      - Soft constraint: no-show médio > TH_NS
        (ExpNoShowSum > TH_NS * assigned_count)

    Conflitos e especialidade incompatível:
      - tratados como RESTRIÇÃO DURA por is_feasible
    """

    now = datetime.now()
    slot_map = {s['slot_id']: s for s in slots}

    TravelCost = 0.0
    WaitCost   = 0.0
    NoShowSum  = 0.0   # <- AGORA É SÓ SOMA DE PROBABILIDADES
    num_unallocated = 0
    assigned_count  = 0

    for i, slot_id in enumerate(chromosome):
        pat = patients[i]

        # paciente sem vaga (permitido, mas penalizado)
        if slot_id in (-1, None):
            num_unallocated += 1
            continue

        slot = slot_map.get(slot_id)
        if slot is None:
            num_unallocated += 1
            continue

        # distância relativa
        dist = haversine(pat['lat'], pat['lon'], slot['lat'], slot['lon'])
        TravelCost += (dist / DIST_REF)

        # espera relativa
        days_wait = max(0, (slot['date'] - now).days)
        WaitCost += (days_wait / WREF)

        # no-show (somente para teste do limite)
        base = base_no_show_by_specialty.get(pat['specialty'], 0.3)
        p_ns, _ = compute_p_noshow(pat, slot, base)
        NoShowSum += p_ns

        assigned_count += 1

    # Penalização por pacientes sem vaga
    penalty_unalloc = W_UNALLOC * num_unallocated

    # Soft constraint de no-show
    if assigned_count > 0 and NoShowSum > TH_NS * assigned_count:
        viol = NoShowSum - TH_NS * assigned_count
        penalty_ns = PEN_NS * viol
    else:
        penalty_ns = 0.0

    adj_trav = TravelCost 
    adj_wait = WaitCost + penalty_unalloc + penalty_ns

    return (adj_trav, adj_wait)




def diagnostics_for_solution(chromosome, patients, slots, base_no_show_by_specialty):
    now = datetime.now()
    slot_map = {s['slot_id']: s for s in slots}

    total_dist = 0.0
    total_wait = 0.0
    ExpNoShowCost = 0.0
    num_unallocated = 0
    assigned_count = 0

    for i, sid in enumerate(chromosome):
        pat = patients[i]
        if sid in (-1, None):
            num_unallocated += 1
            continue

        slot = slot_map.get(sid)
        if slot is None:
            num_unallocated += 1
            continue

        dist = haversine(pat['lat'], pat['lon'], slot['lat'], slot['lon'])
        total_dist += dist

        days_wait = max(0, (slot['date'] - now).days)
        total_wait += days_wait

        base = base_no_show_by_specialty.get(pat['specialty'], 0.3)
        p_ns, _ = compute_p_noshow(pat, slot, base)
        ExpNoShowCost += p_ns

        assigned_count += 1

    # evita divisão por zero
    if assigned_count > 0:
        mean_dist = total_dist / assigned_count
        mean_wait = total_wait / assigned_count
    else:
        mean_dist = 0.0
        mean_wait = 0.0
        
    return {
        'distancia_media_km': mean_dist,
        'espera_media_dias': mean_wait,
        'faltas_esperadas': ExpNoShowCost,
        'pacientes_atendidos': assigned_count,
        'pacientes_sem_vaga': num_unallocated,
        'total_pacientes': len(patients)
    }




def run_nsga2(patients, slots, base_ns,
              pop_size=120, generations=200,
              crossover_rate=0.9, mutation_rate=0.3):

    population = init_feasible_population(pop_size, patients, slots)
    history = []

    for gen in range(generations):
        objectives_list = [
            evaluate_objectives(ch, patients, slots, base_ns)
            for ch in population
        ]

        fronts = fast_nondominated_sort(population, objectives_list)

        crowding = {}
        for front in fronts:
            cd = crowding_distance(front, objectives_list)
            crowding.update(cd)

        # média dos objetivos da frente 1 (para plot)
        front0 = fronts[0]
        f0_vals = [objectives_list[i] for i in front0]
        mean_front0 = tuple(
            sum(v[j] for v in f0_vals) / len(f0_vals)
            for j in range(len(f0_vals[0]))
        )
        history.append((gen, mean_front0))

        # gerar filhos viáveis
        offspring = []
        max_attempts = 5 * pop_size
        attempts = 0

        while len(offspring) < pop_size and attempts < max_attempts:
            attempts += 1
            p1 = mo_tournament_selection(population, fronts, crowding, k=2)
            p2 = mo_tournament_selection(population, fronts, crowding, k=2)
            c1, c2 = uniform_crossover(p1, p2, crossover_rate)
            c1 = mutation(c1, patients, slots, mutation_rate)
            c2 = mutation(c2, patients, slots, mutation_rate)
            c1 = repair_chromosome(c1, patients, slots)
            c2 = repair_chromosome(c2, patients, slots)
            if is_feasible(c1, patients, slots):
                offspring.append(c1)
            if len(offspring) < pop_size and is_feasible(c2, patients, slots):
                offspring.append(c2)

        while len(offspring) < pop_size:
            offspring.append(random.choice(population).copy())

        combined = population + offspring
        combined_objs = [
            evaluate_objectives(ch, patients, slots, base_ns)
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

    final_objs = [
        evaluate_objectives(ch, patients, slots, base_ns)
        for ch in population
    ]
    final_fronts = fast_nondominated_sort(population, final_objs)
    pareto_indices = final_fronts[0]

    pareto_solutions = []
    for idx in pareto_indices:
        chrom = population[idx]
        objs = final_objs[idx]
        diag = diagnostics_for_solution(chrom, patients, slots, base_ns)
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

def imprimir_solucao(nome, sol):
    objs = sol['objectives']
    diag = sol['diagnostics']

    print(f"\n=== {nome} ===")
    print(f"  Objetivos:")
    print(f"    Distância relativa: {objs[0]:.2f}")
    print(f"    Espera relativa: {objs[1]:.2f}")

    print("  Diagnósticos:")
    for k, v in diag.items():
        print(f"    {k}: {v:.2f}" if isinstance(v, float) else f"    {k}: {v}")


if __name__ == "__main__":
    patients, slots, base_ns = generate_pe_data(n_patients=60, n_slots=80)

    res = run_nsga2(
        patients, slots, base_ns,
        pop_size=120,
        generations=200,
        crossover_rate=0.9,
        mutation_rate=0.3
    )

    pareto_solutions = res['pareto_solutions']
    
    sol_dist   = min(pareto_solutions, key=lambda s: s['objectives'][0])
    sol_espera = min(pareto_solutions, key=lambda s: s['objectives'][1])
    
    candidatos = [
        s for s in pareto_solutions
        if s not in (sol_dist, sol_espera)
    ]

    sol_comp = min(candidatos,key=lambda s: sum(s['objectives'])) if candidatos else sol_espera

    imprimir_solucao("Solução Mínima Distância", sol_dist)
    imprimir_solucao("Solução Mínima Espera", sol_espera)
    imprimir_solucao("Solução Compromissada", sol_comp)

    # Plot simples da evolução da média da frente 1
    gens = [g for g, _ in res['history']]
    mean_trav = [m[0] for _, m in res['history']]
    mean_wait = [m[1] for _, m in res['history']]

    plt.figure(figsize=(9,4))
    plt.plot(gens, mean_trav, label="Distância total (média frente 1)")
    plt.plot(gens, mean_wait, label="Espera total (média frente 1)")
    plt.xlabel("Geração")
    plt.ylabel("Custo (não normalizado)")
    plt.title("Evolução da frente de Pareto (médias)")
    plt.grid(True)
    plt.legend()
    plt.tight_layout()
    plt.show()
