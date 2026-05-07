import { Contract } from 'ethers'; import { provider } from './provider'; import { KATANA_V2_PAIR_ABI } from './contracts'; import { calcV2PriceImpactPct } from './priceImpact';
export async function getV2Impact(pair:string,amountIn:number){const p=new Contract(pair,KATANA_V2_PAIR_ABI,provider); const [r0,r1]=await p.getReserves(); return calcV2PriceImpactPct(amountIn,Number(r0),Number(r1));}
