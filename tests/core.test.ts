import { describe,it,expect } from 'vitest';
import { calcV2PriceImpactPct } from '@/lib/priceImpact';
import { scoreTrade } from '@/lib/tradeScorer';
import { runPaperTrade } from '@/lib/paperTrader';
import { validateTrade } from '@/lib/riskEngine';

describe('price impact',()=>{it('positive',()=>{expect(calcV2PriceImpactPct(100,10000,10000)).toBeGreaterThan(0);});});
describe('trade score',()=>{it('bounded',()=>{const s=scoreTrade({expectedProfitPct:3,liquidityUsd:100000,buyImpactPct:0.3,sellImpactPct:0.4,volume24hUsd:200000,volatility:1,spreadPct:0.2,confidence:80});expect(s).toBeGreaterThanOrEqual(0);expect(s).toBeLessThanOrEqual(100);});});
describe('paper trader',()=>{it('pnl',()=>{expect(runPaperTrade(1,1.1,100,'BUY').pnl).toBeCloseTo(10);});});
describe('risk',()=>{it('rejects blacklist',()=>{const r=validateTrade({botMode:'LIVE',emergencyStop:false,maxBuyImpactPct:1,maxSellImpactPct:1,maxRoundTripImpactPct:2,minPoolLiquidityUsd:1,minExitLiquidityUsd:1,minRecentVolumeUsd:1,maxSlippagePct:1,minExpectedProfitPct:1,maxDailyLossUsd:100,whitelistOnly:false,maxWalletExposurePct:30,maxTokenExposurePct:20,requireManualApproval:false,minTradeScore:50},{mode:'LIVE',buyImpactPct:0.1,sellImpactPct:0.1,poolLiquidityUsd:10,exitLiquidityUsd:10,volume24hUsd:10,slippagePct:0.1,expectedProfitPct:2,dailyLossUsd:0,cooldownActive:false,blacklisted:true,whitelisted:true,walletExposurePct:1,tokenExposurePct:1,manualApproval:true,tradeScore:90});expect(r.accepted).toBe(false);});});
