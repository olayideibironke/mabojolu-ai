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
  promotion, negative-transfer retirement, and unsafe-primitive quarantine.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: bounded representation synthesis and transfer

Mabojolu G can now synthesize a new bounded representation primitive from
outcome evidence instead of selecting only from a predefined encoder catalog.

The v1.8 synthesizer receives examples containing normalized observations and
the measured utilities of bounded adaptation policies. It is not given a class
label describing the environment. It searches a deliberately small auditable
program language over abstract structural roles.

The current primitive grammar contains:

- one-role atomic projections;
- bounded means over two or three roles;
- two-role absolute gaps.

Each candidate is paired with a learned threshold and the best low-side and
high-side policies found from outcome utility. Candidate selection minimizes
training regret plus an explicit complexity penalty, so a higher-arity primitive
must earn its additional structure.

The controlled synthesis task is designed so no single raw signal and no
two-signal mean is sufficient. A three-role mean is the simplest candidate that
separates the two policy-demand regions without regret. This prevents the
benchmark from rewarding a renamed copy of an already sufficient feature.

The synthesized primitive is frozen before protected source validation. A
separate atomic-only search provides the simpler baseline. The synthesized
primitive must improve protected regret despite paying a larger complexity
penalty.

Transfer is structural rather than name-based. The learned primitive stores
abstract roles such as signal-a, signal-b, and signal-c instead of source
variable names. A second task family binds those roles to differently named
variables and uses different utility magnitudes. The source-trained primitive,
threshold, and policy association are then evaluated without refitting on the
target examples.

The reusable-primitive library requires positive transfer evidence from multiple
domains before a candidate becomes reusable. Repeated negative transfer retires
a primitive. Unsafe irreversible behavior or false promotion quarantines it.
Transfer-improvement claims are recomputed from baseline and primitive regret,
and terminally retired or quarantined primitives cannot be revived by later
evidence.

The current v1.8 benchmark therefore compares:

1. the synthesized bounded representation rule;
2. the best atomic-only rule learned from the same source training evidence;
3. protected source validation;
4. a renamed unfamiliar target family with shifted utility magnitudes.

The target result measures whether a primitive learned from one task family can
retain its usefulness under symbol renaming and changed reward scale.

This remains bounded representation synthesis rather than open-ended concept
invention. The operator grammar, maximum arity, abstract role vocabulary,
source-to-role and target-to-role bindings, policy catalog, normalization range,
complexity penalty, and protected evaluation protocol remain human-specified.

### Next experiments

The next experiments should measure:

1. autonomous induction of structural role correspondences instead of supplying
   source and target role bindings;
2. confidence over competing role mappings with abstention when correspondence
   evidence is weak;
3. composition of previously useful primitives into deeper bounded
   representation programs;
4. search over temporal operators that summarize change, persistence, lag, and
   recurrence from raw episode sequences;
5. complexity regularization for multi-stage representation programs;
6. protected validation across three or more task families before broad
   promotion of a reusable abstraction;
7. automatic specialization when one reusable primitive transfers well to only
   a subset of domains;
8. causal tests distinguishing genuinely structural transfer from accidental
   statistical correlation;
9. integration of reusable representation primitives into planning, world-model
   learning, and autonomous experiment selection rather than adaptation alone;
10. whether additional representation autonomy preserves rollback, auditability,
    bounded external action, and zero unsafe irreversible behavior.

The next central milestone is autonomous structural role induction and
representation composition: Mabojolu should infer how unfamiliar variables map
onto learned structural roles, compose reusable primitives when one primitive is
insufficient, and abstain when the mapping is not justified by evidence.

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
