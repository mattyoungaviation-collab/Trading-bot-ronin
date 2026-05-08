import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { JsonRpcProvider, Wallet } from "ethers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

function maskAddress(address: string | null) {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isAddress(value: string | null | undefined) {
  return !!value && value.startsWith("0x") && value.length === 42;
}

async function getWalletStatus() {
  const privateKey = process.env.LIVE_TRADING_PRIVATE_KEY;
  const rpcUrl = process.env.RONIN_RPC_URL || "https://api.roninchain.com/rpc";
  const chainId = Number(process.env.RONIN_CHAIN_ID || 2020);

  if (!privateKey) {
    return {
      ok: false,
      address: null,
      maskedAddress: null,
      ronBalance: null,
      message: "LIVE_TRADING_PRIVATE_KEY is not set. Live signing is disabled.",
    };
  }

  try {
    const provider = new JsonRpcProvider(rpcUrl, chainId);
    const wallet = new Wallet(privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    return {
      ok: true,
      address: wallet.address,
      maskedAddress: maskAddress(wallet.address),
      ronBalance: Number(balance) / 1e18,
      message: "Live wallet key is present and wallet balance was read.",
    };
  } catch (error) {
    return {
      ok: false,
      address: null,
      maskedAddress: null,
      ronBalance: null,
      message: error instanceof Error ? error.message : "Failed to check live wallet.",
    };
  }
}

function liveEnvStatus() {
  const router = process.env.KATANA_V3_SWAP_ROUTER_ADDRESS || null;
  const quoter = process.env.KATANA_V3_QUOTER_ADDRESS || null;

  return {
    routerAddress: router,
    maskedRouterAddress: maskAddress(router),
    routerOk: isAddress(router),
    quoterAddress: quoter,
    maskedQuoterAddress: maskAddress(quoter),
    quoterOk: isAddress(quoter),
    livePrivateKeySet: !!process.env.LIVE_TRADING_PRIVATE_KEY,
    liveExecutionEnabled: process.env.LIVE_EXECUTION_ENABLED === "true",
  };
}

export async function GET() {
  const [settings, recentAcceptedDecisions, liveTrades, walletStatus] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.tradeDecision.findMany({ where: { accepted: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.liveTrade.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getWalletStatus(),
  ]);

  const env = liveEnvStatus();
  const blockers: string[] = [];

  if (settings?.botMode !== "LIVE") blockers.push("Bot Mode must be LIVE.");
  if (settings?.emergencyStop) blockers.push("Emergency Stop must be OFF.");
  if (settings?.requireManualApproval) blockers.push("Manual approval is still required. This is recommended for first live tests.");
  if (!env.quoterOk) blockers.push("KATANA_V3_QUOTER_ADDRESS is missing or invalid.");
  if (!env.routerOk) blockers.push("KATANA_V3_SWAP_ROUTER_ADDRESS is missing or invalid.");
  if (!env.livePrivateKeySet) blockers.push("LIVE_TRADING_PRIVATE_KEY is not set.");
  if (!env.liveExecutionEnabled) blockers.push("LIVE_EXECUTION_ENABLED must be true before any live transaction can be sent.");
  if (!walletStatus.ok) blockers.push(walletStatus.message);
  if (recentAcceptedDecisions.length === 0) blockers.push("No accepted decisions found. Run /quotes and /decisions first.");

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    env,
    walletStatus: {
      ok: walletStatus.ok,
      maskedAddress: walletStatus.maskedAddress,
      ronBalance: walletStatus.ronBalance,
      message: walletStatus.message,
    },
    recentAcceptedDecisions,
    liveTrades,
    readyForLiveExecution: blockers.length === 0,
    blockers,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST() {
  const [settings, acceptedDecision] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.tradeDecision.findFirst({ where: { accepted: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const env = liveEnvStatus();
  const walletStatus = await getWalletStatus();
  const blockers: string[] = [];

  if (settings?.botMode !== "LIVE") blockers.push("Bot Mode must be LIVE.");
  if (settings?.emergencyStop) blockers.push("Emergency Stop must be OFF.");
  if (!acceptedDecision) blockers.push("No accepted decision found.");
  if (!env.quoterOk) blockers.push("KATANA_V3_QUOTER_ADDRESS is missing or invalid.");
  if (!env.routerOk) blockers.push("KATANA_V3_SWAP_ROUTER_ADDRESS is missing or invalid.");
  if (!env.livePrivateKeySet) blockers.push("LIVE_TRADING_PRIVATE_KEY is not set.");
  if (!env.liveExecutionEnabled) blockers.push("LIVE_EXECUTION_ENABLED must be true.");
  if (!walletStatus.ok) blockers.push(walletStatus.message);

  if (blockers.length > 0) {
    await prisma.botLog.create({
      data: {
        level: "warning",
        message: "Live execution blocked.",
        meta: JSON.stringify({ blockers }),
      },
    });

    return NextResponse.json({
      ok: false,
      message: "Live execution blocked by safety checks.",
      blockers,
    }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const liveTrade = await prisma.liveTrade.create({
    data: {
      tokenId: acceptedDecision!.tokenId,
      side: "BUY",
      status: "READY_NOT_SENT",
      pnl: 0,
    },
  });

  await prisma.botLog.create({
    data: {
      level: "warning",
      message: "Live trade reached ready state but transaction sending is not implemented in this build.",
      meta: JSON.stringify({ liveTradeId: liveTrade.id, decisionId: acceptedDecision!.id }),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Live readiness passed. Transaction sending is intentionally not implemented until router ABI and exact swap path are verified.",
    liveTrade,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
