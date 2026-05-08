import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Interface, parseUnits } from "ethers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
];

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

export async function GET() {
  const [settings, acceptedDecision] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.tradeDecision.findFirst({ where: { accepted: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const blockers: string[] = [];
  const warnings: string[] = [];
  const routerAddress = process.env.KATANA_V3_SWAP_ROUTER_ADDRESS || null;
  const recipientAddress = process.env.LIVE_TRADE_RECIPIENT_ADDRESS || null;

  if (!settings) blockers.push("Settings row is missing.");
  if (settings?.botMode !== "LIVE") blockers.push("Bot Mode must be LIVE to build a live transaction preview.");
  if (settings?.emergencyStop) blockers.push("Emergency Stop must be OFF to build a live transaction preview.");
  if (!acceptedDecision) blockers.push("No accepted decision found. Run /quotes and /decisions first.");
  if (!isAddress(routerAddress)) blockers.push("KATANA_V3_SWAP_ROUTER_ADDRESS is missing or invalid.");
  if (!isAddress(recipientAddress)) blockers.push("LIVE_TRADE_RECIPIENT_ADDRESS is missing or invalid. Use your dedicated test wallet address.");

  const token = acceptedDecision
    ? await prisma.token.findUnique({ where: { id: acceptedDecision.tokenId } })
    : null;

  const quote = acceptedDecision
    ? await prisma.quote.findFirst({ where: { tokenId: acceptedDecision.tokenId }, orderBy: { createdAt: "desc" } })
    : null;

  if (!token && acceptedDecision) blockers.push("Accepted decision token was not found.");
  if (!quote && acceptedDecision) blockers.push("No latest quote found for accepted decision token.");

  if (token) {
    if (token.poolType !== "KATANA_V3") blockers.push("Transaction builder currently supports KATANA_V3 only.");
    if (!isAddress(token.contractAddress)) blockers.push("Token contract address is invalid.");
    if (!isAddress(token.baseTokenAddress)) blockers.push("Base token address is invalid.");
    if (!token.feeTier) blockers.push("V3 fee tier is missing.");
  }

  let transaction = null;
  let preview = null;

  if (settings && acceptedDecision && token && quote && isAddress(routerAddress) && isAddress(recipientAddress) && blockers.length === 0) {
    const amountIn = Number(quote.amountIn || settings.maxTradeSizeUsd || 0);
    const expectedAmountOut = Number(quote.amountOut || 0);
    const maxSlippagePct = Number(settings.maxSlippagePct || 0.7);
    const minimumAmountOut = expectedAmountOut * (1 - maxSlippagePct / 100);
    const deadlineSeconds = Math.floor(Date.now() / 1000) + 60 * 5;

    let amountInRaw = "";
    let amountOutMinimumRaw = "";
    let calldata = "";

    try {
      amountInRaw = parseUnits(String(amountIn), 18).toString();
      amountOutMinimumRaw = parseUnits(String(minimumAmountOut), token.decimals || 18).toString();

      const routerInterface = new Interface(SWAP_ROUTER_ABI);
      const params = {
        tokenIn: token.baseTokenAddress!,
        tokenOut: token.contractAddress,
        fee: Number(token.feeTier),
        recipient: recipientAddress!,
        deadline: deadlineSeconds,
        amountIn: amountInRaw,
        amountOutMinimum: amountOutMinimumRaw,
        sqrtPriceLimitX96: 0,
      };

      calldata = routerInterface.encodeFunctionData("exactInputSingle", [params]);

      transaction = {
        to: routerAddress,
        value: "0",
        data: calldata,
      };

      preview = {
        type: "KATANA_V3_EXACT_INPUT_SINGLE_CALLDATA",
        routerAddress,
        maskedRouterAddress: maskAddress(routerAddress),
        recipientAddress,
        maskedRecipientAddress: maskAddress(recipientAddress),
        tokenInSymbol: token.baseToken,
        tokenInAddress: token.baseTokenAddress,
        tokenOutSymbol: token.symbol,
        tokenOutAddress: token.contractAddress,
        feeTier: token.feeTier,
        amountIn,
        amountInRaw,
        expectedAmountOut,
        minimumAmountOut,
        amountOutMinimumRaw,
        maxSlippagePct,
        entryPrice: quoteEntryPrice(quote),
        deadlineSeconds,
        deadlineHuman: new Date(deadlineSeconds * 1000).toISOString(),
        decisionId: acceptedDecision.id,
        quoteId: quote.id,
        tradeScore: acceptedDecision.tradeScore,
      };

      warnings.push("This only builds calldata. It does not approve, sign, or send.");
      warnings.push("Your wallet must have enough tokenIn allowance for the router before sending this transaction.");
      warnings.push("Use a tiny dedicated test wallet only.");
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : "Failed to build calldata.");
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    settings,
    acceptedDecision,
    token,
    quote,
    preview,
    transaction,
    blockers,
    warnings,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
