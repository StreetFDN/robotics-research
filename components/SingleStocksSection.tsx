'use client';

import StockChartCard from './StockChartCard';

interface StockTicker {
  ticker: string;
  name: string;
}

const STOCKS: StockTicker[] = [
  { ticker: 'ISRG', name: 'Intuitive Surgical' },
  { ticker: 'TER', name: 'Teradyne' },
  { ticker: 'ROK', name: 'Rockwell Automation' },
  { ticker: 'ZBRA', name: 'Zebra Technologies' },
  { ticker: 'CGNX', name: 'Cognex' },
  { ticker: 'SYM', name: 'Symbotic' },
  { ticker: 'SERV', name: 'ServiceNow' },
  { ticker: 'RR', name: 'Rolls-Royce' },
];

export default function SingleStocksSection() {
  return (
    <section className="w-full px-4 py-6 border-t border-gray-800">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white mb-1">Single Stocks</h2>
        <div className="text-xs text-gray-500">Individual robotics and automation equities</div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STOCKS.map((stock) => (
          <StockChartCard
            key={stock.ticker}
            ticker={stock.ticker}
            displayName={stock.name}
            defaultRange="1Y"
          />
        ))}
      </div>
    </section>
  );
}

