export function runPaperTrade(entry:number,exit:number,qty:number,side:'BUY'|'SELL'){const pnl=(side==='BUY'?(exit-entry):(entry-exit))*qty; return {pnl,roiPct:(pnl/(entry*qty))*100};}
