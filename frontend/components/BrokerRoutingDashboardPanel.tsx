"use client";

import { useEffect, useState } from "react";

export default function BrokerRoutingDashboardPanel() {
  const [data, setData] = useState<any>(null);

  async function load() {
    const response = await fetch("/api/broker-routing-layer");
    const json = await response.json();
    setData(json.report);
  }

  useEffect(() => {
    load();

    const interval = setInterval(load, 15000);

    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="rounded-xl border border-cyan-500 p-6">
        Loading Broker Routing Layer...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-500 p-6 bg-black">
      <h2 className="text-2xl font-bold mb-4">
        ?? Broker Routing Layer V12.0.3
      </h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <div className="text-sm">Routed</div>
          <div className="text-3xl text-green-400">
            {data.routedItems}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm">Waiting</div>
          <div className="text-3xl text-yellow-400">
            {data.waitingItems}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm">Blocked</div>
          <div className="text-3xl text-red-400">
            {data.blockedItems}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm">Mode</div>
          <div className="text-xl text-cyan-400">
            {data.mode}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <div>Paper Broker</div>
          <div className="text-2xl text-green-400">
            {data.paperBrokerRoutes}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div>Capital.com</div>
          <div className="text-2xl text-blue-400">
            {data.capitalComRoutes}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div>IC Markets</div>
          <div className="text-2xl text-cyan-400">
            {data.icMarketsRoutes}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.routes.map((route: any) => (
          <div
            key={route.id}
            className="border rounded-lg p-4"
          >
            <div className="font-bold">
              {route.symbol}
            </div>

            <div>
              Broker: {route.preferredBroker}
            </div>

            <div>
              Status: {route.brokerRouteStatus}
            </div>

            <div>
              Priority: {route.executionPriority}
            </div>

            <div>
              Position Size: {route.finalPositionSize}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
