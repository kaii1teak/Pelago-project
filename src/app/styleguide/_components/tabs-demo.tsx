"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RANGES = ["24h", "7d", "30d", "1y"] as const;

export function TabsDemo() {
  const [range, setRange] = useState<string>("7d");

  return (
    <Tabs value={range} onValueChange={setRange}>
      <TabsList aria-label="Chart range">
        {RANGES.map((r) => (
          <TabsTrigger key={r} value={r}>
            {r}
          </TabsTrigger>
        ))}
      </TabsList>
      {RANGES.map((r) => (
        <TabsContent key={r} value={r} className="text-body-md text-secondary">
          Showing the <span className="num text-primary">{r}</span> range.
        </TabsContent>
      ))}
    </Tabs>
  );
}
