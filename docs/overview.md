<link rel="stylesheet" type="text/css" href="styles.css">
<div onclick="history.back()" class="btn"><span class="arrow">←</span> Go back <span class="title">Telegram Bot</span></div>

# Overview

This project is a Telegram bot for the Api3 community, built with Node.js and the `telegraf` library. Its main features and structure are:

- **Purpose:** The bot moderates a Telegram super group by monitoring messages, enforcing rules, and automating some moderation actions.
- **AI Moderation:** It uses a large language model (Anthropic Claude via OpenRouter) to analyze messages and decide if they violate server rules.
- **Message Handling:** When a user sends or edits a message, the bot checks it (with an AI prompt) and, if necessary, deletes the message, times out the user, and logs the action.
- **Configurable:** Provided a `config.json` file.
- **Logging:** All moderation actions are logged in hte app console.
- **Code Structure:**
  - index.js: Main entry, sets up the `telegraf` bot` and event handlers.
  - handlers.js: Contains logic for handling messages.
  - llm.js: Handles AI moderation calls.
  - logger.js: Simple logging utility.

## Dependencies

- `telegraf` for Telegram Bot API interaction
- `eslint` and `prettier` for code quality

## Scripts

- `*-prod-pm2` for running the production bot in a PM2 process on EC2
- `*-dev-pm2` for running the development bot in a PM2 process on EC2
- `start-dev` for running the development bot locally
- `lint`, `prettier`, and `prettier:check` for code formatting and linting

## Configuration

Sensitive data and server-specific settings are loaded from a config file (not in the repo).

## Summary

This bot automates moderation in a Discord server using AI, with configurable channels, roles, and emoji-based moderator controls.
