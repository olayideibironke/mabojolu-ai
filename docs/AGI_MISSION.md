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
  independently synthesized primitives when no single primitive is sufficient;
- active causal correspondence learning that chooses reversible low-risk
  interventions by expected information gain, updates uncertainty from measured
  causal effects rather than target counterfactual utility tables, blocks unsafe
  experiments, and uses resolved correspondences for transferred goal-directed
  planning;
- uncertainty-aware causal world-model transfer with Gaussian likelihood
  updates, persistent posterior mass over competing mechanisms, bounded
  multi-step experiment lookahead, and posterior-aware multi-step goal planning;
- adaptive mechanism discovery with online effect estimation, predictive-misfit
  detection, bounded challenger proposal, protected challenger promotion,
  contingent experiment branching, and receding-horizon action replanning;
- bounded mechanism-structure synthesis that can add linear, pairwise
  interaction, or latent-bias terms when coefficient adjustment is
  insufficient, with protected structural validation and dual-control selection
  between information gathering and goal-directed action;
- hierarchical causal-program synthesis that composes separately validated
  mechanism fragments under protected holdout evaluation, plus depth-limited
  mixed experiment/action policy trees whose branches select different
  multi-action programs after informative causal probes;
- uncertainty-aware hierarchical-program belief with Bayesian evidence updates,
  leave-one-fragment-out failure attribution, posterior-gated autonomous
  subgoal formation, and materialization of generated subgoals into the existing
  dependency-aware goal hierarchy.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: uncertainty-aware hierarchical programs and autonomous subgoal formation

Mabojolu G can now maintain uncertainty over multiple competing hierarchical
causal programs instead of immediately collapsing to one deterministic program.

Each candidate hierarchical program retains its validated causal fragments,
base effects, complexity, depth, and observation-noise scale. New intervention
evidence updates a posterior over complete programs using Gaussian predictive
likelihoods.

The controlled v1.15 benchmark begins with equal probability over:

- a full hierarchical program containing validated xy and yz interaction
  fragments;
- a partial program containing only the xy fragment.

Before any discriminating evidence arrives, the posterior is 50/50 and normalized
entropy is maximal. Under that unresolved uncertainty, Mabojolu refuses to form a
high-confidence subgoal chain whose terminal success probability would depend on
assuming the full program is correct.

A noisy yz intervention then provides evidence favoring the full program.
Mabojolu concentrates strongly on the better program while retaining nonzero
posterior mass on the alternative rather than deleting it.

v1.15 also adds fragment-level failure attribution. When a hierarchical program
later makes a bad prediction, Mabojolu evaluates the same observation with each
fragment removed in turn. A fragment is blamed only when removing it materially
reduces squared prediction error.

The controlled failure benchmark deliberately corrupts the yz fragment while
leaving the xy fragment unchanged. Leave-one-fragment-out evaluation identifies
only the faulty yz fragment as explanatory for the failure.

The subgoal layer uses the complete current program posterior, not only the
highest-probability program. Mabojolu searches bounded safe action sequences and
accepts a sequence only when the posterior-weighted probability of reaching the
terminal goal exceeds the configured confidence threshold.

Once the program posterior is sufficiently concentrated, Mabojolu autonomously
creates intermediate numeric goals from the expected state reached after each
selected action.

In the controlled benchmark the resulting sequence is:

01-prepare-xy
-> intermediate state target about 0.70
-> 02-bridge-yz
-> terminal state target 1.00

These subgoals are not stored as a separate planning annotation. They are
materialized into the existing HierarchicalGoalReasoner as dependency-linked
child goals beneath the terminal objective.

The first generated subgoal becomes actionable first. After an observed state of
0.75, Mabojolu marks the first subgoal complete and the second generated subgoal
becomes the next actionable goal.

This milestone therefore connects causal-program uncertainty, diagnosis, action
planning, and the existing hierarchical goal system:

competing causal programs
-> posterior update
-> confidence-gated plan
-> autonomous intermediate goals
-> dependency-aware execution
-> observed progress
-> goal-hierarchy update

The benchmark also contains a cheaper nuisance action and an unsafe zero-cost
shortcut. Neither enters the autonomous subgoal sequence because one provides no
causal progress and the other violates the hard reversibility/risk boundary.

This remains bounded autonomous subgoal formation rather than unrestricted goal
creation. The terminal objective, candidate action catalog, maximum action
count, success-probability threshold, scalar state representation, program
catalog, likelihood model, fragment-removal diagnostic, and safety ceilings
remain human-specified.

### Next experiments

The next experiments should measure:

1. posterior uncertainty over newly synthesized hierarchical programs rather than
   only a supplied competing-program catalog;
2. Bayesian fragment reliability that accumulates failure attribution across
   episodes instead of diagnosing one observation at a time;
3. automatic fragment repair or rollback after repeated blame evidence;
4. dynamic subgoal revision when observed progress differs substantially from
   predicted progress;
5. subgoal generation over multidimensional states rather than one scalar target;
6. prerequisite discovery where Mabojolu infers which intermediate conditions
   must hold before an action becomes effective;
7. mixed information-seeking and goal subgoals inside one dependency hierarchy;
8. transfer of learned subgoal schemas to differently named domains;
9. longer episodic evaluation where stale subgoals are retired and replaced as
   the causal posterior changes;
10. whether autonomous goal formation preserves parent-goal intent, inherited
    constraints, hard risk ceilings, abstention, auditability, and zero unsafe
    irreversible execution.

The next central milestone is self-revising hierarchical goals and causal
programs: Mabojolu should accumulate reliability evidence for individual causal
fragments, repair or roll back failing program components, revise intermediate
goals when reality diverges from prediction, and preserve the terminal objective
and safety constraints throughout the revision cycle.

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
