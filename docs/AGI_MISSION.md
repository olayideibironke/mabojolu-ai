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
  multi-step experiment lookahead, and posterior-aware multi-step goal planning.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: uncertainty-aware causal world-model transfer

Mabojolu G can now maintain probabilistic competing causal mechanisms under
noisy observations instead of eliminating hypotheses deterministically after
each experiment.

Each bounded mechanism specifies a causal effect map over unfamiliar variables
and an observation-noise scale. Experiments produce noisy measurements of the
effect predicted by a mechanism. Mabojolu updates its belief with Gaussian
likelihoods, so mechanisms that become unlikely retain nonzero posterior mass
rather than disappearing after one imperfect observation.

The world-model experiment planner supports bounded lookahead. Candidate
experiment sequences are evaluated by expected terminal belief entropy under the
current posterior, with explicit experiment cost penalties, reversibility
requirements, and hard risk ceilings.

The controlled v1.11 experiment benchmark is deliberately arranged so a
one-step information planner prefers an expensive direct probe, while a
two-step planner discovers that two cheaper complementary interventions provide
essentially complete identification at lower total cost.

The deterministic benchmark values are:

- one-step direct probe cost: 0.50;
- two-step complementary probe cost: 0.10;
- two-step experiment maximum risk: 0.10;
- hard experiment risk ceiling: 0.30.

The observations delivered during execution are perturbed away from the exact
mechanism means. Posterior updating therefore exercises the noisy likelihood
path. The correct mechanism becomes dominant without assigning exact zero
probability to alternatives.

The mechanism belief is then used for multi-step planning. Candidate actions are
evaluated under every mechanism still represented in the posterior. A plan is
accepted only when the posterior-weighted probability of reaching the goal
meets a configured success threshold.

The current planning benchmark begins from a state where no safe single action
can reach the goal with sufficient probability. Horizon-one planning therefore
abstains. Horizon-two planning finds a two-action sequence that reaches the goal
across the posterior mechanism belief while remaining below the action-risk
ceiling.

This milestone moves Mabojolu from deterministic correspondence resolution
toward uncertainty-aware causal world modeling and planning, but it remains a
bounded experimental scaffold. The mechanism catalog, causal effect maps,
Gaussian noise family, observation variance, intervention catalog, action
catalog, planning horizon, cost penalty, risk estimates, and state abstraction
remain human-specified.

The current experiment planner uses open-loop sequence evaluation rather than a
fully contingent policy tree, and the mechanism transition model is linear and
additive. Learning new mechanisms, nonlinear dynamics, hidden state, and
closed-loop replanning remain open.

### Next experiments

The next experiments should measure:

1. contingent multi-step experiment policies that choose the second experiment
   based on the first noisy observation rather than committing to an open-loop
   sequence;
2. online learning of mechanism parameters and observation variance instead of
   selecting only among fixed mechanism models;
3. bounded proposal of new mechanism structures when every current model has low
   posterior predictive likelihood;
4. nonlinear and interaction effects between causal variables;
5. hidden-state inference and delayed causal effects;
6. posterior predictive calibration under repeated noisy observations;
7. receding-horizon action planning that replans after each observed state
   transition;
8. joint value-of-information and goal-progress planning, where Mabojolu chooses
   when to experiment versus when to act;
9. transfer of learned mechanism fragments across differently named domains;
10. whether increased world-model autonomy preserves hard risk ceilings,
    abstention, rollback, auditability, and zero unsafe irreversible execution.

The next central milestone is adaptive mechanism discovery and contingent
scientific planning: Mabojolu should learn causal parameters online, detect when
its current mechanism family is inadequate, propose bounded challengers, choose
experiments conditionally on observed outcomes, and replan actions as its world
model changes.

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
