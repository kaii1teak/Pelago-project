"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { createContext, use, useId, useState } from "react";
import { DURATION, EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Radix Tabs (roving focus, arrow keys, ARIA) with an underline that slides
 * between triggers. Radix only exposes the active tab as a data attribute, so
 * Tabs tracks the value too, which lets the active trigger render the
 * shared-layout underline.
 */

const TabsContext = createContext<{ value: string; indicatorId: string } | null>(null);

export type TabsProps = Omit<React.ComponentProps<typeof TabsPrimitive.Root>, "dir">;

export function Tabs({
  value: valueProp,
  defaultValue,
  onValueChange,
  ...props
}: TabsProps) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const indicatorId = useId();
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : inner;

  return (
    <TabsContext value={{ value, indicatorId }}>
      <TabsPrimitive.Root
        value={value}
        onValueChange={(next) => {
          if (!controlled) setInner(next);
          onValueChange?.(next);
        }}
        {...props}
      />
    </TabsContext>
  );
}

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "relative inline-flex items-center border-b border-primary",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = use(TabsContext);
  const active = ctx?.value === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative inline-flex h-10 items-center justify-center px-3 text-body-md font-medium whitespace-nowrap",
        "text-secondary transition-colors duration-150 ease-standard hover:text-primary data-[state=active]:text-primary",
        "disabled:pointer-events-none disabled:text-disabled",
        className,
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId={`${ctx.indicatorId}-underline`}
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px h-0.5 bg-inverse"
          transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
        />
      )}
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-6", className)} {...props} />;
}
