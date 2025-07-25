import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon } from "@radix-ui/react-icons"

import { cn } from "@/utils/cn";

/**
 * @typedef {Object} AccordionItemProps
 * @property {React.ReactNode} children
 * @property {string} value
 * @property {string} [className]
 */

/**
 * @typedef {Object} AccordionTriggerProps
 * @property {React.ReactNode} children
 * @property {string} [className]
 */

/**
 * @typedef {Object} AccordionContentProps
 * @property {React.ReactNode} children
 * @property {string} [className]
 */

const Accordion = AccordionPrimitive.Root

/** @type {React.ForwardRefExoticComponent<AccordionItemProps & React.RefAttributes<any>>} */
const AccordionItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("", className)} {...props}>
    {children}
  </AccordionPrimitive.Item>
))
AccordionItem.displayName = "AccordionItem"

/** @type {React.ForwardRefExoticComponent<AccordionTriggerProps & React.RefAttributes<any>>} */
const AccordionTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-2 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}>
      {children}
      <ChevronDownIcon
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

/** @type {React.ForwardRefExoticComponent<AccordionContentProps & React.RefAttributes<any>>} */
const AccordionContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}>
    <div className={cn("pb-2 pt-0 ", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
