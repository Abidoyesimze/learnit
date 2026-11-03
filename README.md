# LearnIt (beta)

Learn French or Spanish in short daily lessons and earn small G$ rewards for real progress. Built on [GoodDollar](https://docs.gooddollar.org) and Celo.

> **Beta.** The smart contracts are unaudited. Caps and stake limits are tiny on purpose. Do not put in money you cannot lose.

## What it does

1. **Sign in** with Privy: email (gets an embedded wallet) or connect a wallet such as GoodWallet.
2. **Onboard**: pick French or Spanish, see how it works.
3. **Verify** with GoodDollar face verification. Anyone can do lessons for free; only verified users can claim, earn or stake.
4. **Claim your daily G$ UBI** on the home screen, then go straight to today's lesson.
5. **Do a lesson** (10 to 12 exercises: multiple choice, translate by picking words, match pairs). Grading is server-side. Pass at 80% accuracy and 90 seconds or more.
6. **Earn**: a pass returns a signed EIP-712 voucher you redeem on the `RewardsPool` contract (max 3 lessons a day, plus a first-time checkpoint pass).
7. **Stake** G$ on a 7-day streak challenge with `StreakVault`. Finishers get their stake back plus a share of forfeits.

Full product spec: [`docs/LearnIt-PRD-v0.2.docx`](docs/LearnIt-PRD-v0.2.docx).

## Repository layout

```
frontend/    Next.js 14 app (App Router, Tailwind, PWA). Pages, components, client hooks.
             app/api/* are thin route files that re-export handlers from the backend.
backend/     Server logic as a workspace package (@learnit/backend):
               src/handlers/   one file per API endpoint
               src/             auth, grading, streaks, vouchers, cohorts, identity, Prisma client
               src/content/     lesson JSON and its typed schema (fr, es)
               prisma/          database schema
               scripts/         content generator, cohort finaliser, Neon check
               tests/           vitest
contracts/   Foundry project: RewardsPool, StreakVault, tests, deploy scripts
docs/        PRD
neon.ts      Neon project config (Postgres + a sample function)
.env         one shared env file at the repo root (never committed)
```

The backend still deploys with the frontend: Next.js route handlers call into `@learnit/backend`, so there is a single Vercel deployment and no separate server to run.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript), Tailwind, installable PWA, Vercel |
| Auth and wallet | Privy with wagmi and viem on Celo (chainId 42220) |
| Backend | Route handlers in `@learnit/backend`, Privy access token checked on every route |
| Database | Neon Postgres via Prisma (pooled URL for the app, direct URL for schema pushes) |
| Contracts | Solidity 0.8.x, Foundry, OpenZeppelin |
| Identity and UBI | `@goodsdks/citizen-sdk`, GoodDollar Identity contract on Celo |

Design: white, black and one yellow accent. Geist type. Hugeicons. Mobile first.

## Setup

Requirements: Node 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), a Postgres database (Neon free plan works), a Privy app.

```bash
git clone --recurse-submodules https://github.com/sammajayi/learnit.git
cd learnit
npm install
cp .env.example .env     # then fill in the values below
npm run db:push          # create tables
npm run dev              # http://localhost:3000
```

Useful commands (from the repo root):

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Run the frontend |
| `npm run check` | Type-check backend and frontend |
| `npm test` | Backend tests (grading, streaks) |
| `npm run test:contracts` | Foundry tests |
| `npm run db:push` | Push the Prisma schema (uses the direct Neon URL) |
| `npm run content` | Regenerate lesson JSON from `backend/scripts/vocab.ts` |
| `npm run neon:check -w @learnit/backend` | Write and read back a row in every table |

If `db:push` fails with "Can't reach database server", the database is waking up or the link is slow. Add `&connect_timeout=60` to `DATABASE_URL_UNPOOLED` and retry.

### Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (schema pushes) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id (public) |
| `PRIVY_APP_SECRET` | Privy app secret (server only) |
| `APP_SECRET` | Random string used to sign lesson start tokens |
| `SIGNER_PRIVATE_KEY` | Key that signs reward vouchers and marks finishers. Server only. Never commit it |
| `GASDROP_PRIVATE_KEY` | Funded wallet that sends the one-time CELO top-up. Tiny balance only |
| `GAS_TOPUP_CELO` | CELO sent per verified user, once (default 0.05) |
| `LESSON_REWARD_G`, `CHECKPOINT_REWARD_G`, `DAILY_CAP_G` | Reward sizes in G$. Keep `DAILY_CAP_G` equal to the pool's `dailyCap` |
| `VAULT_DEPLOY_BLOCK` | Block the `StreakVault` was deployed at (for reading Staked events) |
| `NEXT_PUBLIC_CELO_RPC_URL` | Celo RPC endpoint |
| `NEXT_PUBLIC_REWARDS_POOL_ADDRESS`, `NEXT_PUBLIC_STREAK_VAULT_ADDRESS` | Deployed contracts |
| `NEXT_PUBLIC_GOODDOLLAR_TOKEN_ADDRESS`, `NEXT_PUBLIC_IDENTITY_ADDRESS` | G$ and GoodDollar Identity (defaults are Celo mainnet) |

Never commit `.env`. Only `.env.example` is tracked. Privy: enable **Email** login and add your local and production URLs as allowed origins.

### Contracts

```bash
cd contracts
forge build
forge test
```

Deploy (Celo testnet with dev G$, or mainnet with tiny caps):

```bash
export DEPLOYER_PRIVATE_KEY=... ADMIN=0x... GUARDIAN=0x... SIGNER=0x... UBI_ADDRESS=0x...
forge script script/DeployTestnet.s.sol --rpc-url $CELO_TESTNET_RPC_URL --broadcast   # also needs DEV_IDENTITY
forge script script/DeployMainnet.s.sol --rpc-url $CELO_RPC_URL --broadcast --verify
```

Then fund the pool (`approve` + `deposit`), call `createCohort(start, min, max)` as admin, and put the printed addresses in `.env`. `ADMIN` and `GUARDIAN` should be a Safe multisig on mainnet.

`RewardsPool` pays EIP-712 vouchers with daily and weekly caps per whitelisted root and a global daily budget. `StreakVault` runs 7-day cohorts; the signer marks finishers and settles 70% of forfeits to finishers, 20% to the pool, 10% to the UBI address. G$ transfer fees are handled by recording the amount actually received.

## Operations

- **Finalise a stake cohort** after it ends: `npm run cohort:finalize -w @learnit/backend -- <id>` prints who finished all 7 days (dry run). Add `--send` to call `markFinished` and `settle` with the signer key.
- **Known MVP limits:** lesson answers are checked one at a time for instant feedback, so a determined user could probe answers; the 80% and 90-second rules, the per-lesson daily reward limit and the pool's caps bound the damage. The signer key lives in an env var; move it to a KMS before raising limits.

## Contributing

Contributions are welcome, especially lesson content reviews by native French and Spanish speakers.

1. Fork the repo and create a branch: `git checkout -b feat/short-name`.
2. Keep changes small and focused. One idea per pull request.
3. Run `npm run check` and `npm test` (and `npm run test:contracts` if you touched contracts) before pushing.
4. Open a pull request that says what changed and why. Add screenshots for UI changes.

Ground rules:

- **No secrets** in commits, issues or screenshots.
- **Grading stays on the server.** The client never decides pass or fail.
- **Contracts:** every state change emits an event, and changes need Foundry tests (fuzz where there is math).
- **Design:** white, black and yellow only. Yellow is a fill behind black text, never text on white. One icon set (Hugeicons). Respect `prefers-reduced-motion`.
- **Copy:** plain and short. No em dashes.
- **Lesson content:** follow the typed schema in `backend/src/content/schema.ts`. Spanish is Latin American Spanish. Native-speaker review is required before merge.

Found a security issue in the contracts or voucher flow? Please do not open a public issue. Email the maintainer instead.

## License

MIT (to be confirmed by the maintainer).
