import random
import numpy as np
import pandas as pd

# GA 하이퍼파라미터
POPULATION_SIZE = 40
GENERATIONS = 30
TOURNAMENT_K = 3
CROSSOVER_RATE = 0.7
MUTATION_RATE = 0.15

# 파라미터 범위
ENTRY_MIN, ENTRY_MAX = 15, 60
EXIT_MIN, EXIT_MAX = 5, 25


def _random_chromosome() -> list[int]:
    entry = random.randint(ENTRY_MIN, ENTRY_MAX)
    exit_ = random.randint(EXIT_MIN, min(EXIT_MAX, entry - 1))
    return [entry, exit_]


def _ensure_valid(chrom: list[int]) -> list[int]:
    chrom[0] = max(ENTRY_MIN, min(ENTRY_MAX, chrom[0]))
    chrom[1] = max(EXIT_MIN, min(EXIT_MAX, chrom[1]))
    if chrom[1] >= chrom[0]:
        chrom[1] = chrom[0] - 1
    if chrom[1] < EXIT_MIN:
        chrom[0] = chrom[1] + 1
    return chrom


def _tournament_select(pop: list, fitnesses: list[float]) -> list[int]:
    indices = random.sample(range(len(pop)), TOURNAMENT_K)
    best = max(indices, key=lambda i: fitnesses[i])
    return list(pop[best])


def _crossover(p1: list[int], p2: list[int]) -> tuple[list[int], list[int]]:
    if random.random() > CROSSOVER_RATE:
        return list(p1), list(p2)
    # 균일 교차
    c1, c2 = list(p1), list(p2)
    for i in range(len(p1)):
        if random.random() < 0.5:
            c1[i], c2[i] = c2[i], c1[i]
    return c1, c2


def _mutate(chrom: list[int]) -> list[int]:
    c = list(chrom)
    if random.random() < MUTATION_RATE:
        c[0] += random.randint(-3, 3)
    if random.random() < MUTATION_RATE:
        c[1] += random.randint(-2, 2)
    return _ensure_valid(c)


def run_ga(df: pd.DataFrame, backtest_fn, initial_capital: float,
           risk_pct: float) -> dict:
    """
    유전 알고리즘으로 최적 entry_period, exit_period 탐색.
    backtest_fn(df, entry_period, exit_period, initial_capital, risk_pct) -> dict
    적합도: Calmar ratio (CAGR / MDD)
    """
    pop = [_random_chromosome() for _ in range(POPULATION_SIZE)]

    best_chrom = pop[0]
    best_fitness = -float("inf")
    best_metrics = {}

    def evaluate(chrom: list[int]) -> tuple[float, dict]:
        result = backtest_fn(df, chrom[0], chrom[1],
                             initial_capital, risk_pct)
        metrics = result.get("metrics", {})
        calmar = metrics.get("calmar", 0.0)
        # 거래가 없으면 패널티
        if metrics.get("num_trades", 0) == 0:
            calmar = -999
        return calmar, metrics

    for gen in range(GENERATIONS):
        fitnesses = []
        gen_metrics = []
        for chrom in pop:
            fit, met = evaluate(chrom)
            fitnesses.append(fit)
            gen_metrics.append(met)
            if fit > best_fitness:
                best_fitness = fit
                best_chrom = list(chrom)
                best_metrics = met

        # 엘리트 보존 (상위 2개)
        sorted_indices = sorted(range(len(pop)),
                                key=lambda i: fitnesses[i], reverse=True)
        new_pop = [list(pop[sorted_indices[0]]),
                   list(pop[sorted_indices[1]])]

        while len(new_pop) < POPULATION_SIZE:
            p1 = _tournament_select(pop, fitnesses)
            p2 = _tournament_select(pop, fitnesses)
            c1, c2 = _crossover(p1, p2)
            new_pop.append(_mutate(c1))
            if len(new_pop) < POPULATION_SIZE:
                new_pop.append(_mutate(c2))

        pop = new_pop

    return {
        "entry_period": best_chrom[0],
        "exit_period": best_chrom[1],
        "calmar": round(best_fitness, 4),
        "metrics": best_metrics,
    }
