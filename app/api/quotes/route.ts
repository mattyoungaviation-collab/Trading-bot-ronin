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

const V3_POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
];

const V3_QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
];

const DEFAULT_RPC_URLS = [
  "https://api.roninchain.com/rpc",
  "https://ronin.lgns.net/rpc",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRpcUrls() {
  const envUrls = process.env.RONIN_RPC_URLS
    ? process.env.RONIN_RPC_URLS.split(",").map((url) => url.trim()).filter(Boolean)
    : [];
  const primaryUrl = process.env.RONIN_RPC_URL ? [process.env.RONIN_RPC_URL.trim()] : [];
  return Array.from(new Set([...envUrls, ...primaryUrl, ...DEFAULT_RPC_URLS]));
}

function isRpcFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Too many requests") || message.includes("522") || message.includes("SERVER_ERROR") || message.includes("timeout") || message.includes("Bad Request");
}

function isAddress(value: string | null | undefined) {
  return !!value && value.startsWith("0x") && value.length === 42;
}

function requireAddress(value: string | null | undefined, label: string): string {
  if (!isAddress(value)) {
    throw new Error(`Missing or invalid ${label}.`);
  }
  return value as string;
}

function constantProductAmountOut(amountIn: number, reserveIn: number, reserveOut: number, feePct = 0.3) {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;
  const amountInWithFee = amountIn * (1 - feePct / 100);
  return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
}

function priceImpactFromSpot(spotOut: number, amountOut: number) {
  if (spotOut <= 0 || amountOut <= 0) return 100;
  return Math.max(0, ((spotOut - amountOut) / spotOut) * 100);
}

function priceImpactPct(amountIn: number, reserveIn: number, reserveOut: number, amountOut: number) {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0 || amountOut <= 0) return 100;
  const spotOut = amountIn * (reserveOut / reserveIn);
  return priceImpactFromSpot(spotOut, amountOut);
}

function humanPriceToken1PerToken0(sqrtPriceX96: bigint, decimals0: number, decimals1: number) {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  const rawPrice = ratio * ratio;
  return rawPrice * 10 ** decimals0 / 10 ** decimals1;
}

async function quoteV2(token: any, settings: any, provider: JsonRpcProvider, rpcUrl: string) {
  const pairAddress = requireAddress(token.pairAddress, "V2 pair address");
  const baseTokenAddress = requireAddress(token.baseTokenAddress, "base token address. Add it in /tokens before quoting");
  const tokenAddressConfig = requireAddress(token.contractAddress, "token contract address");

  const pair = new Contract(pairAddress, V2_PAIR_ABI, provider);
  const token0 = await pair.token0();
  await sleep(150);
  const token1 = await pair.token1();
  await sleep(150);
  const reserves = await pair.getReserves();

  const tokenAddress = tokenAddressConfig.toLowerCase();
  const baseAddress = baseTokenAddress.toLowerCase();
  const token0Lower = String(token0).toLowerCase();
  const token1Lower = String(token1).toLowerCase();

  const tokenContract = new Contract(tokenAddressConfig, ERC20_ABI, provider);
  const baseContract = new Contract(baseTokenAddress, ERC20_ABI, provider);
  const chainTokenDecimals = await tokenContract.decimals();
  await sleep(150);
  const baseDecimals = await baseContract.decimals();

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
      quoteSource: `KATANA_V2_PAIR_RESERVES:${rpcUrl}`,
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
      rpcUrl,
    },
    message: "V2 quote calculated from pair reserves.",
  };
}

async function quoteV3(token: any, settings: any, provider: JsonRpcProvider, rpcUrl: string) {
  const quoterAddress = requireAddress(process.env.KATANA_V3_QUOTER_ADDRESS || null, "KATANA_V3_QUOTER_ADDRESS environment variable. Add the verified Ronin Katana V3 quoter address in Render before quoting V3 pools");
  const poolAddress = requireAddress(token.pairAddress, "V3 pool address");
  const baseTokenAddress = requireAddress(token.baseTokenAddress, "base token address. Add it in /tokens before quoting");
  const tokenAddressConfig = requireAddress(token.contractAddress, "token contract address");

  if (!token.feeTier) {
    throw new Error("Missing V3 fee tier. Add feeTier in /tokens, for example 500, 3000, or 10000 if that matches the pool.");
  }

  const pool = new Contract(poolAddress, V3_POOL_ABI, provider);
  const quoter = new Contract(quoterAddress, V3_QUOTER_ABI, provider);
  const tokenContract = new Contract(tokenAddressConfig, ERC20_ABI, provider);
  const baseContract = new Contract(baseTokenAddress, ERC20_ABI, provider);

  const poolToken0 = await pool.token0();
  await sleep(150);
  const poolToken1 = await pool.token1();
  await sleep(150);
  const poolFee = await pool.fee();
  await sleep(150);
  const poolLiquidity = await pool.liquidity();
  await sleep(150);
  const slot0 = await pool.slot0();
  await sleep(150);
  const chainTokenDecimals = await tokenContract.decimals();
  await sleep(150);
  const baseDecimals = await baseContract.decimals();

  const tokenAddress = tokenAddressConfig.toLowerCase();
  const baseAddress = baseTokenAddress.toLowerCase();
  const token0Lower = String(poolToken0).toLowerCase();
  const token1Lower = String(poolToken1).toLowerCase();

  if (!((token0Lower === tokenAddress && token1Lower === baseAddress) || (token1Lower === tokenAddress && token0Lower === baseAddress))) {
    throw new Error("V3 pool does not contain the configured token/base token addresses.");
  }

  if (Number(poolFee) !== Number(token.feeTier)) {
    throw new Error(`Configured feeTier ${token.feeTier} does not match pool fee ${Number(poolFee)}.`);
  }

  const amountInBase = Number(settings?.maxTradeSizeUsd || 25);
  const amountInRaw = parseUnits(String(amountInBase), Number(baseDecimals));
  const buyQuote = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: baseTokenAddress,
    tokenOut: tokenAddressConfig,
    amountIn: amountInRaw,
    fee: Number(token.feeTier),
    sqrtPriceLimitX96: 0,
  });
  await sleep(150);

  const amountOutToken = Number(formatUnits(buyQuote.amountOut, Number(chainTokenDecimals)));

  const sellAmountRaw = parseUnits(String(amountOutToken), Number(chainTokenDecimals));
  const sellQuote = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: tokenAddressConfig,
    tokenOut: baseTokenAddress,
    amountIn: sellAmountRaw,
    fee: Number(token.feeTier),
    sqrtPriceLimitX96: 0,
  });

  const sellBackBase = Number(formatUnits(sellQuote.amountOut, Number(baseDecimals)));

  const price1Per0 = humanPriceToken1PerToken0(BigInt(slot0.sqrtPriceX96), token0Lower === baseAddress ? Number(baseDecimals) : Number(chainTokenDecimals), token0Lower === baseAddress ? Number(chainTokenDecimals) : Number(baseDecimals));
  const spotOut = token0Lower === baseAddress ? amountInBase * price1Per0 : amountInBase / price1Per0;
  const buyImpact = priceImpactFromSpot(spotOut, amountOutToken);
  const roundTripImpact = Math.max(0, ((amountInBase - sellBackBase) / amountInBase) * 100);
  const sellImpact = roundTripImpact;
  const priceBasePerToken = amountOutToken > 0 ? amountInBase / amountOutToken : 0;
  const confidence = amountOutToken > 0 && sellBackBase > 0 ? Math.max(0, 100 - roundTripImpact) : 0;

  const saved = await prisma.quote.create({
    data: {
      tokenId: token.id,
      side: "BUY",
      amountIn: String(amountInBase),
      amountOut: String(amountOutToken),
      priceImpactPct: buyImpact,
      roundTripImpactPct: roundTripImpact,
      liquidityUsd: 0,
      quoteSource: `KATANA_V3_QUOTER:${rpcUrl}`,
      confidence,
    },
  });

  return {
    ok: true,
    token,
    quote: saved,
    metrics: {
      priceBasePerToken,
      tokenReserve: Number(poolLiquidity),
      baseReserve: 0,
      amountInBase,
      amountOutToken,
      buyImpact,
      sellImpact,
      roundTripImpact,
      estimatedSellBackBase: sellBackBase,
      liquidityApproxBase: 0,
      confidence,
      poolFee: Number(poolFee),
      initializedTicksCrossed: Number(buyQuote.initializedTicksCrossed),
      gasEstimate: Number(buyQuote.gasEstimate),
      rpcUrl,
    },
    message: "V3 quote calculated with QuoterV2. Liquidity uses V3 active liquidity, not simple reserves.",
  };
}

async function quoteTokenWithProvider(token: any, settings: any, provider: JsonRpcProvider, rpcUrl: string) {
  if (!token.isActive) {
    return { ok: false, token, message: "Token inactive.", metrics: null };
  }

  if (!isAddress(token.contractAddress)) {
    return { ok: false, token, message: "Invalid token contract address.", metrics: null };
  }

  if (token.poolType === "KATANA_V2") {
    return quoteV2(token, settings, provider, rpcUrl);
  }

  if (token.poolType === "KATANA_V3") {
    return quoteV3(token, settings, provider, rpcUrl);
  }

  return { ok: false, token, message: `Unsupported pool type ${token.poolType}.`, metrics: null };
}

async function quoteToken(token: any, settings: any, rpcUrls: string[], chainId: number) {
  let lastError: unknown = null;

  for (const rpcUrl of rpcUrls) {
    const provider = new JsonRpcProvider(rpcUrl, chainId);
    try {
      return await quoteTokenWithProvider(token, settings, provider, rpcUrl);
    } catch (error) {
      lastError = error;
      if (!isRpcFailure(error)) {
        throw error;
      }
      await sleep(750);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All RPC endpoints failed.");
}

export async function GET() {
  const chainId = Number(process.env.RONIN_CHAIN_ID || 2020);
  const rpcUrls = getRpcUrls();

  const [settings, tokens] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.token.findMany({ where: { isActive: true }, orderBy: { symbol: "asc" } }),
  ]);

  const results = [];

  for (const token of tokens) {
    try {
      results.push(await quoteToken(token, settings, rpcUrls, chainId));
      await sleep(500);
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
      meta: JSON.stringify({ tokenCount: tokens.length, okCount: results.filter((result) => result.ok).length, rpcUrls }),
    },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    settings,
    rpcUrls,
    results,
  });
}
