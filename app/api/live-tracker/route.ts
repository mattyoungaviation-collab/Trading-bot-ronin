import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { JsonRpcProvider } from "ethers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

function isTxHash(value: string | null | undefined) {
  return !!value && value.startsWith("0x") && value.length === 66;
}

function txUrl(txHash: string) {
  return `https://app.roninchain.com/tx/${txHash}`;
}

async function getProvider() {
  const rpcUrl = process.env.RONIN_RPC_URL || "https://api.roninchain.com/rpc";
  const chainId = Number(process.env.RONIN_CHAIN_ID || 2020);
  return new JsonRpcProvider(rpcUrl, chainId);
}

async function inspectTx(txHash: string) {
  const provider = await getProvider();
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(txHash),
    provider.getTransactionReceipt(txHash),
  ]);

  return {
    txFound: !!tx,
    receiptFound: !!receipt,
    status: receipt ? (receipt.status === 1 ? "CONFIRMED" : "FAILED") : (tx ? "PENDING" : "NOT_FOUND"),
    blockNumber: receipt?.blockNumber || null,
    confirmations: receipt ? await receipt.confirmations() : 0,
    from: tx?.from || null,
    to: tx?.to || null,
    gasUsed: receipt?.gasUsed ? receipt.gasUsed.toString() : null,
    hash: txHash,
    explorerUrl: txUrl(txHash),
  };
}

export async function GET() {
  const liveTrades = await prisma.liveTrade.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const tracked = [];

  for (const trade of liveTrades) {
    let chainStatus = null;
    if (trade.txHash && isTxHash(trade.txHash)) {
      try {
        chainStatus = await inspectTx(trade.txHash);

        if (chainStatus.status !== trade.status && ["CONFIRMED", "FAILED", "PENDING"].includes(chainStatus.status)) {
          await prisma.liveTrade.update({
            where: { id: trade.id },
            data: { status: chainStatus.status },
          });
        }
      } catch (error) {
        chainStatus = {
          status: "RPC_ERROR",
          message: error instanceof Error ? error.message : "Could not inspect transaction.",
        };
      }
    }

    tracked.push({
      ...trade,
      explorerUrl: trade.txHash ? txUrl(trade.txHash) : null,
      chainStatus,
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    liveTrades: tracked,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const txHash = String(body.txHash || "").trim();
  const side = String(body.side || "BUY").trim().toUpperCase();
  const tokenId = Number(body.tokenId || 0);
  const note = String(body.note || "manual transaction").trim();

  if (!isTxHash(txHash)) {
    return NextResponse.json({ error: "Invalid tx hash." }, { status: 400 });
  }

  const chainStatus = await inspectTx(txHash);

  let finalTokenId = Number.isFinite(tokenId) && tokenId > 0 ? tokenId : null;

  if (!finalTokenId) {
    const latestDecision = await prisma.tradeDecision.findFirst({ where: { accepted: true }, orderBy: { createdAt: "desc" } });
    finalTokenId = latestDecision?.tokenId || null;
  }

  if (!finalTokenId) {
    return NextResponse.json({ error: "No tokenId provided and no accepted decision found." }, { status: 400 });
  }

  const liveTrade = await prisma.liveTrade.create({
    data: {
      tokenId: finalTokenId,
      side,
      txHash,
      status: chainStatus.status,
      pnl: 0,
    },
  });

  await prisma.botLog.create({
    data: {
      level: chainStatus.status === "FAILED" ? "danger" : "info",
      message: "Tracked manual live transaction.",
      meta: JSON.stringify({ liveTradeId: liveTrade.id, txHash, side, note, chainStatus }),
    },
  });

  return NextResponse.json({
    ok: true,
    liveTrade,
    chainStatus,
    explorerUrl: txUrl(txHash),
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
