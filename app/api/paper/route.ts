import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const [settings, tokens, paperTrades] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ orderBy: [{ isActive: "desc" }, { symbol: "asc" }] }),
    prisma.paperTrade.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const tokenMap = new Map(tokens.map((token) => [token.id, token]));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    paperTrades: paperTrades.map((trade) => ({
      ...trade,
      token: tokenMap.get(trade.tokenId) || null,
    })),
    summary: {
      totalTrades: paperTrades.length,
      openTrades: paperTrades.filter((trade) => trade.status === "OPEN").length,
      closedTrades: paperTrades.filter((trade) => trade.status === "CLOSED").length,
      realizedPnl: paperTrades.reduce((sum, trade) => sum + trade.pnl, 0),
    },
  });
}

export async function POST() {
  const [settings, tokens] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ where: { isActive: true }, orderBy: { symbol: "asc" } }),
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

  for (const token of tokens) {
    if (!token.pairAddress) {
      rejected.push({ symbol: token.symbol, reason: "Pool address missing." });
      continue;
    }

    const existingOpen = await prisma.paperTrade.findFirst({
      where: { tokenId: token.id, status: "OPEN" },
    });

    if (existingOpen) {
      rejected.push({ symbol: token.symbol, reason: "Open paper trade already exists." });
      continue;
    }

    const trade = await prisma.paperTrade.create({
      data: {
        tokenId: token.id,
        side: "BUY",
        entryPrice: 1,
        qty: settings.maxTradeSizeUsd,
        status: "OPEN",
        pnl: 0,
      },
    });

    await prisma.botLog.create({
      data: {
        level: "info",
        message: "Created paper trade.",
        meta: JSON.stringify({ tokenId: token.id, symbol: token.symbol, tradeId: trade.id }),
      },
    });

    created.push({ ...trade, token });
  }

  return NextResponse.json({ created, rejected });
}
