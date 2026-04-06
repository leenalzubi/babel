# The Forge

A Vite + React app that runs a multi-agent debate via GitHub Models and optional API clients, then synthesizes a unified answer.

## Setup

1. Clone the repository and open the project directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the project root (same folder as `package.json`) and add your keys. At minimum, set **`VITE_GITHUB_TOKEN`** for the default GitHub Models flow. Optional keys such as `VITE_ANTHROPIC_API_KEY` and `VITE_OPENAI_API_KEY` are documented in the in-app Settings drawer.

   ```
   VITE_GITHUB_TOKEN=your_token_here
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open the URL shown in the terminal (typically `http://localhost:5173`).

## Branding note

**OpenAI API is branded as Copilot in the UI** where that provider appears in labels or copy.

## Security warning

This app is intended as a **demo**. Vite injects `VITE_*` environment variables into the **client bundle**, so anyone who can load the built site can potentially extract those values. Do **not** ship production secrets this way; use a backend or other server-side pattern for real credentials.

## Scripts

- `npm run dev` — development server  
- `npm run build` — production build to `dist/`  
- `npm run preview` — serve the production build locally  
- `npm run lint` — ESLint
