import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { JsonRpcProvider } from "ethers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function tokenReadiness(token: {
  contractAddress: string;
  pairAddress: string | null;
  poolType: string;
  baseToken: string;
  isActive: boolean;
}) {
  const reasons: string[] = [];

  if (!token.isActive) reasons.push("inactive");
  if (!token.contractAddress.startsWith("0x") || token.contractAddress.length !== 42) reasons.push("contract address needs verification");
  if (!token.pairAddress) reasons.push("pool address missing");
  if (token.pairAddress && (!token.pairAddress.startsWith("0x") || token.pairAddress.length !== 42)) reasons.push("pool address needs verification");
  if (!token.baseToken) reasons.push("base token missing");
  if (!token.poolType) reasons.push("pool type missing");

  return {
    ready: reasons.length === 0,
    reasons,
  };
}

export async function GET() {
  const [settings, tokens, rpcStatus] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ orderBy: [{ isActive: "desc" }, { symbol: "asc" }] }),
    getRpcStatus(),
  ]);

  const enrichedTokens = tokens.map((token) => ({
    ...token,
    readiness: tokenReadiness(token),
  }));

  const activeTokens = enrichedTokens.filter((token) => token.isActive);
  const readyTokens = enrichedTokens.filter((token) => token.readiness.ready);

  const observations = [
    settings?.emergencyStop ? "Emergency Stop is ON. Watch mode is safe." : "Emergency Stop is OFF. Keep bot mode conservative.",
    settings?.botMode === "LIVE" ? "LIVE is selected. Do not add wallet keys until Watch and Paper are proven." : `Bot mode is ${settings?.botMode || "UNKNOWN"}.`,
    `${activeTokens.length} active token(s) found.`,
    `${readyTokens.length} token(s) appear ready for pool watching.`,
    rpcStatus.ok ? `Ronin RPC is reachable at block ${rpcStatus.blockNumber}.` : `Ronin RPC issue: ${rpcStatus.message}`,
  ];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    rpcStatus,
    tokens: enrichedTokens,
    observations,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
