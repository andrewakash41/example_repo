# Quorum Investment Desk

A multi-agent investment research app. You give it a brief (market, amount, horizon, risk, asset classes) and it convenes a committee of AI agents that research, debate, score and sign off one plan.

## Two ways to run it

| Where | Engine | Live web research |
|---|---|---|
| Claude artifact (published from `app.html`) | Claude built-in, no key | No. Claude cannot browse from inside an artifact, so figures come from model memory and are flagged for you to verify. |
| Standalone `index.html` in any browser | Your OpenRouter or OpenAI key | Yes. Agents search the web and every source is audited against the trusted list. |

Artifacts cannot call outside services, so API keys only work in the standalone copy. Open `index.html` directly, or serve the folder (`python3 -m http.server`).

## The committee

- **Quick** (4 agents): Lead Researcher, Portfolio Architect, Critic, Chief Investment Officer.
- **Standard** (about 8): Macro Strategist, Growth and Stability Analysts, Risk Officer, Architect, Critic, Presiding Judge, CIO.
- **Deep** (11 plus one analyst per asset class): adds a Fact Checker, Bull and Bear Advocates, and three judges (capital safety, growth, cost and tax).

Agents in the same stage run in parallel. Each stage receives a compact digest of earlier findings instead of full transcripts, which keeps token use down.

## Model routing

- **Smart** (default): balanced models research and draft; the strongest model handles the critic, judges and final verdict.
- **Maximum rigor**: strongest model everywhere.
- **Economy**: strongest model for the final verdict only.

With an API key, "Check key and load models" reads the provider's model list and fills in the newest suitable model per tier. You can overwrite any of the three.

## Trust and accuracy safeguards

- A per-market allowlist of regulators, exchanges, data providers and financial press (`MARKETS` in `app.html`). Strict mode drops the press.
- With OpenAI, web search is restricted to the allowlist at the API level. With OpenRouter, agents are told to use it and the page then checks every cited URL.
- In live mode, any figure without a trusted source is dropped before later agents see it, and listed as rejected in the source audit.
- Growth projections are calculated by the page from the committee's return ranges, not by a model.
- Automatic checks flag allocations that do not sum to 100%, breaches of the Risk Officer's limits, and picks outside your allowed asset classes.

## Development

`app.html` is the single source. Run `./build.sh` to regenerate `index.html` after editing it.

The OpenRouter and OpenAI request paths were written against their documented API shapes but have not been exercised with a real key yet.

This is a research aid, not licensed financial advice.
