import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const allowedPoolTypes = new Set(["KATANA_V2", "KATANA_V3"]);

function cleanAddress(value: unknown) {
  return String(value || "").trim();
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function toInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function normalizePoolType(value: unknown) {
  const poolType = String(value || "KATANA_V2").trim().toUpperCase();
  return allowedPoolTypes.has(poolType) ? poolType : "KATANA_V2";
}

export async function GET() {
  const tokens = await prisma.token.findMany({
    orderBy: [{ isActive: "desc" }, { symbol: "asc" }],
  });

  return NextResponse.json(tokens);
}

export async function POST(request: Request) {
  const body = await request.json();

  const contractAddress = cleanAddress(body.contractAddress);
  const symbol = cleanText(body.symbol).toUpperCase();
  const name = cleanText(body.name);
  const baseToken = cleanText(body.baseToken).toUpperCase();

  if (!contractAddress || !symbol || !name || !baseToken) {
    return NextResponse.json(
      { error: "Name, symbol, contract address, and base token are required." },
      { status: 400 }
    );
  }

  const token = await prisma.token.upsert({
    where: { contractAddress },
    update: {
      name,
      symbol,
      decimals: toInt(body.decimals, 18),
      logoUrl: cleanText(body.logoUrl) || null,
      pairAddress: cleanText(body.pairAddress) || null,
      poolType: normalizePoolType(body.poolType),
      baseToken,
      isActive: toBoolean(body.isActive, true),
      notes: cleanText(body.notes) || null,
    },
    create: {
      name,
      symbol,
      contractAddress,
      decimals: toInt(body.decimals, 18),
      logoUrl: cleanText(body.logoUrl) || null,
      pairAddress: cleanText(body.pairAddress) || null,
      poolType: normalizePoolType(body.poolType),
      baseToken,
      isActive: toBoolean(body.isActive, true),
      notes: cleanText(body.notes) || null,
    },
  });

  return NextResponse.json(token);
}
