# Mabojolu G: General Intelligence Research Mission

## Mission

Mabojolu G is being developed toward a generally capable autonomous
intelligence that can learn, reason, adapt, and perform competently across a
very broad range of intellectual domains, including unfamiliar tasks for which
it was not specifically programmed, while transferring knowledge and improving
through experience.

The target progression is:

Mabojolu today → general agent → human-level general intelligence →
increasingly superhuman general intelligence.

This document is a research direction, not a claim that Mabojolu has already
reached AGI.

## Evidence rule

Mabojolu must earn stronger capability claims through controlled evidence.

Do not label Mabojolu AGI merely because it can:

- call tools;
- use a strong language model;
- store persistent state;
- produce self-reflection text;
- route between specialist models;
- complete one scripted benchmark.

A capability should be treated as established only when it survives tests that
separate genuine generalization from memorization, hard-coded task structure,
prompt leakage, or environment-specific shortcuts.

## Architectural principle

Foundation models are replaceable components, not the whole mind.

Mabojolu's distinctive intelligence should increasingly live in its cognitive
architecture:

- persistent episodic and semantic learning;
- causal world models;
- hypothesis generation and falsification;
- autonomous experiment design;
- hierarchical goals and subgoal generation;
- model-based planning;
- structural and relational transfer;
- uncertainty-aware self-correction;
- skill formation and reuse;
- memory consolidation;
- continual learning from experience;
- tool control with safety and audit boundaries;
- evaluation against unfamiliar tasks.

Compute independence supports this mission by keeping model access cheap,
replaceable, and under Mabojolu's control. It is infrastructure, not evidence of
general intelligence by itself.

## Core capability targets

1. Novel-task learning
2. Cross-domain transfer
3. Persistent memory
4. World modeling
5. Autonomous long-horizon planning
6. Metacognition, uncertainty, and self-correction
7. Continual learning from experience
8. Goal reasoning across subgoals, constraints, and competing priorities

## Cognitive loop

OBSERVE
→ UNDERSTAND CURRENT STATE
→ RECALL RELEVANT EXPERIENCE
→ FORM OR UPDATE WORLD MODEL
→ GENERATE HYPOTHESES
→ CHOOSE GOAL
→ DECOMPOSE / PLAN
→ ACT OR EXPERIMENT
→ OBSERVE RESULT
→ VERIFY
→ LEARN
→ CONSOLIDATE MEMORY / SKILLS / WORLD MODEL
→ CONTINUE

## Current controlled capabilities

The current Mabojolu G research branch contains controlled demonstrations of:

- explicit cognitive state;
- cross-episode memory;
- causal world-model learning;
- causal generalization across held-out state combinations;
- world-model-guided planning;
- structural transfer with renamed symbols;
- information-gain experiment selection;
- autonomous causal hypothesis generation;
- multi-step scientific discovery;
- hierarchical goal reasoning;
- backward causal goal decomposition;
- autonomous reusable skill formation from repeated successful experience;
- skill revision and retirement under contradictory evidence;
- structural skill transfer under renamed actions and state variables;
- composition of separately learned skills into novel multi-skill solutions;
- evidence-based competence modeling;
- autonomous curriculum selection from a safe challenge catalog with measured
  held-out improvement;
- autonomous synthetic challenge generation with behaviorally adaptive
  difficulty and isolated held-out evaluation;
- multi-family autonomous practice across distinct Boolean-gating and numeric
  threshold causal structures with explicit negative-transfer boundaries;
- controlled cross-family induction of a symbol-independent higher-order
  policy principle with measured improvement in a third unfamiliar family;
- competing higher-order abstractions with per-episode contextual selection and
  measured improvement in a fourth unfamiliar family;
- learned principle applicability from cross-episode application outcomes with
  explicit priors and principle-specific utility feedback;
- induced symbol-independent structural context signatures that transfer
  applicability across renamed actions and state variables;
- learned structural context feature relevance and compression that ignores
  evidenced nuisance dimensions beyond exact full-feature matching;
- autonomous pairwise structural feature composition when no supplied atomic
  dimension explains principle usefulness;
- autonomous relational context synthesis that extrapolates learned equality or
  ordering structure to value combinations withheld during calibration;
- complexity-regularized symbolic predicate search with explicit simplicity
  bias, contradictory-evidence testing, and transfer beyond basic relations;
- one-shot held-out predicate validation that freezes fitted programs, rejects
  failed holdouts, and keeps validation evidence out of applicability training;
- local-first and browser-owned inference routing;
- posterior-confidence drift detection for validated symbolic champions;
- sequential likelihood-ratio change-point evidence that resets after recovered
  stable performance instead of treating isolated errors as regime changes;
- bounded challenger search per regime with progressively larger fresh validation
  reserves on repeated attempts;
- bounded cross-episode meta-adaptation that selects among explicit adaptation
  policies using family-specific evidence, cross-family transfer, and policy
  quarantine after unsafe irreversible outcomes;
- controlled counterfactual benchmarking of meta-adaptive policy selection
  against a fixed balanced baseline and a per-episode bounded-policy oracle,
  including cumulative regret and held-out regime-sequence evaluation;
- uncertainty-aware environment-family induction from observable drift signals
  without supplying the true family label at policy-selection time, including
  calibrated abstention and fail-closed uncertainty fallbacks;
- bounded online latent-regime discovery that creates unnamed environment
  clusters from experience, learns policy evidence separately inside each
  cluster, recognizes recurring regimes, and abstains on ambiguous membership;
- adaptive latent-regime structure revision that splits behaviorally overloaded
  regimes, merges redundant regimes only when policy profiles agree, and learns
  outcome-linked feature relevance while preserving fresh-evidence and
  fail-closed safety rules;
- bounded self-calibration across alternative observation representations and
  structural thresholds, using protected validation, champion/challenger
  promotion, unsafe-profile quarantine, and explicit rollback on regression;
- outcome-grounded synthesis of new bounded representation primitives from
  abstract structural roles, with explicit complexity penalties, protected
  validation, cross-domain transfer under renamed variables, reusable-primitive
  promotion, negative-transfer retirement, and unsafe-primitive quarantine;
- autonomous structural role induction that searches target variable sets from
  protected outcome evidence, groups mathematically equivalent role
  permutations, abstains on ambiguous correspondences, and composes
  independently synthesized primitives when no single primitive is sufficient;
- active causal correspondence learning that chooses reversible low-risk
  interventions by expected information gain, updates uncertainty from measured
  causal effects rather than target counterfactual utility tables, blocks unsafe
  experiments, and uses resolved correspondences for transferred goal-directed
  planning;
- uncertainty-aware causal world-model transfer with Gaussian likelihood
  updates, persistent posterior mass over competing mechanisms, bounded
  multi-step experiment lookahead, and posterior-aware multi-step goal planning;
- adaptive mechanism discovery with online effect estimation, predictive-misfit
  detection, bounded challenger proposal, protected challenger promotion,
  contingent experiment branching, and receding-horizon action replanning;
- bounded mechanism-structure synthesis that can add linear, pairwise
  interaction, or latent-bias terms when coefficient adjustment is
  insufficient, with protected structural validation and dual-control selection
  between information gathering and goal-directed action;
- hierarchical causal-program synthesis that composes separately validated
  mechanism fragments under protected holdout evaluation, plus depth-limited
  mixed experiment/action policy trees whose branches select different
  multi-action programs after informative causal probes.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: hierarchical causal program synthesis and long-horizon dual control

Mabojolu G can now compose multiple separately validated causal fragments into a
deeper causal program when no single reusable fragment explains the target
environment adequately.

A causal fragment contains one or more previously validated structural terms,
its source validation error, and its source evidence count. Hierarchical
composition refuses fragments above a validation-error ceiling before target
program search begins.

The v1.14 program synthesizer searches bounded combinations of eligible
fragments. Every candidate retains the incumbent base causal effects and adds a
small hierarchy of validated fragments. Candidate ranking uses target discovery
prediction error plus an explicit per-term complexity penalty.

The controlled hierarchy benchmark begins with two independently validated
interaction fragments:

- interaction(x,y), coefficient 0.40;
- interaction(y,z), coefficient 0.30.

The target environment requires both interactions. Either fragment alone leaves
systematic residual error. Their two-fragment composition exactly explains the
discovery evidence.

Discovery fit is not enough for promotion. The candidate programs are evaluated
again on a disjoint protected reserve containing x-only, y-only, z-only,
partial-joint, and full-joint interventions. The composed program reaches zero
protected prediction error and beats the best single-fragment baseline after the
protected complexity penalty.

The resulting program has depth three:

base causal program
-> validated xy interaction fragment
-> validated yz interaction fragment

This is hierarchical reuse of already validated causal structure rather than a
fresh unbounded search over arbitrary code.

v1.14 also extends dual control from one-step experiment-versus-action choice to
a bounded long-horizon mixed policy tree.

The controlled planning benchmark starts with equal belief over two mechanisms,
slow and fast. Each mechanism requires a different two-action program to reach
the same goal within the available horizon:

slow:
slow-a -> slow-b

fast:
fast-a -> fast-b

Without information gathering, the unresolved belief makes every action produce
only moderate expected progress. Even three action slots cannot reach the goal.

A cheap reversible probe separates the two mechanisms. With horizon three,
Mabojolu therefore chooses:

probe-z
-> if slow: slow-a -> slow-b
-> if fast: fast-a -> fast-b

The mixed policy reaches the goal with expected success probability 1.0, expected
cost 0.13, and maximum risk 0.10.

The action-only control receives the same depth budget but no experiments. Its
goal-success probability remains zero. This isolates the value of information
inside a longer-horizon plan rather than rewarding extra action steps alone.

Unsafe zero-cost experiments and unsafe zero-cost actions are present in the
candidate catalogs but are excluded by the same hard risk and reversibility
constraints used by earlier milestones.

This remains bounded hierarchical program synthesis and bounded lookahead. The
fragment library, fragment validation threshold, maximum fragment count,
composition grammar, planning horizon, representative observation branches,
action and experiment catalogs, scalar goal state, additive mechanism effects,
cost weights, and risk ceilings remain human-specified.

### Next experiments

The next experiments should measure:

1. hierarchical programs with three or more reusable fragments and explicit
   depth/description-length regularization;
2. nonlinear reusable fragments such as thresholds, saturation, and piecewise
   causal responses;
3. hidden-state fragments that persist across time rather than static
   observation-only terms;
4. Bayesian uncertainty over alternative hierarchical causal programs instead
   of selecting one deterministic champion;
5. automatic rollback and fragment blame assignment when a composed program
   regresses on later protected evidence;
6. long-horizon policy trees with noisy observation integration instead of one
   representative branch per mechanism;
7. mixed plans where actions themselves generate information and update the
   causal posterior;
8. explicit subgoal generation so long plans can create and revise intermediate
   goals rather than optimizing one scalar terminal threshold;
9. transfer of hierarchical causal programs and long-horizon policies across
   differently named domains;
10. whether deeper composition and planning preserve hard risk ceilings,
    abstention, protected validation, rollback, auditability, and zero unsafe
    irreversible execution.

The next central milestone is uncertainty-aware hierarchical programs and
autonomous subgoal formation: Mabojolu should maintain competing causal-program
hypotheses, identify which fragment caused a prediction failure, generate
intermediate goals during long-horizon planning, and revise both its program and
plan as evidence accumulates.

## Safety and audit principle

As Mabojolu becomes more autonomous:

- external and irreversible actions remain capability-scoped;
- destructive or high-impact actions require appropriate approval gates;
- learned changes remain auditable;
- evaluation and rollback remain available;
- hidden chain-of-thought is not persisted as memory;
- observations, evidence, hypotheses, outcomes, and concise learned state may be
  persisted when appropriate.

The objective is increasingly general autonomous intelligence with measurable
learning, not uncontrolled self-modification.
