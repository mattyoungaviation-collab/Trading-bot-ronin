export const ERC20_ABI = ['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns (bool)','function decimals() view returns(uint8)'];
export const KATANA_V2_PAIR_ABI = ['function getReserves() view returns(uint112,uint112,uint32)','function token0() view returns(address)','function token1() view returns(address)'];
export const KATANA_V2_ROUTER_ABI = ['function getAmountsOut(uint256,address[]) view returns(uint256[])','function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns(uint256[])'];
export const KATANA_V3_QUOTER_ABI = ['function quoteExactInputSingle((address,address,uint256,uint24,uint160)) returns (uint256 amountOut,uint160,uint32,uint256)'];
export const KATANA_V3_ROUTER_ABI = ['function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) payable returns(uint256 amountOut)'];
