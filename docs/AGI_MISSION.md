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
  between information gathering and goal-directed action.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: autonomous mechanism-structure synthesis and dual-control planning

Mabojolu G can now propose a bounded change to causal model structure when an
additive mechanism family cannot explain protected evidence.

The v1.12 challenger path adjusted one existing coefficient at a time. v1.13
adds a small auditable structural grammar:

- an additional bounded linear term;
- a pairwise interaction term;
- a latent-bias term representing residual effect not attached to an observed
  intervention variable.

Structural synthesis starts from an incumbent mechanism and discovery residuals.
For each candidate structural term, Mabojolu fits a bounded coefficient from the
residual evidence and creates a separate challenger mechanism. The incumbent is
never mutated in place.

The discovery evidence that creates a structural challenger is not sufficient
for promotion. All challengers are evaluated on a separate protected
observation reserve. Protected prediction error plus an explicit structural
complexity penalty determines whether any challenger has earned promotion.

The controlled v1.13 structure benchmark uses an environment whose true response
contains a pairwise x*y interaction. The additive incumbent contains only
independent x and y effects. Extra linear terms and a latent-bias term can
partially explain the discovery residual, but only the learned interaction term
generalizes across protected x-only, y-only, partial-joint, and full-joint
interventions.

The promoted structural term is:

interaction(x,y), coefficient 0.60

and the discovery and protected evidence sets are explicitly disjoint.

v1.13 also introduces bounded dual-control choice. Mabojolu compares the value of
learning more about the current causal mechanism against the value of acting
toward the current goal.

For candidate experiments, the score contains expected posterior entropy
reduction minus experiment cost. For candidate actions, the score contains
posterior-weighted expected goal progress, probability of reaching the goal, and
action cost. Experiments and actions must both satisfy the same reversibility and
hard risk-ceiling constraints.

The controlled dual-control benchmark begins with two competing mechanisms. The
same goal action succeeds under one mechanism but not the other. Under the
initial 50/50 belief, the best safe action has only 0.50 goal-success probability,
so a low-cost causal probe has higher value than acting immediately.

After the probe returns evidence concentrated on the fast mechanism, the value
of further information collapses and Mabojolu switches to the goal action. The
benchmark therefore demonstrates an explicit sequence:

uncertain model -> experiment -> belief update -> act

rather than an experiment-only or action-only controller.

Unsafe zero-cost probes and unsafe zero-cost actions are present in the
benchmark but remain excluded by hard risk and reversibility boundaries.

This is bounded structural self-revision, not unrestricted model invention. The
structural grammar, maximum one-term revision per challenger, variable list,
coefficient bounds, protected validation reserve, Gaussian mechanism family,
dual-control scoring weights, action/experiment catalogs, and safety ceilings
remain human-specified.

### Next experiments

The next experiments should measure:

1. multi-term structural challengers where one interaction is not enough;
2. nonlinear bounded terms such as thresholds, saturation, and piecewise
   responses;
3. hidden-state mechanisms that explain delayed or hysteretic effects rather
   than only a static latent bias;
4. Bayesian posterior uncertainty over synthesized structure and coefficients;
5. protected validation across multiple intervention distributions before
   structural promotion;
6. automatic rollback when a promoted structural mechanism later regresses;
7. dual-control planning over multi-step experiment/action sequences instead of
   one-step experiment-versus-action choice;
8. joint information and reward planning where actions can themselves be
   informative about uncertain mechanisms;
9. transfer of learned structural mechanism fragments into differently named
   domains;
10. whether deeper model synthesis preserves hard risk ceilings, abstention,
    rollback, protected validation, auditability, and zero unsafe irreversible
    execution.

The next central milestone is hierarchical causal program synthesis and
long-horizon dual control: Mabojolu should compose multiple validated mechanism
fragments into deeper causal programs, maintain uncertainty over those programs,
and plan mixed experiment/action sequences over longer horizons while continuing
to prefer reversible, auditable, low-risk information gathering.

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
