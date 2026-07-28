# Babel

**An inspectable multi-model decision engine for structured critique, revision, and synthesis.**

[Live prototype](https://the-forge-rose.vercel.app/) | [LinkedIn](https://www.linkedin.com/in/leenalzubi) | [GitHub](https://github.com/leenalzubi)

Babel helps people stress-test consequential decisions with multiple AI models. Instead of placing several long answers side by side, it gives each voice a distinct role, separates independent reasoning from critique, makes revisions visible, and turns the result into a structured decision artifact.

The product thesis is very simple:

> More model output does not automatically produce a better decision. Structured disagreement can reveal hidden assumptions, preserve useful dissent, and make a recommendation easier to inspect.

Babel is a personal product project by **Leen Al-Zu'bi**, a Product Manager. It is an evolving prototype, not a claim that model consensus establishes truth.

---

## The problem

A single model can sound confident even when its reasoning is incomplete. Asking several models can help, but a conventional comparison interface often creates a new problem: more text for the user to reconcile manually.

The user still has to determine:

* where the answers genuinely agree
* which assumptions are driving disagreement
* whether criticism changed anyone's position
* which claims are supported, inferred, or unresolved
* whether the synthesis discarded an important minority view
* what action should follow

Babel is designed around that interpretation work.

---

## How Babel works

The flagship experience is a fixed decision stress-test with three visible rounds.

### 1. Frame the decision

The user enters a decision or proposal and may add criteria such as reversibility, user trust, error cost, feasibility, or time to learn.

### 2. Independent positions

Each model responds independently, without seeing the other answers. This preserves distinct starting positions and reduces immediate anchoring.

### 3. Cross-examination

Each voice challenges specific claims from the others. The purpose is not to manufacture disagreement; it is to expose weak evidence, hidden assumptions, incompatible criteria, and execution risks.

### 4. Revision

Each voice identifies what it preserved, narrowed, amended, or withdrew after critique. Babel keeps the earlier response available so the user can inspect what changed and why.

### 5. Synthesis

The arbiter produces a decision artifact rather than a generic summary:

* what the voices agree on
* the central disagreement
* the strongest support
* the weakest assumptions
* the minority report
* what would change the answer
* the recommended next step

### 6. Human-owned output

The final artifact belongs to the user. Babel is intended to support judgment, not replace it.

---

## Why this is different from three chat windows

Babel's product vocabulary is built around reasoning, not message containers.

| Primitive              | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| **Claim**              | A discrete assertion attributable to one response          |
| **Evidence supplied**  | A citation or rationale supplied in support of a claim     |
| **Counterclaim**       | A direct challenge to a specific claim                     |
| **Position change**    | A claim preserved, narrowed, amended, or withdrawn         |
| **Unresolved issue**   | A point the voices could not reconcile                     |
| **Minority report**    | A consequential dissent the synthesis could otherwise hide |
| **Decision criterion** | A condition the user says matters                          |
| **Unknown**            | Something the debate did not establish                     |

The original model response remains the source record. Any structured claim layer is an interpretation over that response and must be allowed to fail without destroying the answer.

---

## Product principles

### The human owns the conclusion

Babel prepares better material for judgment. It does not present model agreement as authority.

### The record and the interpretation stay distinct

Structured claims, critiques, and revisions should always lead back to the original model response.

### Disagreement is more useful than volume

The interface prioritizes why positions differ, what changed, and what remains unresolved.

### Partial failure is normal

A failed model call should not automatically destroy a useful debate. Completed work is preserved, and retries operate at the narrowest viable scope.

### Every visual distinction must tell the truth

Color and form communicate origin, state, tension, or uncertainty—not decoration alone.

### Depth beats breadth

Babel is proving one complete decision flow before expanding into a broad agent platform.

---

## Cognitive roles

Babel presents cognitive roles while keeping the underlying model identity visible.

The initial role set is:

* **Skeptic** — looks for failure modes and unsupported assumptions
* **Researcher** — prioritizes evidence, source quality, and what remains unverified
* **Operator** — focuses on feasibility, constraints, reversibility, and execution

Roles are prompt configurations, not inherent model capabilities or professional credentials. Model identity should remain visible in the interface, provenance, and exported artifacts.

---

## Epistemic honesty

Babel is intentionally careful about what the interface claims.

* Model agreement is not proof.
* A model-supplied citation is not automatically verified.
* A cognitive role is not an expert credential.
* The arbiter is another model and may omit or distort arguments.
* Structured extraction may misread prose and must fall back safely.
* High-stakes decisions still require appropriate human expertise.

Babel avoids a single confidence score. It instead aims to expose inspectable states such as:

* citation supplied
* source not independently checked
* inference
* uncited factual claim
* contested claim
* contradiction detected
* insufficient evidence
* unresolved disagreement

---

## Current status

Babel is under active development. The public prototype and the target product system are not yet identical.

### Implemented in the live prototype

* multi-model debate orchestration
* independent first-round responses
* critique and later-round model calls
* final synthesis
* partial timeout handling
* best-effort auxiliary analysis and logging
* public Vercel deployment

### In progress

* the Babel visual and interaction system
* scoped debate, stage, and voice-level error recovery
* role-based voices with visible model identity
* structured claims with raw-response fallback
* explicit revision states
* traceable synthesis findings
* responsive and accessibility passes

### Planned product proofs

* **Synthesis lineage:** inspect the claims, critiques, and revisions behind each conclusion
* **Babel Lab:** compare Babel with a single-model answer and side-by-side model responses
* **Conclusion stability:** test whether a recommendation changes when the synthesis is repeated or one voice is removed

This section should be updated as features move from specification to working software.

---

## Failure handling

Babel treats multi-model failure as partial by default.

The error system distinguishes:

* **what happened** — timeout, rate limit, token limit, authentication, provider outage, and other causes
* **what failed** — one voice, a round, synthesis, audit, or infrastructure
* **whether useful work can continue** — running, degraded, blocked, complete with gaps, or failed
* **what recovery is appropriate** — retry one voice, retry one stage, wait, edit the prompt, fix configuration, or continue with available responses

Key rules:

* one failed model should not automatically end the debate
* successful responses remain visible
* retries do not rerun successful models unnecessarily
* synthesis can fail independently from the voices
* optional analysis can fail without invalidating the debate
* logging failure does not become debate failure
* stale or cancelled responses must not overwrite newer attempts

---

## Evaluation

Babel should earn its complexity through evidence.

The planned evaluation compares three conditions using the same decision prompt:

1. one strong model answering normally
2. multiple models answering independently side by side
3. Babel's structured debate

The evaluation focuses on whether Babel improves:

* identification of the central disagreement
* discovery of hidden assumptions
* preservation of consequential dissent
* visibility of substantive revision
* evidence honesty
* actionability
* traceability
* comprehension relative to reading burden

Operational measures include latency, model calls, token usage, cost, extraction failures, partial completion, and synthesis traceability.

Cases where Babel does not outperform the simpler baseline are part of the result, not something to hide.

---

## Design language

Babel's visual system combines three influences around one shared principle: form should serve the person and the argument.

* **Base:** material honesty, warmth, shelter, and local architectural intelligence
* **Restraint:** clarity, muted surfaces, generous reading space, and function-first composition
* **Weight:** measure, courtesy, proportion, and room for dissent

The system uses warm limewash surfaces, deep blue for voice and interaction, ochre for tension, and a restrained architectural niche for each model. The visual identity is intended to make Babel memorable without overwhelming the reasoning.

---

## Architecture

The target product flow is:

```text
User decision and criteria
            ↓
Independent model responses
            ↓
Structured claim extraction
     ↘ raw-response fallback
            ↓
Claim-specific cross-examination
            ↓
Explicit revision
            ↓
Traceable synthesis
            ↓
Human-edited decision artifact
```

Important architectural boundaries:

* raw responses are stored before structured interpretation
* extraction can degrade independently from the response
* every round preserves stable model and role identity
* model failures are isolated where possible
* synthesis does not overwrite source material
* optional evaluation and logging are separate from debate success

---

## Local development

The exact commands should follow the package manager recorded in the repository lockfile. With npm:

```bash
git clone <repository-url>
cd <repository-directory>
npm install
cp .env.example .env.local
npm run dev
```

Then open the local URL printed by the development server.

### Product docs in this repo

* Inspectable synthesis lineage: [docs/SYNTHESIS_LINEAGE.md](docs/SYNTHESIS_LINEAGE.md)
* Babel Lab (public evaluation): [docs/BABEL_LAB.md](docs/BABEL_LAB.md) (routes `/lab`, `/lab/methodology`, `/lab/:caseSlug`)
* Conclusion stability check: [docs/CONCLUSION_STABILITY.md](docs/CONCLUSION_STABILITY.md)
* Environment easter eggs (spoilers): [docs/EASTER_EGGS.md](docs/EASTER_EGGS.md)

### Environment configuration

Babel uses GitHub Models for model calls.

The existing prototype may use:

```bash
# Local development only, when the client calls GitHub Models directly
VITE_GITHUB_TOKEN=

# Preferred for production through the server-side proxy
GITHUB_MODELS_PAT=
```

Use the repository's `.env.example` as the source of truth for all active variables.

**Never commit real tokens.** Variables prefixed with `VITE_` are exposed to browser code and should not contain a production secret. Public deployments should route model calls through a server-side endpoint using a protected environment variable.

Supabase, when configured, is used for best-effort logging or persistence. Debate execution should not depend on Supabase availability.

---

## Security and privacy

Before deploying or publishing changes:

* keep `.env*` files out of version control, except `.env.example`
* never expose a GitHub PAT, Supabase service-role key, or request authorization header
* inspect git history if a secret was ever committed
* do not publish private prompts, responses, or user identifiers as evaluation data
* sanitize rendered model content
* validate model-produced structured references before using them
* keep public evaluation cases explicitly opt-in and versioned

---

## Roadmap

### Flagship prototype

* complete one stress-test flow end to end
* preserve raw responses
* validate structured claims and counterclaims
* make revisions explicit
* produce one traceable synthesis
* handle partial model failure gracefully
* export a lightweight decision memo

### Evaluation release

* publish a versioned evaluation methodology
* compare Babel against credible baselines
* rotate role-to-model assignments
* measure latency, cost, comprehension, revision quality, and dissent preservation
* publish both positive and negative cases

### Later, only if evidence earns it

* additional debate modes
* configurable roles
* stronger source retrieval and claim verification
* richer memo editing and collaboration
* saved evaluations and history
* defensible influence or disagreement analysis

---

## Contributing

Babel is currently a personal product exploration. Reproducible bug reports, accessibility issues, evaluation cases, and thoughtful critiques of the product thesis are welcome.

When opening an issue, include:

* the prompt or a safely redacted equivalent
* the debate stage where the problem occurred
* the selected models and roles
* expected and actual behavior
* screenshots or console output with secrets removed

---

## Project intent

Babel is not intended to make AI debate look intelligent. It is intended to test whether structured disagreement can make AI-assisted decisions more inspectable, more honest about uncertainty, and more useful to the person who remains responsible for the outcome.

---

Built by **Leen Al-Zu'bi**, a Product Manager, as a personal project.
[LinkedIn](https://www.linkedin.com/in/leenalzubi) [GitHub](https://github.com/leenalzubi)
