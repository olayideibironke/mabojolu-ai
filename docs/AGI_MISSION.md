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
  contingent experiment branching, and receding-horizon action replanning.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: adaptive mechanism discovery and contingent scientific planning

Mabojolu G can now revise parts of its causal mechanism family when observed
intervention effects are inconsistent with every incumbent model.

The v1.12 mechanism learner adds bounded online parameter estimation for
single-variable interventions. Repeated noisy measurements update an effect mean
and sample variance incrementally. This provides a direct learned parameter
estimate rather than requiring every causal coefficient to be supplied in
advance.

A separate predictive-adequacy test evaluates the incumbent mechanism family
against new observations. If the best incumbent predictive likelihood falls
below a configured threshold, Mabojolu marks the current model family
inadequate.

Model inadequacy does not trigger unrestricted model creation. The challenger
generator is bounded to the discrepant intervention and proposes a small number
of mechanism variants whose affected causal coefficient is grounded in the
observed intervention effect. Incumbent models are not mutated.

The discovery observation that creates a challenger cannot also promote it.
Promotion requires a separate protected observation reserve. The incumbent and
challengers are compared on protected mean squared prediction error, and a
challenger is promoted only if it exceeds a minimum validated improvement.

v1.12 also replaces open-loop two-step experiment execution with a bounded
contingent experiment policy. Mabojolu chooses a first safe experiment and
precomputes a second-step decision for each representative first-step outcome.
At runtime, the actual noisy observation is assigned to the nearest
representative branch.

The controlled benchmark compares:

- the v1.11 open-loop sequence cheap-x -> cheap-y, cost 0.10;
- the v1.12 contingent policy, which begins with cheap-x and conditionally
  executes cheap-y only when the first result leaves ambiguity.

For the benchmark's decisive high-x observation, the contingent policy stops
after cheap-x, reducing executed experiment cost from 0.10 to 0.05 while
preserving the same safety ceiling.

Action planning is also receding-horizon. Mabojolu executes only the first action
of a multi-step plan, observes the resulting state, and replans. In the
controlled benchmark the initial model predicts that boost-x and boost-y are
both required. The observed transition after boost-x already crosses the goal,
so replanning terminates instead of executing the unnecessary second action.

This milestone therefore adds three kinds of adaptation: causal parameter
learning, bounded mechanism-family revision, and closed-loop experiment/action
execution.

It is still a controlled scaffold. Parameter learning currently supports
single-variable interventions, challengers modify one bounded coefficient at a
time, mechanism topology is fixed, protected validation is supplied explicitly,
contingent experiment planning uses representative mechanism means rather than
full observation integration, and receding-horizon planning still uses a
human-specified action catalog and goal state.

### Next experiments

The next experiments should measure:

1. bounded synthesis of new mechanism topology, not only adjustment of an
   existing coefficient;
2. discovery of interaction and nonlinear terms when additive models fail;
3. hidden-state hypotheses for delayed or partially observed causal effects;
4. Bayesian parameter posteriors rather than point estimates for learned causal
   coefficients;
5. protected challenger validation across multiple intervention contexts;
6. contingent experiment policy trees integrated over noisy observation
   distributions rather than representative means;
7. joint experiment-versus-action planning so information gathering and goal
   progress compete in one objective;
8. receding-horizon replanning after every action and experiment outcome;
9. mechanism-fragment transfer across differently named domains;
10. whether increased mechanism autonomy preserves hard risk ceilings,
    abstention, rollback, protected validation, auditability, and zero unsafe
    irreversible execution.

The next central milestone is autonomous mechanism-structure synthesis and
dual-control planning: Mabojolu should propose bounded new causal structures
when coefficient adjustment is insufficient, infer hidden or interaction
mechanisms from evidence, and decide whether to experiment or act based on both
information value and goal progress.

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
