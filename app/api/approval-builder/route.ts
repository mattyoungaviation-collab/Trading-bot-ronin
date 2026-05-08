import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Interface, parseUnits } from "ethers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

const ERC20_APPROVAL_ABI = [
  "function approve(address spender,uint256 amount) returns (bool)",
];

function isAddress(value: string | null | undefined) {
  return !!value && value.startsWith("0x") && value.length === 42;
}

function maskAddress(address: string | null | undefined) {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
  if (settings?.botMode !== "LIVE") blockers.push("Bot Mode must be LIVE to build approval calldata.");
  if (settings?.emergencyStop) blockers.push("Emergency Stop must be OFF to build approval calldata.");
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
    if (!isAddress(token.baseTokenAddress)) blockers.push("Base token address is invalid.");
    if (!token.baseToken) blockers.push("Base token symbol is missing.");
  }

  let approval = null;
  let transaction = null;

  if (settings && acceptedDecision && token && quote && isAddress(routerAddress) && isAddress(recipientAddress) && blockers.length === 0) {
    try {
      const amount = Number(quote.amountIn || settings.maxTradeSizeUsd || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        blockers.push("Approval amount is invalid.");
      } else {
        const amountRaw = parseUnits(String(amount), 18).toString();
        const iface = new Interface(ERC20_APPROVAL_ABI);
        const calldata = iface.encodeFunctionData("approve", [routerAddress, amountRaw]);

        transaction = {
          to: token.baseTokenAddress,
          value: "0",
          data: calldata,
        };

        approval = {
          type: "ERC20_EXACT_AMOUNT_APPROVAL_CALLDATA",
          tokenSymbol: token.baseToken,
          tokenAddress: token.baseTokenAddress,
          maskedTokenAddress: maskAddress(token.baseTokenAddress),
          spenderName: "Katana V3 Swap Router",
          spenderAddress: routerAddress,
          maskedSpenderAddress: maskAddress(routerAddress),
          recipientAddress,
          maskedRecipientAddress: maskAddress(recipientAddress),
          amount,
          amountRaw,
          quoteId: quote.id,
          decisionId: acceptedDecision.id,
          warning: "Exact amount approval only. This does not approve unlimited spending, sign, or send.",
        };

        warnings.push("This only builds approval calldata. It does not sign or send.");
        warnings.push("This approval is for the exact quote input amount, not unlimited approval.");
        warnings.push("Use a tiny dedicated test wallet only.");
      }
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : "Failed to build approval calldata.");
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    settings,
    acceptedDecision,
    token,
    quote,
    approval,
    transaction,
    blockers,
    warnings,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
