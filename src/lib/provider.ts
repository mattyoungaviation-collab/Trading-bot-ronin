import { JsonRpcProvider, Wallet } from 'ethers';
import { NETWORKS } from '@/config/networks';
export const provider = new JsonRpcProvider(NETWORKS.RONIN_MAINNET.rpcUrl, NETWORKS.RONIN_MAINNET.chainId);
export const getTradingWallet = () => {
  const key = process.env.TRADING_PRIVATE_KEY;
  if (!key) throw new Error('TRADING_PRIVATE_KEY missing');
  return new Wallet(key, provider);
};
