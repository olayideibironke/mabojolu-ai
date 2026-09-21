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
  planning.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: active causal correspondence learning

Mabojolu G can now resolve an unfamiliar structural correspondence by choosing
its own bounded causal experiments instead of receiving a target role binding or
a complete target counterfactual policy-utility table.

The v1.10 learner begins with a bounded hypothesis set over which unfamiliar
target variables might instantiate the abstract roles of a transferred
representation primitive. In the controlled benchmark, five target variables
produce ten competing three-variable correspondence hypotheses.

Each candidate experiment specifies:

- the target variables to perturb;
- intervention magnitude;
- estimated risk;
- cost;
- reversibility.

For every active correspondence hypothesis, Mabojolu predicts the representation
effect that an experiment would produce. It groups hypotheses by predicted
effect and computes expected entropy reduction. Experiment choice maximizes
information gain minus a bounded cost penalty while enforcing a hard experiment
risk ceiling and reversibility requirement.

Unsafe or irreversible experiments are blocked before scoring can turn them into
actions. The benchmark includes an unsafe intervention that is among the most
informative experiments available, so safety constraints are exercised rather
than remaining inert.

After each safe intervention, Mabojolu receives only the measured causal effect.
Hypotheses inconsistent with that effect are removed and the remaining belief is
renormalized. A mapping is resolved only when both posterior confidence and the
margin over the runner-up exceed explicit thresholds. If no safe informative
experiment remains, Mabojolu abstains.

The controlled active benchmark compares this experiment-selection loop against
a fixed passive sequence of safe single-variable probes. The active learner
resolves the hidden three-variable correspondence in three interventions while
the passive sequence requires four. In the current deterministic benchmark, the
active experiment cost is 0.18 versus 0.86 for the passive baseline, and the
maximum executed experiment risk is 0.20 under a 0.30 safety ceiling.

The learned correspondence is then used outside correspondence identification.
A transferred representation primitive and its learned target mapping are passed
to a bounded planner. The planner evaluates reversible target actions and selects
the cheapest safe action predicted to move the transferred representation beyond
its goal threshold.

The planning benchmark includes a cheaper nuisance-variable action that does not
affect the true transferred representation. A cost-only baseline therefore fails
the goal, while the correspondence-aware planner rejects the irrelevant action
and selects a more expensive but genuinely goal-reaching intervention.

This is a stronger move from passive transfer toward autonomous scientific
interaction, but it remains a controlled scaffold. The hypothesis class,
experiment catalog, effect model, risk estimates, primitive arity, deterministic
observation model, intervention magnitudes, planning action catalog, and safety
thresholds remain human-specified. The current simulator also provides noiseless
causal effects, so robust inference under stochastic and partially observed
environments remains open.

### Next experiments

The next experiments should measure:

1. Bayesian or likelihood-based correspondence updates under noisy causal
   observations instead of deterministic hypothesis elimination;
2. autonomous generation of candidate interventions rather than selection from a
   fixed experiment catalog;
3. learned experiment-risk models calibrated from outcomes while retaining hard
   external action limits;
4. multi-step experiment planning where the best first intervention is chosen
   for downstream information value rather than one-step entropy reduction;
5. partially observed environments where causal correspondence must be inferred
   from delayed or confounded effects;
6. integration of active correspondence learning with the existing causal world
   model so hypotheses concern mechanisms, not only variable membership;
7. transferred planning over multi-step state transitions and subgoals using
   newly inferred causal correspondences;
8. active falsification of previously learned reusable representation primitives
   when they fail in a new domain;
9. cross-domain experiment reuse so successful intervention strategies become
   transferable scientific skills;
10. whether greater experimental autonomy preserves hard safety ceilings,
    abstention, rollback, auditability, and zero unsafe irreversible execution.

The next central milestone is uncertainty-aware causal world-model transfer:
Mabojolu should maintain probabilistic competing mechanism models under noisy
observations, design safe multi-step experiments to discriminate them, and use
the learned causal structure for multi-step planning in an unfamiliar domain.

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
