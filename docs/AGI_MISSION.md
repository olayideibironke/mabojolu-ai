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
  quarantine after unsafe irreversible outcomes.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: bounded meta-adaptation across regime episodes

Mabojolu G now adds a second learning layer above the validated
challenger/champion loop. The task-level learner still discovers and validates
symbolic predicates. The new meta-adaptation controller learns which bounded
adaptation policy should govern that process in different environment families.

The controller does not rewrite arbitrary code, prompts, tools, or safety rules.
It chooses only among explicit audited policies whose detector thresholds,
validation reserves, challenger budgets, and evidence windows are bounded in
advance.

Each completed adaptation episode records:

1. whether a real regime change occurred;
2. whether change was detected;
3. detection delay when applicable;
4. whether recovery succeeded;
5. whether a false promotion occurred;
6. fresh validation evidence cost;
7. whether an unsafe irreversible action occurred.

Episode utility is bounded to [-1, 1]. Successful recovery, correct suppression
of false alarms, and efficient detection contribute positive evidence. Missed
changes, false alarms, false promotions, excessive validation cost, and unsafe
irreversible outcomes contribute negative evidence.

For each environment family, Mabojolu maintains auditable per-policy evidence.
It first performs controlled exploration of safe policies, then uses posterior
success evidence plus bounded utility and an exploration bonus to select the
next policy. When an unfamiliar environment family appears, the controller may
transfer global cross-family evidence after enough completed episodes rather than
starting from an entirely uninformed prior.

The initial bounded policy catalog contains:

- conservative adaptation for noisy but mostly stationary environments;
- balanced adaptation matching the current v1.1 defaults;
- responsive adaptation for abrupt structural change.

These policies differ only in bounded adaptation parameters. The underlying
champion/challenger validation rules remain authoritative.

Safety remains fail-closed. Any policy associated with an unsafe irreversible
outcome is quarantined globally and excluded from subsequent policy selection.
If every policy becomes quarantined, meta-adaptation refuses to select a policy
rather than silently reusing an unsafe one.

The controlled target behavior is:

stationary noisy family
→ conservative policy accumulates stronger evidence
→ false adaptations decrease

abrupt-change family
→ responsive policy accumulates stronger evidence
→ detection delay decreases

new unfamiliar family
→ previously earned global evidence supplies a transfer prior
→ local family evidence can later override that prior

unsafe irreversible outcome under a policy
→ policy is quarantined
→ future selection excludes it

This is a controlled form of learning how to adapt. It is still not evidence of
AGI by itself. The required next step is empirical comparison against a static
adapter across held-out sequences of noisy stability, gradual drift, abrupt
change, recurring regimes, and mixed unfamiliar families.

### Next experiments

The next experiments should measure:

1. false-alarm rate under stationary but noisy environments;
2. detection delay under abrupt regime changes;
3. sensitivity to gradual drift rather than a single sharp change point;
4. challenger false-discovery rate across repeated search attempts;
5. recovery speed when a previously learned regime returns;
6. whether meta-adaptive policy selection outperforms the fixed balanced policy
   at equal evidence cost;
7. whether family-specific policy learning beats one global policy across mixed
   regime sequences;
8. transfer quality when an unseen environment family begins from cross-family
   evidence and later accumulates local evidence;
9. policy regret versus an oracle that knows the best bounded policy per family;
10. whether meta-adaptation improves held-out task performance without increasing
    unsafe, irreversible, or false-promotion rates.

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
