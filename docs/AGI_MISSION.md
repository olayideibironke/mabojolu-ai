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
  cluster, recognizes recurring regimes, and abstains on ambiguous membership.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: bounded latent regime discovery

Mabojolu G now removes the human-supplied environment-family taxonomy from its
active adaptation path.

The v1.4 controller inferred among predefined names such as stationary-noisy,
gradual-drift, abrupt-drift, and recurring-regime. The v1.5 latent-regime
controller receives the same bounded observable signal vector but no family
name and no fixed family prototype table.

It maintains an online memory of unnamed regimes:

regime-001
regime-002
regime-003
...

A new observation is compared against learned regime centroids. If it is close
to one learned regime and clearly separated from alternatives, Mabojolu reuses
that regime and updates its centroid online. If it is sufficiently novel,
Mabojolu creates a new bounded regime. If it lies ambiguously between learned
regimes, Mabojolu abstains from assigning it rather than contaminating either
cluster.

Each latent regime maintains its own adaptation-policy evidence. Safe policies
are explored locally, then selected using posterior success evidence, bounded
episode utility, and a bounded exploration bonus. A regime that returns after
intervening regimes reuses its accumulated policy evidence instead of relearning
from scratch.

Regime creation is capacity-bounded. Novel observations arriving after the
regime budget is exhausted use a bounded uncertainty fallback rather than
silently overwriting an existing regime. Unsafe irreversible outcomes still
quarantine the responsible policy globally. If safe uncertainty fallbacks are
exhausted, the controller fails closed.

The controlled v1.5 benchmark compares:

1. a fixed balanced policy;
2. the label-supplied v1.3 meta-adaptive controller;
3. the unnamed latent-regime controller;
4. the bounded-policy hindsight oracle used only for evaluation.

The evaluator retains family labels solely for measurement of cluster purity and
comparison against prior controls. Those labels are not passed into latent
regime selection or latent policy learning.

The target benchmark behavior is:

- four distinct unnamed regimes discovered during calibration;
- no new regime creation on the shifted held-out sequence;
- recurrence recognition when learned regimes return;
- held-out policy choices matching the label-supplied control;
- a deliberate ambiguous case triggering abstention rather than forced
  membership;
- no increase in false promotions, missed changes, or unsafe irreversible
  actions.

This is stronger scaffold removal, but it is still bounded research rather than
open-ended category invention. The observable feature set, feature weights,
distance function, novelty threshold, ambiguity margin, maximum regime count,
and policy catalog remain human-specified. Those remaining assumptions define
the next experiments.

### Next experiments

The next experiments should measure:

1. latent-regime stability under noisy and continuously drifting observations;
2. learned rather than fixed regime-creation thresholds;
3. autonomous split decisions when one latent regime develops incompatible
   policy-outcome modes;
4. autonomous merge decisions when two separately discovered regimes become
   behaviorally equivalent;
5. learned feature relevance so nuisance signal dimensions can be ignored;
6. representation learning that can propose new regime features instead of using
   only the supplied drift statistics;
7. nonparametric regime growth with explicit complexity penalties and bounded
   memory;
8. long-horizon recurrence after many intervening regimes and centroid shifts;
9. whether learned split/merge behavior lowers held-out policy regret versus the
   fixed-cluster v1.5 controller;
10. whether additional scaffold removal preserves auditability, rollback,
    bounded irreversible action, and zero unsafe-policy reuse.

The next central milestone is adaptive latent-regime structure: Mabojolu should
learn when its own discovered categories are too broad, redundant, or based on
irrelevant features, then revise that internal taxonomy from outcome evidence.

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
