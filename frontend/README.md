# cyber_pep -- frontend

Interface web du service PEP (Predicted Exploit Probability) : enrichissement de CVE et
dashboard de monitoring de drift. Vite + React + TypeScript + Tailwind + Apache ECharts, bilingue FR/EN.

Codestyle/lint alignes sur le standard barkahub (ESLint flat config type-aware + Prettier).

```bash
npm install
npm run dev            # http://localhost:5173 (API attendue sur VITE_API_URL, defaut http://localhost:8000)
npm run lint           # ESLint
npm run format:check   # Prettier
npm run typecheck      # tsc
npm run build          # build de production
```

Voir `docs/lancer.md` et `docs/plan-service-monitoring.md` a la racine du repo.
