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
  including cumulative regret and held-out regime-sequence evaluation.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: controlled meta-adaptation benchmark and regret learning

Mabojolu G now has a controlled benchmark for testing whether its bounded
meta-adaptation layer improves with experience instead of merely accumulating
episode statistics.

The benchmark compares three systems on the same ordered regime episodes:

1. a static baseline that always uses the balanced adaptation policy;
2. Mabojolu's sequential meta-adaptive selector, which chooses only from evidence
   available before the current episode;
3. a hindsight oracle that evaluates every bounded policy only after the episode
   choice has been fixed.

The oracle is never exposed to the selector. Its only purpose is measurement.
For each episode, regret is defined as:

oracle utility - Mabojolu selected-policy utility

with a floor of zero for numerical stability.

The controlled benchmark includes calibration episodes followed by a held-out
mixed sequence spanning stationary noise, gradual drift, abrupt drift, and
recurring regimes. Every episode contains counterfactual outcomes for all
bounded policies so the static baseline and oracle can be evaluated on exactly
the same episode without changing Mabojolu's observed learning history.

The report measures:

- cumulative and mean utility;
- false alarms;
- missed changes;
- false promotions;
- recovery successes;
- validation evidence cost;
- detected-change count and mean detection delay;
- per-episode regret;
- cumulative regret;
- calibration versus held-out regret.

The current synthetic benchmark is deliberately constructed so different
environment families reward different bounded policies. Early calibration
therefore incurs exploration regret. The research target is that, after enough
family-specific evidence, Mabojolu selects the appropriate policy on the held-out
mixed sequence, reduces regret, suppresses avoidable false alarms, and detects
abrupt changes faster than the fixed balanced baseline.

This benchmark remains a controlled synthetic evaluation. It does not yet prove
that Mabojolu can infer environment families from raw experience or that the same
advantage will survive richer real-world dynamics. Its value is that it creates
an auditable falsifiable measurement protocol before removing those scaffolds.

### Next experiments

The next experiments should measure:

1. regret curves across longer held-out regime sequences and different episode
   orderings;
2. robustness when policy utilities are noisy rather than deterministic;
3. whether the same learned policy preferences survive shifted counterfactual
   outcome distributions;
4. online environment-family induction from observed drift statistics rather
   than supplied family labels;
5. calibration quality for uncertainty over the inferred environment family;
6. whether family induction plus meta-adaptation beats both the fixed balanced
   baseline and the label-supplied meta-adaptive control;
7. safe abstention when family confidence is too low to justify a policy change;
8. transfer quality when an unseen family is structurally similar but not
   identical to prior families;
9. end-to-end integration where benchmark episode outcomes are generated by the
   actual adaptive champion/challenger runtime rather than a synthetic outcome
   table;
10. whether these gains persist without increasing unsafe, irreversible, or
    false-promotion rates.

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
