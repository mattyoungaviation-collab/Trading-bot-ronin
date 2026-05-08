import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { JsonRpcProvider, Wallet, parseUnits } from "ethers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

function isAddress(value: string | null | undefined) {
  return !!value && value.startsWith("0x") && value.length === 42;
}

function maskAddress(address: string | null | undefined) {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function quoteEntryPrice(quote: { amountIn: string; amountOut: string }) {
  const amountIn = Number(quote.amountIn);
  const amountOut = Number(quote.amountOut);
  if (!Number.isFinite(amountIn) || !Number.isFinite(amountOut) || amountOut <= 0) return 0;
  return amountIn / amountOut;
}

async function getWalletPreview() {
  const privateKey = process.env.LIVE_TRADING_PRIVATE_KEY;
  const rpcUrl = process.env.RONIN_RPC_URL || "https://api.roninchain.com/rpc";
  const chainId = Number(process.env.RONIN_CHAIN_ID || 2020);

  if (!privateKey) {
    return {
      ok: false,
      address: null,
      maskedAddress: null,
      ronBalance: null,
      message: "LIVE_TRADING_PRIVATE_KEY is not set.",
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
      message: "Wallet detected. Private key is hidden.",
    };
  } catch (error) {
    return {
      ok: false,
      address: null,
      maskedAddress: null,
      ronBalance: null,
      message: error instanceof Error ? error.message : "Wallet preview failed.",
    };
  }
}

export async function GET() {
  const [settings, acceptedDecision] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.tradeDecision.findFirst({ where: { accepted: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const wallet = await getWalletPreview();
  const routerAddress = process.env.KATANA_V3_SWAP_ROUTER_ADDRESS || null;
  const quoterAddress = process.env.KATANA_V3_QUOTER_ADDRESS || null;
  const blockers: string[] = [];

  if (!settings) blockers.push("Settings row is missing.");
  if (settings?.botMode !== "LIVE") blockers.push("Bot Mode must be LIVE for live preview readiness.");
  if (settings?.emergencyStop) blockers.push("Emergency Stop must be OFF for live preview readiness.");
  if (!acceptedDecision) blockers.push("No accepted decision found. Run /quotes and /decisions first.");
  if (!isAddress(routerAddress)) blockers.push("KATANA_V3_SWAP_ROUTER_ADDRESS is missing or invalid.");
  if (!isAddress(quoterAddress)) blockers.push("KATANA_V3_QUOTER_ADDRESS is missing or invalid.");
  if (!wallet.ok) blockers.push(wallet.message);

  let token = null;
  let quote = null;
  let preview = null;

  if (acceptedDecision) {
    token = await prisma.token.findUnique({ where: { id: acceptedDecision.tokenId } });
    quote = await prisma.quote.findFirst({ where: { tokenId: acceptedDecision.tokenId }, orderBy: { createdAt: "desc" } });

    if (!token) blockers.push("Accepted decision token was not found.");
    if (!quote) blockers.push("No latest quote found for accepted decision token.");

    if (token && quote && settings) {
      if (token.poolType !== "KATANA_V3") blockers.push("Live preview currently supports KATANA_V3 only.");
      if (!isAddress(token.contractAddress)) blockers.push("Token contract address is invalid.");
      if (!isAddress(token.baseTokenAddress)) blockers.push("Base token address is invalid.");
      if (!token.feeTier) blockers.push("V3 fee tier is missing.");

      const amountIn = Number(quote.amountIn || settings.maxTradeSizeUsd || 0);
      const expectedAmountOut = Number(quote.amountOut || 0);
      const maxSlippagePct = Number(settings.maxSlippagePct || 0.7);
      const minimumAmountOut = expectedAmountOut * (1 - maxSlippagePct / 100);
      const entryPrice = quoteEntryPrice(quote);
      const deadlineSeconds = Math.floor(Date.now() / 1000) + 60 * 5;

      let amountInRaw = null;
      let minimumAmountOutRaw = null;
      try {
        amountInRaw = parseUnits(String(amountIn), 18).toString();
        minimumAmountOutRaw = parseUnits(String(minimumAmountOut), token.decimals || 18).toString();
      } catch {
        blockers.push("Failed to build raw amount preview. Check token decimals and quote amounts.");
      }

      preview = {
        type: "KATANA_V3_EXACT_INPUT_SINGLE_PREVIEW",
        routerAddress,
        maskedRouterAddress: maskAddress(routerAddress),
        quoterAddress,
        maskedQuoterAddress: maskAddress(quoterAddress),
        walletAddress: wallet.maskedAddress,
        tokenInSymbol: token.baseToken,
        tokenInAddress: token.baseTokenAddress,
        tokenOutSymbol: token.symbol,
        tokenOutAddress: token.contractAddress,
        feeTier: token.feeTier,
        amountIn,
        amountInRaw,
        expectedAmountOut,
        minimumAmountOut,
        minimumAmountOutRaw,
        maxSlippagePct,
        entryPrice,
        quoteId: quote.id,
        quoteCreatedAt: quote.createdAt,
        decisionId: acceptedDecision.id,
        tradeScore: acceptedDecision.tradeScore,
        expectedProfitPct: acceptedDecision.expectedProfitPct,
        deadlineSeconds,
        deadlineHuman: new Date(deadlineSeconds * 1000).toISOString(),
        warning: "Preview only. No transaction is signed or sent by this endpoint.",
      };
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    readyForPreview: blockers.length === 0,
    settings,
    wallet: {
      ok: wallet.ok,
      maskedAddress: wallet.maskedAddress,
      ronBalance: wallet.ronBalance,
      message: wallet.message,
    },
    acceptedDecision,
    token,
    quote,
    preview,
    blockers,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
