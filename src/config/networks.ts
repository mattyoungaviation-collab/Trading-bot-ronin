export const NETWORKS = {
  RONIN_MAINNET: { chainId: 2020, rpcUrl: process.env.RONIN_RPC_URL ?? 'https://api.roninchain.com/rpc' },
  SAIGON_TESTNET: { chainId: 202601, rpcUrl: process.env.SAIGON_RPC_URL ?? '' }
} as const;

export const KATANA_CONTRACTS = {
  // Source: https://docs.katana.network/katana/technical-reference/contract-addresses/
  V2Factory: '0x72D111b4d6f31B38919ae39779f570b747d6Acd9',
  V2Router: '0x69cC349932ae18ED406eeB917d79b9b3033fB68E',
  V3Factory: '0x203e8740894c8955cB8950759876d7E7E45E04c1',
  V3QuoterV2: '0x92dea23ED1C683940fF1a2f8fE23FE98C5d3041c',
  V3SwapRouter: '0x4e1d81A3E627b9294532e990109e4c21d217376C'
} as const;
