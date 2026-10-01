# job-agent-dashboard

Private dashboard for the personal job application agent.

- **Live data, static site**: everything is generated from `jobagent/data/jobs.db`
  and the tailored packets — no hardcoded personal data.
- **Rebuild**: `python3 ~/workspace/jobagent/site/build.py --profile profiles/akash --out <this dir>`
- **Deploy**: push to `main`; Cloudflare Pages auto-publishes.

## What's on it

- Pipeline funnel: found → matched → tailored → in review → submitted
- Score distribution across all matched postings
- Searchable/sortable table of every scored match
- Company coverage (35 boards)
- Tailored résumé + cover letter packets with match rationale
- Application ledger with per-application status
