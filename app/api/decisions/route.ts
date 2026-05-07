import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

type DecisionReason = {
  code: string;
  message: string;
  severity: "info" | "warning" | "danger";
};

type TokenShape = {
  isActive: boolean;
  contractAddress: string;
  pairAddress: string | null;
  poolType: string;
  baseToken: string;
};

type QuoteShape = {
  amountIn: string;
  amountOut: string;
  priceImpactPct: number;
  roundTripImpactPct: number | null;
  liquidityUsd: number | null;
  quoteSource: string | null;
  confidence: number;
  createdAt: Date;
} | null;

function baseReadinessScore(token: TokenShape) {
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

  return { score, reasons };
}

function quoteScore(settings: any, quote: QuoteShape) {
  if (!quote) {
    return {
      score: 0,
      expectedProfitPct: 0,
      reasons: [{ code: "NO_QUOTE", message: "No saved quote found. Run /quotes first.", severity: "danger" }] as DecisionReason[],
    };
  }

  let score = 100;
  const reasons: DecisionReason[] = [];
  const buyImpact = Number(quote.priceImpactPct || 0);
  const roundTripImpact = Number(quote.roundTripImpactPct || 0);
  const confidence = Number(quote.confidence || 0);
  const maxBuyImpact = Number(settings?.maxBuyImpactPct ?? 1);
  const maxRoundTripImpact = Number(settings?.maxRoundTripImpactPct ?? 2);
  const minConfidence = Number(settings?.minQuoteConfidence ?? 60);
  const minExpectedProfit = Number(settings?.minExpectedProfitPct ?? 2);
  const estimatedRequiredProfit = roundTripImpact + minExpectedProfit;

  if (buyImpact > maxBuyImpact) {
    score -= 25;
    reasons.push({ code: "BUY_IMPACT_TOO_HIGH", message: `Buy impact ${buyImpact.toFixed(4)}% is above limit ${maxBuyImpact}%.`, severity: "danger" });
  } else {
    reasons.push({ code: "BUY_IMPACT_OK", message: `Buy impact ${buyImpact.toFixed(4)}% is within limit ${maxBuyImpact}%.`, severity: "info" });
  }

  if (roundTripImpact > maxRoundTripImpact) {
    score -= 30;
    reasons.push({ code: "ROUND_TRIP_IMPACT_TOO_HIGH", message: `Round trip impact ${roundTripImpact.toFixed(4)}% is above limit ${maxRoundTripImpact}%.`, severity: "danger" });
  } else {
    reasons.push({ code: "ROUND_TRIP_IMPACT_OK", message: `Round trip impact ${roundTripImpact.toFixed(4)}% is within limit ${maxRoundTripImpact}%.`, severity: "info" });
  }

  if (confidence < minConfidence) {
    score -= 25;
    reasons.push({ code: "CONFIDENCE_TOO_LOW", message: `Quote confidence ${confidence.toFixed(2)} is below minimum ${minConfidence}.`, severity: "danger" });
  } else {
    reasons.push({ code: "CONFIDENCE_OK", message: `Quote confidence ${confidence.toFixed(2)} is above minimum ${minConfidence}.`, severity: "info" });
  }

  const quoteAgeMs = Date.now() - new Date(quote.createdAt).getTime();
  const quoteAgeMinutes = quoteAgeMs / 1000 / 60;
  if (quoteAgeMinutes > 10) {
    score -= 15;
    reasons.push({ code: "QUOTE_STALE", message: `Quote is ${quoteAgeMinutes.toFixed(1)} minutes old. Run /quotes again.`, severity: "warning" });
  }

  reasons.push({
    code: "PROFIT_TARGET_REQUIRED",
    message: `Estimated move required before trade makes sense: at least ${estimatedRequiredProfit.toFixed(4)}% before gas and extra buffer.`,
    severity: "info",
  });

  return {
    score: Math.max(0, Math.min(100, score)),
    expectedProfitPct: estimatedRequiredProfit,
    reasons,
  };
}

export async function GET() {
  const [settings, tokens] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ orderBy: [{ isActive: "desc" }, { symbol: "asc" }] }),
  ]);

  const botMode = settings?.botMode || "OFF";
  const emergencyStop = settings?.emergencyStop ?? true;
  const minTradeScore = Number(settings?.minTradeScore ?? 70);

  const decisions = await Promise.all(
    tokens.map(async (token) => {
      const latestQuote = await prisma.quote.findFirst({
        where: { tokenId: token.id },
        orderBy: { createdAt: "desc" },
      });

      const readiness = baseReadinessScore(token);
      const quoted = quoteScore(settings, latestQuote);
      let tradeScore = Math.max(0, Math.min(100, Math.round((readiness.score * 0.35) + (quoted.score * 0.65))));
      const reasons = [...readiness.reasons, ...quoted.reasons];

      if (emergencyStop) {
        tradeScore = Math.min(tradeScore, 10);
        reasons.push({ code: "EMERGENCY_STOP_ON", message: "Emergency Stop is ON, so trades are rejected.", severity: "danger" });
      }

      if (botMode === "OFF") {
        tradeScore = Math.min(tradeScore, 20);
        reasons.push({ code: "BOT_MODE_OFF", message: "Bot mode is OFF.", severity: "info" });
      }

      if (botMode === "LIVE") {
        tradeScore = Math.min(tradeScore, 10);
        reasons.push({ code: "LIVE_BLOCKED", message: "Live decisions are blocked until paper mode is proven.", severity: "danger" });
      }

      if (tradeScore < minTradeScore) {
        reasons.push({ code: "SCORE_TOO_LOW", message: `Trade score ${tradeScore} is below minimum ${minTradeScore}.`, severity: "warning" });
      }

      const hasDanger = reasons.some((reason) => reason.severity === "danger");
      const accepted = !hasDanger && tradeScore >= minTradeScore && botMode === "PAPER" && !emergencyStop;
      const reasonText = reasons.map((reason) => `${reason.code}: ${reason.message}`).join(" | ");

      const saved = await prisma.tradeDecision.create({
        data: {
          tokenId: token.id,
          mode: botMode,
          accepted,
          reasons: reasonText,
          tradeScore,
          expectedProfitPct: quoted.expectedProfitPct,
        },
      });

      if (hasDanger) {
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
        quote: latestQuote,
        accepted,
        tradeScore,
        expectedProfitPct: quoted.expectedProfitPct,
        reasons,
        createdAt: saved.createdAt,
      };
    })
  );

  await prisma.botLog.create({
    data: {
      level: "info",
      message: "Decision scan completed with quote data.",
      meta: JSON.stringify({ botMode, tokenCount: tokens.length, acceptedCount: decisions.filter((decision) => decision.accepted).length }),
    },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    decisions,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
