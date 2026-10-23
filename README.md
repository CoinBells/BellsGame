# 🔔 Bells Village Rush

A mobile-first Bellscoin arcade game created for the Bells community. Catch falling BELLS bags for one 60-second round, but **never tap Redd** — one touch ends your round instantly.

## How to play

- Tap the golden BELLS bags to earn **1 point** each.
- Avoid the fox **Redd**. He begins appearing after about 5.5 seconds and returns at unpredictable intervals.
- Last until the clock reaches **0** to complete the whole round.
- Bags continue spawning throughout the full round (there is **no 12-bag limit**).
- The pace increases during the last 40 seconds.
- Tap **Play Again** for another run, and **Share** to post your score.

## Features

- 60-second time limit based on a monotonic clock, not imprecise independent timers
- Multiple clickable bags, with duplicate-tap prevention
- Random Redd appearances and immediate game-over
- Speed ramp, low-time alert, sound toggle and optional device haptics
- Personal best stored in the browser's `localStorage`
- Responsive mobile layout for iPhone, Android and Telegram's in-app browser
- No frameworks, packages, trackers, user accounts or backend

## Run locally

Serve the repository with any static web server and open `index.html`. All images are relative to this page: `images/BELLS.PNG`, `images/BELLSLOGO.PNG`, `images/TOM.PNG`, and `images/redd.svg`.

To preview the feature branch without changing the production site, use a static branch preview service that serves HTML and relative assets, or clone and serve this branch locally.

## Deployment

The published GitHub Pages site remains on **main** until the changes are reviewed and merged. Existing Telegram bot links may continue to show the old five-second game until the production branch is updated.

Personal best is **local only**, not a globally ranked leaderboard. Redd's art is an original SVG created for this game.

Created by [@AMJ_BTC](https://x.com/AMJ_BTC) · Inspired by Bellscoin ($BELLS).
