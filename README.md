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
| `SIGNER_PRIVATE_KEY` | Key that signs reward vouchers and marks finishers. Server only. Never commit it |
| `GASDROP_PRIVATE_KEY` | Funded wallet that sends the one-time CELO top-up. Tiny balance only |
| `NEXT_PUBLIC_CELO_RPC_URL` | Celo RPC endpoint |
| `NEXT_PUBLIC_REWARDS_POOL_ADDRESS` | Deployed `RewardsPool` |
| `NEXT_PUBLIC_STREAK_VAULT_ADDRESS` | Deployed `StreakVault` |
| `NEXT_PUBLIC_GOODDOLLAR_TOKEN_ADDRESS` | G$ (or dev G$ on testnet) |
| `NEXT_PUBLIC_IDENTITY_ADDRESS` | GoodDollar Identity contract |

Never commit `.env`. Only `.env.example` is tracked.

### Contracts

```bash
cd contracts
forge install            # OpenZeppelin
forge build
forge test
```

Deploy scripts for Celo testnet (dev G$) and mainnet are in `contracts/script`. See the comments at the top of each script for the env vars it needs.

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
