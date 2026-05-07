import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const allowedModes = new Set(["OFF", "WATCH", "PAPER", "LIVE"]);

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

async function ensureSettings() {
  return prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      botMode: "OFF",
      maxTradeSizeUsd: 25,
      minExpectedProfitPct: 2,
      takeProfitPct: 5,
      stopLossPct: 2,
      trailingStopPct: 1.5,
      cooldownSec: 300,
      maxOpenPositionsPerToken: 1,
      maxDailyTrades: 10,
      maxBuyImpactPct: 1,
      maxSellImpactPct: 1,
      maxRoundTripImpactPct: 2,
      minPoolLiquidityUsd: 5000,
      minExitLiquidityUsd: 5000,
      minRecentVolumeUsd: 1000,
      maxSlippagePct: 0.7,
      minQuoteConfidence: 60,
      minTradeScore: 70,
      maxDailyLossUsd: 50,
      maxWalletExposurePct: 15,
      maxTokenExposurePct: 5,
      emergencyStopLossPct: 8,
      whitelistOnly: false,
      requireManualApproval: true,
      allowUnlimitedApproval: false,
      emergencyStop: true,
    },
  });
}

export async function GET() {
  const settings = await ensureSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const current = await ensureSettings();
  const body = await request.json();

  const botMode = allowedModes.has(String(body.botMode)) ? String(body.botMode) : current.botMode;

  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: {
      botMode,
      maxTradeSizeUsd: toNumber(body.maxTradeSizeUsd, current.maxTradeSizeUsd),
      minExpectedProfitPct: toNumber(body.minExpectedProfitPct, current.minExpectedProfitPct),
      takeProfitPct: toNumber(body.takeProfitPct, current.takeProfitPct),
      stopLossPct: toNumber(body.stopLossPct, current.stopLossPct),
      trailingStopPct: toNumber(body.trailingStopPct, current.trailingStopPct),
      cooldownSec: Math.round(toNumber(body.cooldownSec, current.cooldownSec)),
      maxOpenPositionsPerToken: Math.round(toNumber(body.maxOpenPositionsPerToken, current.maxOpenPositionsPerToken)),
      maxDailyTrades: Math.round(toNumber(body.maxDailyTrades, current.maxDailyTrades)),
      maxBuyImpactPct: toNumber(body.maxBuyImpactPct, current.maxBuyImpactPct),
      maxSellImpactPct: toNumber(body.maxSellImpactPct, current.maxSellImpactPct),
      maxRoundTripImpactPct: toNumber(body.maxRoundTripImpactPct, current.maxRoundTripImpactPct),
      minPoolLiquidityUsd: toNumber(body.minPoolLiquidityUsd, current.minPoolLiquidityUsd),
      minExitLiquidityUsd: toNumber(body.minExitLiquidityUsd, current.minExitLiquidityUsd),
      minRecentVolumeUsd: toNumber(body.minRecentVolumeUsd, current.minRecentVolumeUsd),
      maxSlippagePct: toNumber(body.maxSlippagePct, current.maxSlippagePct),
      minQuoteConfidence: toNumber(body.minQuoteConfidence, current.minQuoteConfidence),
      minTradeScore: toNumber(body.minTradeScore, current.minTradeScore),
      maxDailyLossUsd: toNumber(body.maxDailyLossUsd, current.maxDailyLossUsd),
      maxWalletExposurePct: toNumber(body.maxWalletExposurePct, current.maxWalletExposurePct),
      maxTokenExposurePct: toNumber(body.maxTokenExposurePct, current.maxTokenExposurePct),
      emergencyStopLossPct: toNumber(body.emergencyStopLossPct, current.emergencyStopLossPct),
      whitelistOnly: toBoolean(body.whitelistOnly, current.whitelistOnly),
      requireManualApproval: toBoolean(body.requireManualApproval, current.requireManualApproval),
      allowUnlimitedApproval: toBoolean(body.allowUnlimitedApproval, current.allowUnlimitedApproval),
      emergencyStop: toBoolean(body.emergencyStop, current.emergencyStop),
    },
  });

  return NextResponse.json(settings);
}
