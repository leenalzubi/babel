# Babel

Babel is an experiment to test how AI models interact with one another in a debate.

Three models receive the same prompt without seeing each other's responses, then they launch into a debate.

In round two, each model reads the other two responses and identifies what it agrees with, challenges, and finds missing. In round three, each model responds directly to the challenges directed at it, and like any natural conversation, concessions are made, positions harden, and genuine disagreement becomes visible. In round four, each model states its final position. A synthesis pass then reconciles all four rounds into one answer.

---

## Why

When models trained on similar data still diverge on the same prompt, that divergence is data. It points to genuinely contested knowledge, differing reasoning styles, and the limits of what these systems actually know versus what they confidently assert.

Built by Leen Al-Zu'bi, Senior Product Manager at Softchoice, as a self-directed study in AI research. No lab or grant, just genuine curiosity about how these models think and where they disagree.

---

## The data

Every debate is logged to a shared open dataset visible in the Findings tab. Only the first 120 characters of each prompt are stored. The dataset is public. If you run a debate, you contribute to it.

---

## Stack

- React + Vite
- GitHub Models API (GPT-4o mini, Phi-4, Mistral Small)
- Supabase (Postgres + pgvector)
- Vercel

---

## Running locally
```bash
git clone https://github.com/leenalzubi/the-forge.git
cd the-forge
npm install
npm test
```

Inspectable synthesis lineage: [docs/SYNTHESIS_LINEAGE.md](docs/SYNTHESIS_LINEAGE.md).

Babel Lab (public evaluation): [docs/BABEL_LAB.md](docs/BABEL_LAB.md): routes `/lab`, `/lab/methodology`, `/lab/:caseSlug`.

Conclusion stability check: [docs/CONCLUSION_STABILITY.md](docs/CONCLUSION_STABILITY.md).

Create a `.env.local` file:
```
VITE_GITHUB_TOKEN=your_github_pat_with_models_read_scope
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
```bash
npm run dev
```

---

## Contact

Leen Al-Zu'bi: https://www.linkedin.com/in/leenalzubi/
Feedback, research partnerships, and collaboration welcome.
