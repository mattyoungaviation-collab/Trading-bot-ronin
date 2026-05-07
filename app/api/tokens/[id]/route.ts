import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const allowedPoolTypes = new Set(["KATANA_V2", "KATANA_V3"]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function toInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toNullableInt(value: unknown, fallback: number | null) {
  if (value === "" || value === null || value === undefined) return null;
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid token id." }, { status: 400 });
  }

  const current = await prisma.token.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Token not found." }, { status: 404 });
  }

  const body = await request.json();

  const token = await prisma.token.update({
    where: { id },
    data: {
      name: cleanText(body.name) || current.name,
      symbol: cleanText(body.symbol).toUpperCase() || current.symbol,
      decimals: toInt(body.decimals, current.decimals),
      logoUrl: cleanText(body.logoUrl) || null,
      pairAddress: cleanText(body.pairAddress) || null,
      poolType: normalizePoolType(body.poolType || current.poolType),
      baseToken: cleanText(body.baseToken).toUpperCase() || current.baseToken,
      baseTokenAddress: cleanText(body.baseTokenAddress) || null,
      feeTier: toNullableInt(body.feeTier, current.feeTier),
      isActive: toBoolean(body.isActive, current.isActive),
      notes: cleanText(body.notes) || null,
    },
  });

  return NextResponse.json(token);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid token id." }, { status: 400 });
  }

  await prisma.token.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
