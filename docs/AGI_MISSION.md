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
  fail-closed safety rules.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: adaptive latent-regime structure

Mabojolu G can now revise the structure of its own discovered environment
categories instead of treating the v1.5 latent taxonomy as permanent.

The v1.6 controller maintains unnamed latent regimes, bounded adaptation-policy
evidence, and an auditable history of structural revisions. It adds three
controlled mechanisms.

First, a latent regime can split when outcome evidence shows that the same
adaptation policy behaves materially differently across two separable regions
of the regime's observation history. A split therefore requires behavioral
evidence, not geometric variation alone. The split feature, threshold, affected
policy, utility gap, and feature separation are recorded in the audit trail.

Second, separately discovered regimes can merge only when they are close in the
current learned metric, agree on their preferred policy, and have sufficiently
similar policy-outcome profiles. Geometric similarity alone is not enough to
erase a distinction that matters for behavior.

Third, feature relevance is relearned from policy-outcome differences between
regimes. Signal dimensions whose variation does not correspond to a behavioral
difference are down-weighted toward a bounded floor, while dimensions associated
with meaningful policy differences receive more weight. All learned weights
remain bounded.

After a split, child regimes retain the historical observations needed for
audit and structure analysis but their adaptation-policy evidence is reset.
Each child must earn fresh policy evidence rather than inheriting conclusions
from the mixed parent regime.

The controlled v1.6 benchmark intentionally creates one broad latent regime
containing two observational modes with incompatible adaptation needs. A frozen
v1.5 controller continues treating them as one category. The adaptive v1.6
controller detects that one policy's utility changes sharply across
change-point-strength regions, splits the regime, relearns policy evidence in
each child, and is then evaluated on a mixed held-out sequence.

The benchmark compares:

1. adaptive latent-regime structure;
2. the frozen v1.5 latent-regime controller using the same broad initial
   assignment threshold;
3. a fixed balanced adaptation policy;
4. the bounded-policy hindsight oracle used only for evaluation.

The target held-out behavior is that the revised structure selects conservative
adaptation in the low-change mode and responsive adaptation in the high-change
mode, reaches the bounded-policy oracle on those held-out episodes, and
outperforms both the frozen taxonomy and the fixed balanced baseline.

Separate controlled tests verify autonomous merge behavior for redundant nearby
regimes, refusal to merge behaviorally incompatible regimes, bounded learned
feature weights, fresh evidence after splits, and continued global quarantine
of policies associated with unsafe irreversible outcomes.

This is still bounded structure learning rather than unrestricted self-
redesign. The observable feature vocabulary, initial distance function,
split/merge thresholds, maximum regime budget, policy catalog, and structural
revision algorithm remain human-specified.

### Next experiments

The next experiments should measure:

1. learning split and merge thresholds from held-out regret rather than fixing
   them manually;
2. learning novelty and ambiguity thresholds from calibration error and
   abstention utility;
3. replacing hand-weighted observation dimensions with a learned compact
   representation;
4. autonomous discovery of derived regime features from temporal patterns
   rather than using only supplied summary statistics;
5. whether representation changes improve held-out regret without destabilizing
   previously useful regimes;
6. explicit rollback when a structural or representation revision performs worse
   on protected validation episodes;
7. bounded proposal, validation, promotion, and retirement of representation
   revisions using the existing champion/challenger pattern;
8. long-horizon consolidation so repeatedly useful latent structures become
   reusable abstractions across task families;
9. cross-domain tests where the same learned structural principle transfers to
   differently named state variables and action spaces;
10. whether further scaffold removal preserves auditability, bounded external
    action, zero unsafe-policy reuse, and reproducible evaluation.

The next central milestone is self-calibrating representation and structure
learning: Mabojolu should learn not only which regimes exist, but also which
observations, derived features, and structural thresholds are useful for
discovering them.

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
