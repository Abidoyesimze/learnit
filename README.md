# LearnIt (beta)

Learn French or Spanish in short daily lessons and earn small G$ rewards for real progress. Built on [GoodDollar](https://docs.gooddollar.org) and Celo.

> **Beta.** The smart contracts are unaudited. Caps and stake limits are tiny on purpose. Do not put in money you cannot lose.

## What it does

1. **Log in** with Privy: Google (gets an embedded wallet) or connect a wallet such as GoodWallet.
2. **Verify** with GoodDollar face verification. Anyone can do lessons for free; only verified users can claim, earn or stake.
3. **Claim your daily G$ UBI** from the home screen, then go straight to today's lesson.
4. **Do a lesson** (10 to 12 exercises: multiple choice, translate by picking words, match pairs). Grading is server-side. Pass at 80% accuracy and 90 seconds or more.
5. **Earn**: a pass returns a signed EIP-712 voucher you redeem on the `RewardsPool` contract (max 3 lessons a day, plus a first-time checkpoint pass).
6. **Stake** G$ on a 7-day streak challenge with `StreakVault`. Finishers get their stake back plus a share of forfeits.

Full product spec: [`docs/LearnIt-PRD-v0.2.docx`](docs/LearnIt-PRD-v0.2.docx).

## Stack

| Layer | Choice |
|---|---|
| Web | (SSR, React islands), Tailwind, installable PWA, deployed on Vercel |
| Auth and wallet | Privy (`@privy-io/react-auth`) with wagmi and viem on Celo (chainId 42220) |
| API | Next.js route handlers under `app/api`, Privy access token checked on every route |
| Database | Postgres (Neon or Railway) via Prisma |
| Contracts | Solidity 0.8.x, Foundry, OpenZeppelin, in `/contracts` |
| Identity and UBI | `@goodsdks/citizen-sdk`, GoodDollar Identity contract on Celo |

Design: white, black and one yellow accent. Geist type. Mobile first.

## Project layout

```
app/                Next.js App Router pages and /api route handlers
components/         React components
lib/                server and client helpers (auth, grading, gooddollar, vouchers)
content/            lesson JSON for fr and es
prisma/             schema
contracts/          Foundry project (RewardsPool, StreakVault)
docs/               PRD
```

## Setup

Requirements: Node 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), a Postgres database, a Privy app.

```bash
git clone https://github.com/sammajayi/learnit.git
cd learnit
npm install
cp .env.example .env     # then fill in the values below
npm run db:push          # create tables
npm run dev              # http://localhost:3000
```

### Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id (public) |
| `PRIVY_APP_SECRET` | Privy app secret (server only) |
| `APP_SECRET` | Random string used to sign lesson start tokens (falls back to the signer key) |
| `LESSON_REWARD_G`, `CHECKPOINT_REWARD_G`, `DAILY_CAP_G` | Reward sizes in G$. Keep `DAILY_CAP_G` equal to the pool's `dailyCap` |
| `VAULT_DEPLOY_BLOCK` | Block the `StreakVault` was deployed at (for reading Staked events) |
| `SIGNER_PRIVATE_KEY` | Key that signs reward vouchers and marks finishers. Server only. Never commit it |
| `GASDROP_PRIVATE_KEY` | Funded wallet that sends the one-time CELO top-up. Tiny balance only |
| `GAS_TOPUP_CELO` | CELO sent per verified user, once (default 0.05) |
| `NEXT_PUBLIC_CELO_RPC_URL` | Celo RPC endpoint |
| `NEXT_PUBLIC_REWARDS_POOL_ADDRESS` | Deployed `RewardsPool` |
| `NEXT_PUBLIC_STREAK_VAULT_ADDRESS` | Deployed `StreakVault` |
| `NEXT_PUBLIC_GOODDOLLAR_TOKEN_ADDRESS` | G$ (or dev G$ on testnet) |
| `NEXT_PUBLIC_IDENTITY_ADDRESS` | GoodDollar Identity contract |

Never commit `.env`. Only `.env.example` is tracked.

### Contracts

```bash
git submodule update --init --recursive   # forge-std and OpenZeppelin
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

Contract notes: `RewardsPool` pays EIP-712 vouchers with daily and weekly caps per whitelisted root and a global daily budget. `StreakVault` runs 7-day cohorts; the signer marks finishers and settles 70% of forfeits to finishers, 20% to the pool, 10% to the UBI address. G$ transfer fees are handled by recording the amount actually received.

## Operations

- **Finalise a stake cohort** after it ends: `npx tsx --env-file=.env scripts/finalize-cohort.ts <id>` prints who finished all 7 days (dry run). Add `--send` to call `markFinished` and `settle` with the signer key.
- **Known MVP limits:** lesson answers are checked one at a time for instant feedback, so a determined user could probe answers; the 80% and 90-second rules, per-lesson daily reward limit and the pool's caps bound the damage. The signer key lives in an env var; move it to a KMS before raising limits.

## Contributing

Contributions are welcome, especially lesson content reviews by native French and Spanish speakers.

1. Fork the repo and create a branch: `git checkout -b feat/short-name`.
2. Keep changes small and focused. One idea per pull request.
3. Run `npm run check` and `npm test` (and `forge test` if you touched contracts) before pushing.
4. Open a pull request that says what changed and why. Add screenshots for UI changes.

Ground rules:

- **No secrets** in commits, issues or screenshots.
- **Grading stays on the server.** The client never decides pass or fail.
- **Contracts:** every state change emits an event, and changes need Foundry tests (fuzz where there is math).
- **Design:** white, black and yellow only. Yellow is a fill behind black text, never text on white. One icon set (Phosphor). Respect `prefers-reduced-motion`.
- **Copy:** plain and short. No em dashes.
- **Lesson content:** follow the typed schema in `content/schema.ts`. Spanish is Latin American Spanish. Native-speaker review is required before merge.

Found a security issue in the contracts or voucher flow? Please do not open a public issue. Email the maintainer instead.

## License

MIT (to be confirmed by the maintainer).
