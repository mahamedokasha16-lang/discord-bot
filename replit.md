# Discord Bot Starter

بوت Discord مبدئي بأوامر Slash أساسية، جاهز للتشغيل والتوسعة.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/scripts run bot` — run the Discord bot
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `scripts/src/discord-bot.ts` — Discord client, Slash commands, and interaction handling
- `scripts/package.json` — bot run command and Discord.js dependency

## Architecture decisions

- Uses Discord Slash commands instead of message-prefix commands.
- Registers commands globally so the bot can be invited to any server without a second configuration value.
- Reads `DISCORD_BOT_TOKEN` only from Replit Secrets; the token is never stored in source code.

## Product

- `/ping` checks that the bot is online.
- `/help` lists available commands.
- `/server` shows basic information about the current server.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
