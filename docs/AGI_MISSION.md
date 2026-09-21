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
  reserves on repeated attempts.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: sequential regime-change detection and controlled search

Mabojolu G now moves beyond a fixed-size error window. A validated symbolic
champion is monitored only on fresh operational outcomes using two independent
signals:

1. a Beta-Bernoulli posterior estimates the probability that the champion's
   true correctness rate has fallen to or below the configured drift threshold;
2. a one-sided sequential likelihood-ratio score accumulates evidence for a
   degraded regime against the validated-stable accuracy model.

A challenger cycle opens only when both signals are strong enough and the
minimum fresh-evidence requirement has been met. If stable outcomes erase the
sequential evidence, the suspected change point is discarded rather than
forcing adaptation. This gives Mabojolu an explicit distinction between an
isolated mistake and sustained evidence that its learned rule no longer matches
the environment.

The drift trigger still obeys the fresh-reserve rule. Trigger observations remain
incumbent operational evidence and are never recycled as challenger training
data. Challenger fitting starts only after the trigger, the challenger is frozen
before validation, and promotion still requires beating the incumbent and the
fresh majority baseline on the same held-out reserve.

Repeated challenger search is now bounded per active regime. The first
challenger uses the normal validation reserve. Later attempts require a larger
fresh reserve, and search stops when the regime budget is exhausted. Successful
promotion or validated rollback to an archived regime starts a new regime budget.
This is a first safeguard against repeatedly searching until a hypothesis passes
by chance.

The controlled target behavior is:

stable regime A
→ isolated errors
→ sequential evidence returns to zero
→ no adaptation

stable regime A
→ sustained structural change
→ posterior confidence and sequential evidence rise
→ challenger search opens

new regime B
→ challenger fits on fresh outcomes
→ challenger validates on a separate reserve
→ promotion only if it beats incumbent and baseline

environment returns to regime A
→ archived champion is evaluated on fresh evidence
→ validated rollback without relearning

Even when this protocol is verified, it remains controlled research rather than
evidence of AGI. The next frontier is meta-adaptation: learning which detector
thresholds, experiment choices, search budgets, and validation allocations are
appropriate for different environment families while controlling false
discoveries and catastrophic forgetting.

### Next experiments

The next experiments should measure:

1. false-alarm rate under stationary but noisy environments;
2. detection delay under abrupt regime changes;
3. sensitivity to gradual drift rather than a single sharp change point;
4. challenger false-discovery rate across repeated search attempts;
5. recovery speed when a previously learned regime returns;
6. whether adaptive validation budgets outperform fixed reserves at equal
   evidence cost;
7. transfer of learned adaptation policy across unfamiliar environment families;
8. whether meta-learned adaptation improves held-out task performance without
   increasing unsafe or irreversible action rates.

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
