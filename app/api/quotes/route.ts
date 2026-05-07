import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Contract, JsonRpcProvider, formatUnits, parseUnits } from "ethers";

const prisma = new PrismaClient();

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
];

const V2_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

function isAddress(value: string | null | undefined) {
  return !!value && value.startsWith("0x") && value.length === 42;
}

function constantProductAmountOut(amountIn: number, reserveIn: number, reserveOut: number, feePct = 0.3) {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;
  const amountInWithFee = amountIn * (1 - feePct / 100);
  return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
}

function priceImpactPct(amountIn: number, reserveIn: number, reserveOut: number, amountOut: number) {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0 || amountOut <= 0) return 100;
  const spotOut = amountIn * (reserveOut / reserveIn);
  return Math.max(0, ((spotOut - amountOut) / spotOut) * 100);
}

async function quoteV2(token: any, settings: any, provider: JsonRpcProvider) {
  if (!isAddress(token.pairAddress)) {
    throw new Error("Missing or invalid V2 pair address.");
  }
  if (!isAddress(token.baseTokenAddress)) {
    throw new Error("Missing base token address. Add it in /tokens before quoting.");
  }

  const pair = new Contract(token.pairAddress, V2_PAIR_ABI, provider);
  const [token0, token1, reserves] = await Promise.all([
    pair.token0(),
    pair.token1(),
    pair.getReserves(),
  ]);

  const tokenAddress = token.contractAddress.toLowerCase();
  const baseAddress = token.baseTokenAddress.toLowerCase();
  const token0Lower = String(token0).toLowerCase();
  const token1Lower = String(token1).toLowerCase();

  const tokenContract = new Contract(token.contractAddress, ERC20_ABI, provider);
  const baseContract = new Contract(token.baseTokenAddress, ERC20_ABI, provider);
  const [chainTokenDecimals, baseDecimals] = await Promise.all([
    tokenContract.decimals(),
    baseContract.decimals(),
  ]);

  let reserveTokenRaw;
  let reserveBaseRaw;

  if (token0Lower === tokenAddress && token1Lower === baseAddress) {
    reserveTokenRaw = reserves.reserve0;
    reserveBaseRaw = reserves.reserve1;
  } else if (token1Lower === tokenAddress && token0Lower === baseAddress) {
    reserveTokenRaw = reserves.reserve1;
    reserveBaseRaw = reserves.reserve0;
  } else {
    throw new Error("Pair does not contain the configured token/base token addresses.");
  }

  const tokenReserve = Number(formatUnits(reserveTokenRaw, Number(chainTokenDecimals)));
  const baseReserve = Number(formatUnits(reserveBaseRaw, Number(baseDecimals)));
  const amountInBase = Number(settings?.maxTradeSizeUsd || 25);
  const amountOutToken = constantProductAmountOut(amountInBase, baseReserve, tokenReserve);
  const buyImpact = priceImpactPct(amountInBase, baseReserve, tokenReserve, amountOutToken);
  const sellBackBase = constantProductAmountOut(amountOutToken, tokenReserve - amountOutToken, baseReserve + amountInBase);
  const sellImpact = priceImpactPct(amountOutToken, tokenReserve - amountOutToken, baseReserve + amountInBase, sellBackBase);
  const roundTripImpact = Math.max(0, ((amountInBase - sellBackBase) / amountInBase) * 100);
  const priceBasePerToken = tokenReserve > 0 ? baseReserve / tokenReserve : 0;
  const confidence = isFinite(priceBasePerToken) && tokenReserve > 0 && baseReserve > 0 ? Math.max(0, 100 - roundTripImpact) : 0;

  const saved = await prisma.quote.create({
    data: {
      tokenId: token.id,
      side: "BUY",
      amountIn: String(amountInBase),
      amountOut: String(amountOutToken),
      priceImpactPct: buyImpact,
      roundTripImpactPct: roundTripImpact,
      liquidityUsd: baseReserve * 2,
      quoteSource: "KATANA_V2_PAIR_RESERVES",
      confidence,
    },
  });

  return {
    ok: true,
    token,
    quote: saved,
    metrics: {
      priceBasePerToken,
      tokenReserve,
      baseReserve,
      amountInBase,
      amountOutToken,
      buyImpact,
      sellImpact,
      roundTripImpact,
      estimatedSellBackBase: sellBackBase,
      liquidityApproxBase: baseReserve * 2,
      confidence,
    },
    message: "V2 quote calculated from pair reserves.",
  };
}

async function quoteToken(token: any, settings: any, provider: JsonRpcProvider) {
  if (!token.isActive) {
    return { ok: false, token, message: "Token inactive.", metrics: null };
  }

  if (!isAddress(token.contractAddress)) {
    return { ok: false, token, message: "Invalid token contract address.", metrics: null };
  }

  if (token.poolType === "KATANA_V2") {
    return quoteV2(token, settings, provider);
  }

  if (token.poolType === "KATANA_V3") {
    return {
      ok: false,
      token,
      message: "KATANA_V3 needs quoter contract wiring. Add feeTier now, then wire V3Quoter next.",
      metrics: null,
    };
  }

  return { ok: false, token, message: `Unsupported pool type ${token.poolType}.`, metrics: null };
}

export async function GET() {
  const rpcUrl = process.env.RONIN_RPC_URL || "https://api.roninchain.com/rpc";
  const chainId = Number(process.env.RONIN_CHAIN_ID || 2020);
  const provider = new JsonRpcProvider(rpcUrl, chainId);

  const [settings, tokens] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ where: { isActive: true }, orderBy: { symbol: "asc" } }),
  ]);

  const results = [];

  for (const token of tokens) {
    try {
      results.push(await quoteToken(token, settings, provider));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quote failed.";
      await prisma.riskEvent.create({
        data: {
          tokenId: token.id,
          reason: `Quote failed: ${message}`,
          severity: "warning",
        },
      });
      results.push({ ok: false, token, message, metrics: null });
    }
  }

  await prisma.botLog.create({
    data: {
      level: "info",
      message: "Quote scan completed.",
      meta: JSON.stringify({ tokenCount: tokens.length, okCount: results.filter((result) => result.ok).length }),
    },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    results,
  });
}
