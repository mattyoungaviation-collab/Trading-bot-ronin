import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DecisionReason = {
  code: string;
  message: string;
  severity: "info" | "warning" | "danger";
};

function scoreToken(token: {
  isActive: boolean;
  contractAddress: string;
  pairAddress: string | null;
  poolType: string;
  baseToken: string;
}) {
  let score = 100;
  const reasons: DecisionReason[] = [];

  if (!token.isActive) {
    score -= 40;
    reasons.push({ code: "TOKEN_INACTIVE", message: "Token is inactive.", severity: "warning" });
  }

  if (!token.contractAddress.startsWith("0x") || token.contractAddress.length !== 42) {
    score -= 25;
    reasons.push({ code: "CONTRACT_NOT_VERIFIED", message: "Contract address needs verification.", severity: "danger" });
  }

  if (!token.pairAddress) {
    score -= 35;
    reasons.push({ code: "POOL_MISSING", message: "Pool address is missing, so liquidity and impact cannot be checked.", severity: "danger" });
  }

  if (token.pairAddress && (!token.pairAddress.startsWith("0x") || token.pairAddress.length !== 42)) {
    score -= 25;
    reasons.push({ code: "POOL_NOT_VERIFIED", message: "Pool address needs verification.", severity: "danger" });
  }

  if (!token.poolType) {
    score -= 10;
    reasons.push({ code: "POOL_TYPE_MISSING", message: "Pool type is missing.", severity: "warning" });
  }

  if (!token.baseToken) {
    score -= 10;
    reasons.push({ code: "BASE_TOKEN_MISSING", message: "Base token is missing.", severity: "warning" });
  }

  if (reasons.length === 0) {
    score -= 30;
    reasons.push({
      code: "LIQUIDITY_NOT_QUOTED_YET",
      message: "Token is configured, but live liquidity and price impact quoting is not connected yet.",
      severity: "info",
    });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

export async function GET() {
  const [settings, tokens] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ orderBy: [{ isActive: "desc" }, { symbol: "asc" }] }),
  ]);

  const botMode = settings?.botMode || "OFF";
  const minTradeScore = settings?.minTradeScore ?? 70;
  const emergencyStop = settings?.emergencyStop ?? true;

  const decisions = await Promise.all(
    tokens.map(async (token) => {
      const scored = scoreToken(token);
      const reasons = [...scored.reasons];

      if (emergencyStop) {
        reasons.push({ code: "EMERGENCY_STOP_ON", message: "Emergency Stop is ON, so trades are rejected.", severity: "danger" });
      }

      if (botMode === "OFF") {
        reasons.push({ code: "BOT_MODE_OFF", message: "Bot mode is OFF.", severity: "info" });
      }

      if (botMode === "LIVE") {
        reasons.push({ code: "LIVE_BLOCKED", message: "Live decisions are blocked until paper mode is proven.", severity: "danger" });
      }

      const accepted = false;
      const expectedProfitPct = 0;
      const reasonText = reasons.map((reason) => `${reason.code}: ${reason.message}`).join(" | ");

      const saved = await prisma.tradeDecision.create({
        data: {
          tokenId: token.id,
          mode: botMode,
          accepted,
          reasons: reasonText,
          tradeScore: scored.score,
          expectedProfitPct,
        },
      });

      if (reasons.some((reason) => reason.severity === "danger")) {
        await prisma.riskEvent.create({
          data: {
            tokenId: token.id,
            reason: reasonText,
            severity: "danger",
          },
        });
      }

      return {
        id: saved.id,
        token,
        accepted,
        tradeScore: scored.score,
        expectedProfitPct,
        reasons,
        createdAt: saved.createdAt,
      };
    })
  );

  await prisma.botLog.create({
    data: {
      level: "info",
      message: "Decision scan completed.",
      meta: JSON.stringify({ botMode, tokenCount: tokens.length, acceptedCount: decisions.filter((decision) => decision.accepted).length }),
    },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    decisions,
  });
}
