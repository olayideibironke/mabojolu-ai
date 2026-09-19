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
- local-first and browser-owned inference routing.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

The current central intelligence milestone is fresh-reserve challenger/champion
predicate adaptation under concept drift:

1. bootstrap an initial symbolic champion through the verified fit/freeze/holdout
   process before allowing it to affect action selection;
2. monitor the validated champion only on fresh operational outcomes;
3. detect degradation from a bounded recent correctness window rather than from
   training or holdout scores;
4. keep the drift-trigger window as incumbent operational evidence and never
   reuse it as challenger fitting data;
5. start challenger fitting only on outcomes observed after the drift trigger;
6. freeze the challenger before its own validation reserve begins;
7. compare challenger accuracy, incumbent champion accuracy, and the
   majority-class baseline on exactly the same fresh challenger holdout;
8. replace the champion only when the challenger exceeds the minimum validation
   threshold and strictly beats both incumbent and baseline;
9. retain the incumbent when the challenger fails that comparison;
10. exclude challenger validation outcomes from the replacement champion's
    applicability evidence after promotion;
11. expose champion generation, replacement count, drift-window state,
    challenger fit/validation counts, and the last comparison result in the
    audit trail.

The first controlled drift protocol uses a three-outcome operational correctness
window. When champion accuracy across that complete window falls to 0.5 or
below, Mabojolu opens a challenger cycle. The trigger observations remain part
of the incumbent's operational history but the challenger starts with an empty
fit partition.

The controlled replacement experiment first validates an equality-based
champion. A later distribution shift makes one-step differences useful. After
three fresh incumbent errors, the challenger receives six new fit outcomes and
then three additional held-out outcomes. The challenger learns
abs(historyLength - distinctActionsSeen) <= 1 and replaces the equality champion
only because it reaches perfect fresh-holdout accuracy while the incumbent and
majority baseline each reach only two-thirds.

The runtime comparison keeps a frozen v0.9 equality champion as the control. On
the same post-drift 3+/2 target, the frozen champion selects the wrong
higher-order abstraction first and needs an extra cycle. The v1.0 adaptive model
uses its generation-2 champion to choose the productive repeat immediately.

Even if verified, this remains a small controlled drift protocol. It does not
yet solve gradual drift, noisy change-point detection, repeated challenger
search under multiple-testing pressure, rollback after a bad promotion,
catastrophic forgetting across older regimes, or adaptive allocation of finite
validation reserves. Stronger work should add reversible champion history,
statistical drift confidence, regime memory, and safeguards against repeatedly
searching until a challenger happens to pass by chance.

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
