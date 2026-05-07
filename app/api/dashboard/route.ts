import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { JsonRpcProvider } from "ethers";

const prisma = new PrismaClient();

async function getRpcStatus() {
  const rpcUrl = process.env.RONIN_RPC_URL || "https://api.roninchain.com/rpc";
  const expectedChainId = Number(process.env.RONIN_CHAIN_ID || 2020);

  try {
    const provider = new JsonRpcProvider(rpcUrl, expectedChainId);
    const [network, blockNumber] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
    ]);

    const chainId = Number(network.chainId);

    return {
      ok: chainId === expectedChainId,
      rpcUrl,
      expectedChainId,
      chainId,
      blockNumber,
      message: chainId === expectedChainId ? "Ronin RPC connected." : "RPC chain ID mismatch.",
    };
  } catch (error) {
    return {
      ok: false,
      rpcUrl,
      expectedChainId,
      chainId: null,
      blockNumber: null,
      message: error instanceof Error ? error.message : "RPC connection failed.",
    };
  }
}

function tokenReady(token: { isActive: boolean; contractAddress: string; pairAddress: string | null; baseToken: string; poolType: string }) {
  if (!token.isActive) return false;
  if (!token.contractAddress.startsWith("0x") || token.contractAddress.length !== 42) return false;
  if (!token.pairAddress || !token.pairAddress.startsWith("0x") || token.pairAddress.length !== 42) return false;
  if (!token.baseToken || !token.poolType) return false;
  return true;
}

export async function GET() {
  const [settings, tokens, latestDecisions, latestPaperTrades, riskEvents, botLogs, rpcStatus] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ orderBy: [{ isActive: "desc" }, { symbol: "asc" }] }),
    prisma.tradeDecision.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.paperTrade.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.riskEvent.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.botLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    getRpcStatus(),
  ]);

  const tokenMap = new Map(tokens.map((token) => [token.id, token]));
  const activeTokens = tokens.filter((token) => token.isActive);
  const readyTokens = tokens.filter(tokenReady);
  const openPaperTrades = latestPaperTrades.filter((trade) => trade.status === "OPEN");
  const realizedPaperPnl = latestPaperTrades.reduce((sum, trade) => sum + trade.pnl, 0);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    rpcStatus,
    summary: {
      totalTokens: tokens.length,
      activeTokens: activeTokens.length,
      readyTokens: readyTokens.length,
      latestDecisionCount: latestDecisions.length,
      acceptedDecisionCount: latestDecisions.filter((decision) => decision.accepted).length,
      paperTradeCount: latestPaperTrades.length,
      openPaperTrades: openPaperTrades.length,
      realizedPaperPnl,
      recentRiskEvents: riskEvents.length,
    },
    tokens,
    latestDecisions: latestDecisions.map((decision) => ({
      ...decision,
      token: tokenMap.get(decision.tokenId) || null,
    })),
    latestPaperTrades: latestPaperTrades.map((trade) => ({
      ...trade,
      token: tokenMap.get(trade.tokenId) || null,
    })),
    riskEvents: riskEvents.map((event) => ({
      ...event,
      token: event.tokenId ? tokenMap.get(event.tokenId) || null : null,
    })),
    botLogs,
  });
}
