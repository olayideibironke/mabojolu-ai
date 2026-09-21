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
  calibrated abstention and fail-closed uncertainty fallbacks.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: observation-only environment-family induction

Mabojolu G now removes the true environment-family label from the policy
selection path.

The previous meta-adaptation controller could learn different policy preferences
for stationary noise, gradual drift, abrupt drift, and recurring regimes, but the
correct family name was supplied directly to the controller. The current
environment-family inducer instead receives only bounded observable signals:

- recent error rate;
- error burstiness;
- posterior drift confidence;
- normalized change-point strength;
- similarity to a previously seen regime;
- trend persistence.

Those signals are compared against explicit bounded family prototypes. The
inducer produces a normalized belief distribution over the known family
taxonomy, together with top-family confidence, separation from the runner-up,
and normalized entropy.

The true benchmark family remains available only to the evaluator. It is not
passed into the autonomous policy-selection call.

High-confidence observations are routed into the existing family-specific
meta-adaptation controller. The inferred family also becomes the evidence
partition used for subsequent learning, so the autonomous path does not require
the evaluator to repair its learning history with hidden labels.

Uncertain observations trigger abstention rather than forced classification.
The default uncertainty path uses the balanced policy, then the conservative
policy if balanced has been quarantined. If those bounded uncertainty fallbacks
are exhausted, the controller fails closed instead of silently switching to a
more aggressive policy.

The controlled benchmark now compares:

1. a fixed balanced policy;
2. the v1.3 meta-adaptive controller with the true family label supplied;
3. the observation-only v1.4 controller;
4. the bounded-policy hindsight oracle used only for evaluation.

Calibration episodes use canonical observable profiles. Held-out episodes use
shifted profiles rather than exact prototype copies. One held-out
gradual-versus-abrupt case is deliberately ambiguous and is expected to abstain.

The benchmark measures held-out utility, regret, false alarms, missed changes,
false promotions, detection delay, inference confidence, entropy, coverage,
abstention count, and resolved-family accuracy.

This is a meaningful reduction in hand-supplied scaffolding, but it is not yet
fully autonomous latent regime discovery. The family names, feature set,
prototype locations, confidence threshold, and uncertainty fallback hierarchy
remain bounded research scaffolds. Those limits are explicit so the next
milestone can test whether Mabojolu can remove them rather than hiding them.

### Next experiments

The next experiments should measure:

1. family-inference accuracy and abstention calibration under progressively
   noisier signal distributions;
2. robustness when the observable feature distributions shift away from the
   predefined prototypes;
3. whether confidence remains calibrated when two or more regime families
   overlap substantially;
4. whether prototype locations can be learned from experience instead of fixed
   in advance;
5. whether the system can discover useful latent regime clusters without
   receiving family names at any stage;
6. whether latent clusters can acquire distinct adaptation-policy preferences
   through outcome evidence alone;
7. split and merge behavior when one discovered cluster contains multiple
   incompatible adaptation dynamics;
8. recurrence recognition when a previously discovered latent regime returns
   after several unrelated episodes;
9. comparison of latent-regime meta-adaptation against both fixed balanced and
   label-supplied controls on held-out sequences;
10. whether scaffold removal preserves zero unsafe irreversible outcomes and
    controlled false-promotion rates.

The next central milestone is latent regime discovery: Mabojolu should learn its
own useful environment categories from experience instead of selecting among
human-named families.

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
