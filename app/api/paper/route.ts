import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

function quoteEntryPrice(quote: { amountIn: string; amountOut: string }) {
  const amountIn = Number(quote.amountIn);
  const amountOut = Number(quote.amountOut);
  if (!Number.isFinite(amountIn) || !Number.isFinite(amountOut) || amountOut <= 0) return 0;
  return amountIn / amountOut;
}

function tradePnl(trade: { entryPrice: number; qty: number }, latestPrice: number) {
  if (!trade.entryPrice || !latestPrice) return 0;
  const tokenQty = trade.qty / trade.entryPrice;
  return tokenQty * latestPrice - trade.qty;
}

export async function GET() {
  const [settings, tokens, paperTrades] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ orderBy: [{ isActive: "desc" }, { symbol: "asc" }] }),
    prisma.paperTrade.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const tokenMap = new Map(tokens.map((token) => [token.id, token]));
  const latestQuotes = await prisma.quote.findMany({
    where: { tokenId: { in: tokens.map((token) => token.id) } },
    orderBy: { createdAt: "desc" },
  });

  const latestQuoteMap = new Map<number, (typeof latestQuotes)[number]>();
  for (const quote of latestQuotes) {
    if (!latestQuoteMap.has(quote.tokenId)) latestQuoteMap.set(quote.tokenId, quote);
  }

  const enrichedTrades = await Promise.all(paperTrades.map(async (trade) => {
    const latestQuote = latestQuoteMap.get(trade.tokenId) || null;
    const currentPrice = latestQuote ? quoteEntryPrice(latestQuote) : trade.entryPrice;
    const currentPnl = trade.status === "OPEN" ? tradePnl(trade, currentPrice) : trade.pnl;
    const currentPnlPct = trade.qty > 0 ? (currentPnl / trade.qty) * 100 : 0;

    let updatedTrade = trade;
    if (trade.status === "OPEN" && settings && latestQuote) {
      const shouldTakeProfit = currentPnlPct >= settings.takeProfitPct;
      const shouldStopLoss = currentPnlPct <= -settings.stopLossPct;

      if (shouldTakeProfit || shouldStopLoss) {
        updatedTrade = await prisma.paperTrade.update({
          where: { id: trade.id },
          data: {
            status: shouldTakeProfit ? "CLOSED_TAKE_PROFIT" : "CLOSED_STOP_LOSS",
            pnl: currentPnl,
          },
        });

        await prisma.botLog.create({
          data: {
            level: shouldTakeProfit ? "info" : "warning",
            message: "Closed paper trade.",
            meta: JSON.stringify({ tradeId: trade.id, tokenId: trade.tokenId, reason: updatedTrade.status, pnl: currentPnl, pnlPct: currentPnlPct }),
          },
        });
      }
    }

    return {
      ...updatedTrade,
      token: tokenMap.get(trade.tokenId) || null,
      latestQuote,
      currentPrice,
      currentPnl: updatedTrade.status === "OPEN" ? currentPnl : updatedTrade.pnl,
      currentPnlPct,
    };
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    paperTrades: enrichedTrades,
    summary: {
      totalTrades: enrichedTrades.length,
      openTrades: enrichedTrades.filter((trade) => trade.status === "OPEN").length,
      closedTrades: enrichedTrades.filter((trade) => trade.status !== "OPEN").length,
      realizedPnl: enrichedTrades.filter((trade) => trade.status !== "OPEN").reduce((sum, trade) => sum + trade.pnl, 0),
      unrealizedPnl: enrichedTrades.filter((trade) => trade.status === "OPEN").reduce((sum, trade) => sum + trade.currentPnl, 0),
    },
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST() {
  const [settings, acceptedDecisions] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.tradeDecision.findMany({
      where: { accepted: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  if (!settings) {
    return NextResponse.json({ error: "Settings row is missing." }, { status: 500 });
  }

  if (settings.botMode !== "PAPER") {
    return NextResponse.json({ error: "Bot mode must be PAPER to create simulated paper trades." }, { status: 400 });
  }

  if (settings.emergencyStop) {
    return NextResponse.json({ error: "Emergency Stop is ON. Turn it off only when you intentionally want paper simulations." }, { status: 400 });
  }

  const created = [];
  const rejected = [];
  const seenTokenIds = new Set<number>();

  for (const decision of acceptedDecisions) {
    if (seenTokenIds.has(decision.tokenId)) continue;
    seenTokenIds.add(decision.tokenId);

    const [token, latestQuote, existingOpen] = await Promise.all([
      prisma.token.findUnique({ where: { id: decision.tokenId } }),
      prisma.quote.findFirst({ where: { tokenId: decision.tokenId }, orderBy: { createdAt: "desc" } }),
      prisma.paperTrade.findFirst({ where: { tokenId: decision.tokenId, status: "OPEN" } }),
    ]);

    if (!token) {
      rejected.push({ tokenId: decision.tokenId, reason: "Token not found." });
      continue;
    }

    if (!latestQuote) {
      rejected.push({ symbol: token.symbol, reason: "No quote found. Run /quotes first." });
      continue;
    }

    if (existingOpen) {
      rejected.push({ symbol: token.symbol, reason: "Open paper trade already exists." });
      continue;
    }

    const entryPrice = quoteEntryPrice(latestQuote);
    if (!entryPrice) {
      rejected.push({ symbol: token.symbol, reason: "Invalid quote entry price." });
      continue;
    }

    const trade = await prisma.paperTrade.create({
      data: {
        tokenId: token.id,
        side: "BUY",
        entryPrice,
        qty: settings.maxTradeSizeUsd,
        status: "OPEN",
        pnl: 0,
      },
    });

    await prisma.botLog.create({
      data: {
        level: "info",
        message: "Created quote based paper trade from accepted decision.",
        meta: JSON.stringify({ tokenId: token.id, symbol: token.symbol, tradeId: trade.id, decisionId: decision.id, entryPrice, quoteId: latestQuote.id }),
      },
    });

    created.push({ ...trade, token, latestQuote });
  }

  if (created.length === 0 && rejected.length === 0) {
    rejected.push({ reason: "No accepted decisions found. Run /quotes, then /decisions in PAPER mode with Emergency Stop OFF." });
  }

  return NextResponse.json({ created, rejected }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
