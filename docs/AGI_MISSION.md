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
  promotion, unsafe-profile quarantine, and explicit rollback on regression.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: self-calibrating representation and structure

Mabojolu G can now evaluate bounded alternatives for how it represents regime
evidence and how sensitively it draws structural boundaries.

The v1.6 controller learned feature relevance inside one fixed observation
representation, but its raw signal encoding and several key structural
thresholds were still selected by hand. The v1.7 self-calibration layer turns
those choices into auditable champion/challenger candidates.

Each bounded representation profile specifies:

- an observation encoder;
- regime-assignment distance threshold;
- ambiguity margin for abstention;
- minimum utility gap required to justify a split;
- minimum feature separation required to justify a split.

The current candidate library includes raw representations with different
structural sensitivity and compressed derived representations that combine
multiple observable drift signals into higher-level quantities such as drift
pressure and temporal instability.

Candidate evaluation uses protected episodes. Each protected episode is tested
from a freshly trained controller instance so a candidate cannot learn from one
validation episode and use that information on the next. Evaluation therefore
measures the state produced by calibration rather than adaptation to the
validation set itself.

The current representation champion is promoted only when a safe challenger
produces a material reduction in protected cumulative regret. Any candidate
associated with unsafe irreversible behavior or false promotion is quarantined.
If the current champion itself becomes unsafe, it must be replaced by a safe
evaluated profile even when its numerical regret appears lower.

The previous champion is archived. After promotion, a shifted final holdout is
used as a second protection layer. If the promoted representation regresses
beyond a bounded tolerance relative to the archived champion, Mabojolu rolls
back and quarantines the failed representation.

The controlled v1.7 benchmark intentionally places final observations near a
regime boundary. The raw representation remains uncertain and abstains, while a
derived drift-compressed representation combines the relevant signals and uses a
calibrated ambiguity threshold to preserve the useful distinction. The final
holdout shifts those boundary observations again to test whether the promoted
representation generalizes beyond the protected validation points.

The benchmark keeps environment truth invariant across policy counterfactuals.
A different adaptation policy may change detection, recovery, false promotion,
delay, or evidence cost, but it does not change whether the underlying
environment actually changed.

This remains bounded self-calibration rather than unrestricted representation
invention. The candidate encoder library, allowed derived operations, policy
catalog, safety criteria, promotion rule, rollback tolerance, and evaluation
protocol remain human-specified.

### Next experiments

The next experiments should measure:

1. generating new bounded representation candidates from observed failure modes
   instead of choosing only from a fixed encoder catalog;
2. learning calibration thresholds continuously from outcome evidence while
   preserving protected validation partitions;
3. complexity penalties so a more elaborate representation must earn its extra
   structure through held-out improvement;
4. compositional derived-feature search over bounded arithmetic, relational, and
   temporal operators;
5. whether useful derived features transfer across renamed state variables and
   different task families;
6. protected multi-stage validation so representation changes cannot overfit one
   narrow benchmark sequence;
7. memory consolidation that promotes repeatedly useful representation
   primitives into reusable abstractions;
8. automatic retirement of derived features that stop improving prediction,
   planning, or adaptation utility;
9. cross-domain evaluation where one learned representation primitive improves
   performance in an unfamiliar causal task family;
10. whether increasing representation autonomy preserves rollback, auditability,
    zero unsafe irreversible actions, and reproducible evaluation.

The next central milestone is bounded representation synthesis and transfer:
Mabojolu should begin proposing new reusable representation primitives from
experience, validate them against protected tasks, and transfer successful
primitives across domains without changing its safety or approval boundaries.

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
