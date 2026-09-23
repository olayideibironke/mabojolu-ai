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


### Universal multimodal substrate

Mabojolu also maintains an ordinary-assistant multimodal substrate in parallel
with the AGI research kernel.

The product layer now has bounded local interfaces for:

- image understanding;
- text, code, CSV, and JSON analysis;
- PDF and non-macro OOXML document extraction;
- spreadsheet and presentation extraction;
- local audio transcription and understanding through FFmpeg plus whisper.cpp;
- video understanding through bounded frame sampling plus soundtrack
  transcription;
- local image generation through a loopback-only ComfyUI action surface.

Multimodal specialist outputs are normalized into versioned evidence packages
before they reach the reasoning layer.

A local runtime capability probe distinguishes implemented adapters from engines
that are actually installed and configured on the current machine.

This substrate expands what Mabojolu can observe and produce, but it remains
infrastructure rather than evidence of AGI. General-intelligence claims still
depend on controlled transfer, learning, planning, revision, and adaptation
benchmarks.

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
  dependency-aware goal hierarchy;
- self-revising hierarchical programs and goal chains with cross-episode
  fragment reliability, repeated-blame quarantine, protected repair or rollback,
  progress-divergence detection, and replacement of stale subgoals while
  preserving the terminal goal contract and inherited safety constraints;
- autonomous bounded repair synthesis that fits a replacement causal coefficient
  directly from residual evidence after fragment quarantine, requires disjoint
  protected installation evidence, and combines multidimensional constrained
  planning with information-seeking and task-progress goals in one hierarchy;
- topology-changing structural repair synthesis that searches bounded linear,
  pairwise-interaction, and latent-bias replacements after fragment quarantine,
  plus learned state prerequisites for action effectiveness and auditable
  replanning when those prerequisites change;
- probabilistic joint belief over competing repair structures and prerequisite
  thresholds, with safe active experiment selection by expected information
  gain, marginal uncertainty tracking, protected repair installation after
  posterior resolution, and downstream vector-plan revision from the resolved
  prerequisite hypothesis;
- autonomous bounded experiment synthesis from competing repair/prerequisite
  hypotheses, depth-two contingent epistemic lookahead, and decision-aware
  stopping when residual causal uncertainty no longer changes the safest
  cost-minimizing vector plan;
- value-of-information dual control where ordinary task actions can also serve
  as observations, pure experiments compete against informative actions on the
  same task horizon, and information is purchased only when its downstream task
  value exceeds explicit cost and delay penalties;
- receding-horizon multidimensional dual control with combined
  repair/prerequisite world hypotheses, vector state and terminal constraints,
  real action observations, posterior updates, one-control-at-a-time execution,
  and full replanning after every observation;
- online belief-model coevolution where repeated live prediction mismatch can
  quarantine a damaged fragment, trigger bounded topology repair on episode
  evidence, require disjoint protected installation, relearn action
  prerequisites, replace the live hypothesis, revise stale goal branches, and
  immediately feed the revised model back into receding-horizon control;
- autonomous outcome-blind evidence partitioning that separates repair fitting
  from protected validation without inspecting measured outcomes, plus archived
  online revisions that can be retained, rolled back on a fresh protected
  reserve, or reopen model search when both installed and archived models are
  inadequate;
- adaptive evidence governance and bounded revision lineage, where protected
  evidence count and intervention coverage scale with revision complexity and
  uncertainty, a shared fresh reserve compares multiple retained generations,
  and the controller can retain the current revision, roll back to its direct
  parent, branch to an older ancestor, or reopen structural search;
- active protected-evidence acquisition with probabilistic revision ancestry,
  where existing protected observations condition a posterior over retained
  revisions, missing causal regions are detected explicitly, safe validation
  probes are synthesized to fill both coverage and sample-count gaps, and
  lineage activation still requires the completed fresh reserve to pass the
  protected historical comparison;
- probabilistic revision composition with bounded active validation planning,
  where different retained revisions can explain different causal regions, only
  previously validated fragments are eligible for composition, two-step
  protected probes can separate single-revision and composite explanations, and
  a composite enters the lineage only after disjoint protected validation plus
  the adaptive protected-evidence budget;
- compositional revision maintenance with fragment-level reliability,
  leave-one-fragment-out blame attribution, repeated-blame quarantine,
  same-topology local repair or fragment-only rollback, structural preservation
  of healthy inherited fragments, fresh adaptive protected maintenance
  reserves, and immediate projection of the maintained composite back into live
  goals and receding-horizon control;
- active causal fragment-fault localization with Bayesian belief over competing
  fragment failures, safe diagnostic-probe selection by expected information
  gain under explicit risk/cost penalties, posterior resolution that cannot
  bypass repeated-blame quarantine, and fragment-specific provenance that
  preserves origin, active replacement, protected evidence, generation, and
  local rollback history across maintained composite revisions;
- multi-step bounded fault diagnosis and probabilistic local repair search,
  where no-fault, single-fragment, and bounded multi-fragment explanations
  compete in one posterior, short contingent diagnostic policies reduce
  expected terminal uncertainty, repair search opens only after every implicated
  fragment is both probabilistically resolved and independently quarantined,
  and a combinatorial local repair winner must remain best on a fresh adaptive
  protected reserve before installation;
- adaptive fault-model synthesis and repair uncertainty, where fragment fault
  magnitudes are inferred continuously from counterfactual contribution
  evidence instead of using one fixed fault scale, a bounded neighborhood of
  coefficient-scale and near-zero retirement models competes in a log-space
  posterior, several repair candidates remain live until validation evidence
  resolves them, and a bounded decision rule chooses diagnosis, validation,
  protected repair, retention, or abstention according to uncertainty and
  externally specified information/cost/risk values;
- bounded local structural mutation with joint parameter-structure uncertainty,
  where one validated local fragment at a time can compete across incumbent,
  coefficient-refit, linear, saturating, interaction, and latent-bias
  alternatives, safe experiments are selected by expected information gain,
  topology-changing candidates require independent protected validation, and
  only the protected winner may replace the live fragment while preserving
  provenance and terminal intent;
- bounded multi-fragment structural revision with contingent active validation,
  where several local structural uncertainties are composed into a bounded
  joint hypothesis space, depth-two diagnostic plans can stop early or choose a
  different second probe depending on the first observed outcome, and a joint
  topology revision can enter the live lineage only after the same multi-fragment
  structure wins on a disjoint adaptive protected reserve;
- active protected-validation planning and receding structural revision, where
  Mabojolu sequentially chooses causally relevant protected falsification probes,
  updates an independent log-space posterior over retained structural
  candidates, can reject the selected revision before the full installation
  reserve when another retained structure dominates, reopens bounded search
  when every retained candidate is inadequate, and still delegates installation
  authority to the existing adaptive protected validator;
- adaptive joint-candidate pruning and deeper receding structural diagnosis,
  where a larger bounded joint hypothesis set is updated one observation at a
  time, strongly contradicted candidates leave the active planning set through
  reversible audit events, the next structural experiment is replanned after
  every observation, and inadequacy of the retained set reopens structural
  synthesis instead of forcing selection from a collapsed model family;
- automatic bounded structural re-synthesis after candidate-family collapse,
  where accumulated non-protected evidence localizes which active fragments are
  actually mismatched, a broader finite grammar is searched only around those
  targets, healthy fragments are frozen, the fresh family is linked to the
  failed family through explicit generation provenance, and receding diagnosis
  restarts automatically before any independent protected installation check.

These are research building blocks. They do not by themselves establish AGI.

## Next central research direction

Infrastructure work should periodically return to the cognitive frontier rather
than becoming the project itself.

### Current milestone: automatic bounded structural re-synthesis after candidate-family collapse

Mabojolu G can now close the structural reopen-search handoff automatically.

Before v1.36, the v1.35 diagnosis loop could correctly conclude:

all-retained-structural-candidates-inadequate

and return:

reopen-search.

But a new candidate family still had to be supplied externally.

v1.36 now performs a bounded re-synthesis cycle from that collapse result.

The re-synthesis input is limited to:

- the currently active causal program;
- the failed bounded structural family;
- the accumulated non-protected collapse evidence;
- a finite structural grammar;
- explicit bounds on target count, local candidates, joint candidates, risk,
  cost, and diagnostic horizon.

Protected evidence is not allowed into this synthesis role.

Any overlap with explicitly excluded protected evidence fails closed before the
new family is generated.

The first task is local mismatch attribution.

For each active fragment Mabojolu constructs the same active program with that
fragment removed.

An observation is eligible as local synthesis evidence only when:

- the target fragment is actually activated by the intervention; and
- the predicted contribution from the rest of the active program is below the
  externally bounded background-magnitude ceiling.

This isolates local structural mismatch and reduces cross-fragment residual
contamination.

The controlled active program contains three fragments:

linear(y), coefficient about 0.60

linear(z), coefficient about 0.50

linear(q), coefficient about 0.20.

The changed controlled environment instead contains:

saturating(y), coefficient about 0.90

interaction(z,w), coefficient about 0.50

linear(q), coefficient about 0.20.

The stale family is intentionally narrower.

It contains only four linear y/z combinations.

Across the accumulated collapse evidence, the best stale candidate still has
mean-squared error about:

0.0147.

The collapse ceiling is:

0.005.

The v1.35 retained-family adequacy check therefore returns:

reopen-search.

v1.36 then analyzes fragment-local mismatch.

For y, accumulated isolated evidence covers:

y = 0.25
y = 0.50
y = 0.75
y = 1.00.

The actual saturating effects are approximately:

0.30
0.45
0.54
0.60.

The inherited linear(y)=0.60*y fragment has local mean-squared error about:

0.0133.

That exceeds the local re-synthesis threshold.

For z, isolated evidence fixes z at 1.00 while varying context w across:

0.25
0.50
0.75
1.00.

The actual interaction effects are:

0.125
0.25
0.375
0.50.

The inherited linear(z)=0.50*z fragment has local mean-squared error about:

0.0547.

That also exceeds the local threshold.

The healthy q fragment receives isolated q evidence and remains accurately
predicted.

It is not selected as a re-synthesis target.

The automatic target set is therefore:

y
+
z

while q is frozen.

Only those selected targets receive the broader local grammar.

The bounded local grammar can consider:

- incumbent;
- same-topology coefficient refit;
- linear;
- saturating;
- pairwise interaction using observed variables;
- latent-bias.

Local candidate counts and objective-gap retention remain externally bounded.

For y, the fresh search recovers a saturating candidate near coefficient:

0.90.

For z, the fresh search recovers interaction(z,w) near coefficient:

0.50.

The healthy q fragment is structurally identical in every new joint candidate.

v1.36 then composes the retained local alternatives into a bounded fresh joint
family.

The fresh family is not anonymous.

It receives an explicit candidate-family revision record containing:

- new family id;
- parent failed-family id;
- generation number;
- every failed candidate id;
- every targeted logical fragment id;
- every preserved healthy fragment id;
- every non-protected synthesis evidence id;
- every newly synthesized candidate id;
- every structural grammar kind represented.

The controlled family id advances from:

v1.35-stale-family

to:

v1.35-stale-family:resynthesis:1.

This creates provenance across candidate families before any new live model is
installed.

The accumulated collapse evidence is used only to generate the fresh family.

Receding diagnosis restarts with fresh diagnostic interventions.

v1.36 automatically extracts the variables represented by the new candidate
programs and synthesizes bounded unary and pairwise interventions using levels:

0.50
and
1.00.

A probe is retained only when the fresh candidates make materially different
predictions under that intervention.

Probe arity, total count, risk, cost, and observation noise remain bounded.

The v1.35 receding diagnostic engine then starts again over the fresh family.

It can:

- update candidate probabilities;
- prune contradicted fresh candidates reversibly;
- replan after every new observation;
- resolve one candidate;
- reopen search again if the new family is also inadequate;
- or abstain if no safe informative probe remains.

The controlled recovery resolves the candidate containing:

saturating(y), coefficient about 0.90

plus:

interaction(z,w), coefficient about 0.50

while preserving:

linear(q), coefficient about 0.20.

Resolution still does not authorize installation.

The accumulated collapse/synthesis evidence ids are recorded as repair evidence.

Every newly acquired re-diagnosis observation id is separately passed as
diagnostic evidence.

Both roles remain excluded from the fresh protected reserve.

The resolved re-synthesized candidate is then handed to the v1.34 active
protected-validation loop.

That loop independently chooses fresh protected falsification probes and still
delegates final installation authority to the existing protected local-repair
validator.

Only after the re-synthesized winner survives that independent reserve can
fragment provenance and the live world model change.

The controlled live planning path begins with the stale active model predicting:

finish -> about 1.00
boost-finish -> about 1.30

with terminal requirement:

progress >= 1.00.

The incumbent plan therefore selects:

finish.

After protected installation of the re-synthesized structure:

finish -> about 0.90
boost-finish -> about 1.05.

The previous finish action is no longer sufficient.

The revised live plan becomes:

boost-finish.

The receding-horizon controller also selects:

boost-finish.

Only y and z advance to replacement fragments.

The healthy q logical fragment keeps its original active implementation and
receives only the preserved-generation provenance transition.

The terminal goal contract remains unchanged.

The v1.36 loop is therefore:

retained structural family becomes absolutely inadequate
-> return reopen-search
-> inspect accumulated non-protected evidence
-> identify locally mismatched active fragments
-> freeze healthy fragments
-> broaden the bounded grammar only around mismatch targets
-> synthesize local alternatives
-> compose a new bounded joint family
-> create candidate-family generation provenance
-> synthesize fresh informative diagnostic probes
-> restart receding diagnosis automatically
-> resolve, abstain, or reopen again
-> convert the resolved candidate into the protected search surface
-> exclude collapse/synthesis and fresh diagnostic evidence from protection
-> run active protected validation
-> install only if the existing protected validator authorizes the same winner
-> advance fragment provenance
-> revise stale live child goals
-> continue receding-horizon control.

This remains bounded structural re-synthesis rather than unrestricted
self-programming. Re-synthesis can begin only after an explicit
all-candidates-inadequate collapse result, local target selection requires
minimum isolated evidence and minimum mismatch, target count is capped, the
grammar is finite, healthy fragments are frozen, local and joint candidate
counts are capped, probes are bounded and reversible, failed-family ancestry is
retained, and protected installation authority remains outside the re-synthesis
subsystem.

### Next experiments

The next experiments should measure:

1. repeated automatic re-synthesis generations when the first replacement
   family also collapses;
2. automatic resurrection of previously pruned candidates when a later regime
   returns to an earlier structural family;
3. change-point-aware evidence partitioning so stale pre-change observations do
   not contaminate fresh local grammar fitting;
4. candidate-family ancestry with probabilistic priors transferred between
   generations without allowing ancestry to bypass fresh diagnosis;
5. continuous parameter uncertainty inside automatically re-synthesized
   topologies;
6. bounded multi-term fragment mutation so a failed fragment can add or remove
   one causal term rather than replacing one whole one-term fragment;
7. structural grammar expansion learned from repeated family collapses while
   preserving explicit grammar-size and complexity bounds;
8. cross-domain transfer of re-synthesis targets and grammar priors across
   structurally equivalent renamed environments;
9. active experiment selection jointly optimized for target localization,
   family synthesis, and downstream protected-validation value;
10. whether repeated automatic re-synthesis preserves healthy-fragment
    invariance, evidence-role independence, terminal intent, hard risk ceilings,
    abstention, auditability, and zero unsafe irreversible execution.

The next central milestone is change-point-aware multi-generation structural
adaptation: Mabojolu should distinguish a genuinely new regime from noisy
contradiction, partition evidence around the inferred change point, choose
between resurrecting a previously successful family and synthesizing a new
bounded family, and maintain auditable ancestry across repeated structural
generations.

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
