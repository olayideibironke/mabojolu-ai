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
  independently synthesized primitives when no single primitive is sufficient.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: autonomous structural role induction and representation composition

Mabojolu G can now infer how an unfamiliar domain's observed variables map onto
the abstract roles required by a transferred representation primitive.

The v1.8 transfer benchmark still supplied a target role binding explicitly. In
v1.9 the transferred primitive is frozen, the target variable names are exposed,
and Mabojolu searches bounded variable-set hypotheses using protected target
outcome evidence.

For the current representation grammar, mean and absolute-gap primitives are
symmetric under permutation of their argument roles. The role-induction search
therefore groups mathematically equivalent permutations into one variable-set
hypothesis instead of falsely treating role-order symmetry as uncertainty.

Each candidate target mapping is evaluated by the regret of the frozen
transferred rule. The winning mapping is accepted only when:

- its protected regret is below the configured acceptance bound; and
- it has a sufficient regret margin over the next genuinely different variable
  set.

If multiple target variable sets explain the protected outcomes equally well,
Mabojolu abstains and returns no binding. Missing variables, inconsistent target
schemas, and malformed values fail closed.

The v1.9 transfer benchmark removes the supplied target mapping used in v1.8.
Mabojolu receives the previously synthesized three-role mean, target examples
with unfamiliar variable names, and target policy-outcome evidence. It correctly
selects the three-variable structural set while excluding a nuisance variable,
then reaches the same protected transfer result as the earlier supplied-binding
control.

This is calibrated target adaptation rather than zero-shot correspondence:
protected target outcome evidence is used to infer the mapping. The target
binding itself is not supplied.

v1.9 also adds bounded representation composition. Two independently
synthesized primitives can be combined through a small auditable gate grammar:

- AND;
- OR;
- XOR.

The controlled composition task is constructed so neither primitive alone can
select the correct adaptation policy across all contexts. The composition search
must discover that responsive behavior is appropriate only when both primitive
conditions are high. The resulting AND composition reaches the bounded-policy
oracle across all protected composition cases, while either primitive used
alone incurs regret.

The composition layer does not invent arbitrary code. Primitive programs,
thresholds, bindings, gate operators, policy choices, complexity penalties, and
evaluation evidence remain inspectable.

This milestone therefore removes the explicit target role-binding scaffold and
adds bounded compositional reuse, but it still relies on target outcome evidence,
a human-specified role vocabulary, a small mapping search space, and a fixed
composition grammar.

### Next experiments

The next experiments should measure:

1. role induction from interaction and causal intervention rather than direct
   counterfactual policy-utility tables;
2. zero-shot structural correspondence from relational and causal signatures
   before any target reward feedback;
3. active experiment selection that chooses the safest observation or
   intervention for resolving mapping ambiguity;
4. posterior uncertainty over structural correspondences instead of a single
   regret-margin confidence rule;
5. deeper composition of more than two reusable primitives under explicit
   complexity and validation budgets;
6. temporal representation programs that learn lag, trend, persistence, and
   recurrence from raw episode sequences;
7. transfer of composed representations into planning and world-model inference
   rather than adaptation-policy selection alone;
8. autonomous creation of new abstract roles when existing role vocabularies
   cannot explain protected outcomes;
9. multi-domain consolidation so repeated structural mappings become reusable
   correspondence priors without leaking task-specific variable names;
10. whether further scaffold removal preserves abstention, rollback,
    auditability, bounded external action, and zero unsafe irreversible behavior.

The next central milestone is active causal correspondence learning: Mabojolu
should resolve unfamiliar structural mappings by choosing informative safe
experiments, update uncertainty over competing causal correspondences, and
transfer learned representations into planning and world-model reasoning rather
than relying primarily on supplied counterfactual utility tables.

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
