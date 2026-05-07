# Ronin Katana Trading Bot
Production-focused bot scaffold for Ronin low-liquidity trading with OFF/WATCH/PAPER/LIVE modes and strict risk validation.

## Official references used
- Katana contract addresses: https://docs.katana.network/katana/technical-reference/contract-addresses/
- Ronin docs: https://docs.roninchain.com/

## Install
1. `npm install`
2. `cp .env.example .env`
3. `npx prisma migrate dev`
4. `npm run dev`

## Ronin RPC config
Set `RONIN_RPC_URL=https://api.roninchain.com/rpc`, `RONIN_CHAIN_ID=2020`.

## Add tokens
Use `TokenSelector` UI or `/api/tokens` with contract address, symbol, decimals, pair address, pool type.

## Run modes
- WATCH: scans and logs decisions only.
- PAPER: simulated fills + PnL using live quotes.
- LIVE: executes swaps **only** when `riskEngine.validateTrade()` passes and manual approvals pass.

## Live safety warnings
- Use dedicated wallet only.
- Keep private key backend-only env var.
- Dry-run enabled by default.
- Emergency stop can block all execution.
- No unlimited approvals unless enabled.

## Low liquidity risk
Thin pools can create severe entry/exit impact. Bot rejects trades by buy impact, sell impact, round-trip impact, min liquidity, min volume, and slippage.

## Price impact calculation
- V2: constant product reserve math (`x*y=k`).
- V3: Quoter contract (`V3QuoterV2`) for authoritative concentrated liquidity quoting.

## Stop bot
Set mode OFF or press Emergency Stop and persist `emergencyStop=true`.
