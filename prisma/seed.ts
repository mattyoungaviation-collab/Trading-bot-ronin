import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
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

  console.log("Seeded default settings");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
