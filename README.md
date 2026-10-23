# 🔔 Bells Village Rush — 20-Second Turbo Sprint

A fast-paced arcade game for the Bellscoin community. Catch BELLS bags, avoid Redd, survive 20 seconds and compete in your Telegram group.

## Quick start

- Open `index.html` in any static web host. A normal browser opens in **practice mode** with a local personal record.
- **Telegram group rankings are not live until a Worker, D1 database and bot are configured and deployed.** The interface explains this.

## New rules

- 20-second rounds, replacing the 30-second preview (original game was 60 seconds).
- BELLS bags appear every ~260ms at first, ~195ms after 7 seconds, and ~135ms during the final 5-second Turbo Mode; they fall much faster.
- Smaller Redd (close to bag size) first appears around 1.25 seconds; then every ~1.55–2.65 seconds, accelerating to ~1–1.8 seconds during Turbo Mode. He can fall straight or diagonally from either side and bounce off screen edges.
- One wrong tap on Redd immediately ends the round. **Failed rounds are not ranked.**
- Timer, share messages, group bot commands and backend verification now all use **20 seconds**.
- No 12-bag limit. Finish all 20 seconds to qualify for the leaderboard.
- `/play` sends a play link in the group; `/top` or `/leaderboard` shows the group's top 10.

## Project structure

- `index.html`: full game frontend; `config.js`: public Worker endpoint (empty by default).
- `images/`: game art and original custom Redd SVG.
- `worker/src/index.js`: Worker API and Telegram bot webhook handler.
- `worker/schema.sql`: D1 database tables.
- `worker/wrangler.example.toml`: Cloudflare deploy configuration template.

## Deployment: Cloudflare Worker + D1

**Do not commit bot tokens or Cloudflare credentials to GitHub.**

1. Install Wrangler (`npm install -g wrangler`) and sign in (`wrangler login`).
2. In the `worker` directory, create your database: `wrangler d1 create bells-village-rush`.
3. Copy `wrangler.example.toml` to `wrangler.toml`, insert the database ID and set `APP_ORIGIN` to the canonical HTTPS game origin (recommended `https://coinbells.github.io`).
4. Apply tables: `wrangler d1 execute bells-village-rush --remote --file=schema.sql`.
5. Store secrets through Wrangler: `wrangler secret put TELEGRAM_BOT_TOKEN`, `wrangler secret put GROUP_LINK_SECRET`, `wrangler secret put TELEGRAM_WEBHOOK_SECRET`. Use strong unique random values; the Telegram webhook secret must match Telegram's allowed 1–256 ASCII letters, digits, `_`, or `-`.
6. Deploy with `wrangler deploy`; update root `config.js` with the Worker HTTPS base URL, and deploy the game to GitHub Pages.
7. In [@BotFather](https://t.me/BotFather), configure the bot's **Main Mini App** to point to `https://coinbells.github.io/BellsGame/`, so links such as `https://t.me/BellsCoinGameBot?startapp=global` open the game.
8. **Check the existing Telegram bot webhook/polling before changing it.** A bot can have only one active webhook. If you migrate this bot to the Worker, use Telegram `setWebhook` pointing to `https://YOUR-WORKER/telegram/webhook` with matching `secret_token`. If a bot backend already exists, integrate the `/play` and `/top` commands into that existing backend instead of overwriting it.
9. Add the bot to the group; grant admin permissions if needed for reliable `getChatMember` calls. Send `/play` and `/top` to test.

## Leaderboard and security

- Telegram Mini App `initData` signature and age are verified by the server, never trusted from the browser.
- Group links carry a signed group identifier; server also verifies player membership via Telegram.
- Server creates a unique 20-second round and accepts the finish once.
- Group leaderboards isolate scores by chat ID; top-10 names are returned from the signed Telegram identity, not supplied client nicknames.
- **Anti-cheat limitation:** server currently trusts client-reported bag totals, subject to timing and cap checks. Motivated users could script inflated scores. Do **not** use the leaderboard for prizes until server-authoritative spawn events, replay validation, and abuse controls are implemented.

## Release

All modifications remain on `feature/redd-challenge`. The existing published `main` branch is unchanged until review and merge. Browser preview is gameplay-only; ranked play needs the deployed Worker, configured bot and Telegram Mini App.

Made for the Bellscoin community by [@AMJ_BTC](https://x.com/AMJ_BTC).
