"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Download,
  Info,
  LogOut,
  PackageOpen,
  Plus,
  Search,
  Settings,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const COMBOBOX_OPTIONS: ComboboxOption[] = [
  { value: "asus", label: "ASUS" },
  { value: "msi", label: "MSI" },
  { value: "hp", label: "HP" },
  { value: "dell", label: "Dell" },
  { value: "lenovo", label: "Lenovo" },
];

/**
 * Primitives section of the `/design` living style guide.
 *
 * docs/05-DESIGN-SYSTEM.md §10's definition of done for the design-system
 * phase requires "a single internal `/_design` route [that] renders every
 * component in every variant and every state ... and contains no hardcoded
 * colour, radius, or font value" (the leading underscore is a naming
 * adjustment for Next.js routing — the working route is `src/app/design/`).
 * This component is that inventory for every primitive under
 * `src/components/ui/`: every visual choice below comes from an existing
 * Tailwind utility class or a primitive's own prop, never a raw hex/px value.
 */
export function PrimitivesSection() {
  const [comboboxValue, setComboboxValue] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dropdownTheme, setDropdownTheme] = useState("light");
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-12">
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-8">
          <h2 className="text-headline-md text-on-surface">Buttons &amp; Actions</h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Button</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm">
                Primary sm
              </Button>
              <Button variant="primary" size="md">
                Primary md
              </Button>
              <Button variant="primary" size="lg">
                Primary lg
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost">Ghost</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="mono">Mono</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="icon" iconOnly aria-label="Settings">
                <Settings />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" glow>
                Glow
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <Button variant="outline" size="sm" iconOnly aria-label="Download spec sheet">
                <Download />
              </Button>
              <Button variant="primary">
                <Plus />
                With icon
              </Button>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-8">
          <h2 className="text-headline-md text-on-surface">Form Controls</h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Label &amp; Input</h3>
            <div className="flex max-w-sm flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="primitives-input-default">Email</Label>
                <Input id="primitives-input-default" placeholder="you@example.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="primitives-input-disabled">Disabled</Label>
                <Input id="primitives-input-disabled" placeholder="Disabled" disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="primitives-input-error">Phone number</Label>
                <Input
                  id="primitives-input-error"
                  defaultValue="98X"
                  error
                  aria-invalid="true"
                  aria-describedby="primitives-input-error-message"
                />
                <p
                  id="primitives-input-error-message"
                  role="alert"
                  className="text-body-sm text-danger"
                >
                  Enter a valid 10-digit number.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Textarea</h3>
            <div className="flex max-w-sm flex-col gap-4">
              <Textarea placeholder="Tell us about the issue" />
              <Textarea placeholder="Disabled" disabled />
              <Textarea defaultValue="Too short" error aria-invalid="true" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Checkbox</h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="primitives-checkbox-unchecked" />
                <Label htmlFor="primitives-checkbox-unchecked">Unchecked</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="primitives-checkbox-checked" defaultChecked />
                <Label htmlFor="primitives-checkbox-checked">Checked</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="primitives-checkbox-disabled" disabled />
                <Label htmlFor="primitives-checkbox-disabled">Disabled</Label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">RadioGroup</h3>
            <RadioGroup defaultValue="pickup" className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pickup" id="primitives-radio-pickup" />
                <Label htmlFor="primitives-radio-pickup">Store pickup</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="delivery" id="primitives-radio-delivery" />
                <Label htmlFor="primitives-radio-delivery">Home delivery</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="courier" id="primitives-radio-disabled" disabled />
                <Label htmlFor="primitives-radio-disabled">Disabled</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Switch</h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch id="primitives-switch-off" />
                <Label htmlFor="primitives-switch-off">Off</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="primitives-switch-on" defaultChecked />
                <Label htmlFor="primitives-switch-on">On</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="primitives-switch-disabled" disabled />
                <Label htmlFor="primitives-switch-disabled">Disabled</Label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Slider</h3>
            <div className="flex max-w-sm flex-col gap-6">
              <Slider defaultValue={[50]} max={100} step={1} aria-label="Single value" />
              <Slider defaultValue={[20, 80]} max={100} step={1} aria-label="Price range" />
              <Slider defaultValue={[30]} max={100} step={1} disabled aria-label="Disabled" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Select</h3>
            <Select defaultValue="ram-16">
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select RAM" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Memory</SelectLabel>
                  <SelectItem value="ram-8">8 GB</SelectItem>
                  <SelectItem value="ram-16">16 GB</SelectItem>
                  <SelectItem value="ram-32">32 GB</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Storage</SelectLabel>
                  <SelectItem value="ssd-512">512 GB SSD</SelectItem>
                  <SelectItem value="ssd-1tb" disabled>
                    1 TB SSD (out of stock)
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Combobox</h3>
            <Combobox
              className="max-w-xs"
              options={COMBOBOX_OPTIONS}
              value={comboboxValue}
              onChange={setComboboxValue}
              placeholder="Select a brand..."
              aria-label="Brand"
            />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Calendar</h3>
            <Calendar mode="single" className="w-fit" />
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-8">
          <h2 className="text-headline-md text-on-surface">Feedback &amp; Status</h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Badge</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="primary">
                <Info className="size-3" />
                Primary
              </Badge>
              <Badge variant="success">
                <CheckCircle2 className="size-3" />
                In stock
              </Badge>
              <Badge variant="warning">
                <AlertTriangle className="size-3" />
                Low stock
              </Badge>
              <Badge variant="danger">
                <XCircle className="size-3" />
                Out of stock
              </Badge>
              <Badge variant="glass">Glass</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Alert</h3>
            <div className="flex flex-col gap-3">
              <Alert>
                <Info />
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>Default informational alert.</AlertDescription>
              </Alert>
              <Alert variant="success">
                <CheckCircle2 />
                <AlertTitle>Order confirmed</AlertTitle>
                <AlertDescription>Your order has been placed successfully.</AlertDescription>
              </Alert>
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Limited stock</AlertTitle>
                <AlertDescription>Only 2 units left at this price.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <XCircle />
                <AlertTitle>Payment failed</AlertTitle>
                <AlertDescription>
                  We couldn&apos;t process your payment. Try again or contact support.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Progress</h3>
            <div className="flex max-w-sm flex-col gap-4">
              <Progress value={10} aria-label="10 percent complete" />
              <Progress value={50} aria-label="50 percent complete" />
              <Progress value={90} aria-label="90 percent complete" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Skeleton</h3>
            <div className="flex flex-wrap items-end gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-24 w-40 rounded-xl" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Toast (Sonner)</h3>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => toast("Order #1042 saved as draft.")}>
                Default toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success("Payment confirmed.")}
              >
                Success toast
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => toast.error("Payment failed. Try again.")}
              >
                Error toast
              </Button>
            </div>
            <Toaster />
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-8">
          <h2 className="text-headline-md text-on-surface">Overlays</h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Dialog</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this build?</DialogTitle>
                  <DialogDescription>This action cannot be undone.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive">Delete</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Sheet</h3>
            <div className="flex flex-wrap gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open left sheet</Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Refine the catalogue by price and brand.</SheetDescription>
                  </SheetHeader>
                  <SheetFooter>
                    <SheetClose asChild>
                      <Button>Apply</Button>
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open right sheet</Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Cart</SheetTitle>
                    <SheetDescription>Review items before checkout.</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Popover</h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Open popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-body-sm text-on-surface-variant">
                  EMI available from NPR 2,499/month on this build.
                </p>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">DropdownMenu</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <User />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings />
                  Settings
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                >
                  Email notifications
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={dropdownTheme} onValueChange={setDropdownTheme}>
                  <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Tooltip</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="icon" iconOnly aria-label="Delivery info">
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Free delivery inside Kathmandu valley.</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Command</h3>
            <Command className="max-w-sm border border-glass-stroke">
              <CommandInput placeholder="Search products, orders..." />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Suggestions">
                  <CommandItem>
                    <Search />
                    Search catalogue
                  </CommandItem>
                  <CommandItem>
                    <User />
                    View account
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Admin">
                  <CommandItem>
                    Orders
                    <CommandShortcut>⌘O</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
            <Button variant="outline" className="w-fit" onClick={() => setPaletteOpen(true)}>
              Open command palette (⌘K demo)
            </Button>
            <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
              <CommandInput placeholder="Type a command..." />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigate">
                  <CommandItem onSelect={() => setPaletteOpen(false)}>
                    <Search />
                    Go to catalogue
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </CommandDialog>
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-8">
          <h2 className="text-headline-md text-on-surface">Content &amp; Data</h2>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Card</h3>
            <div className="flex flex-wrap gap-4">
              <Card className="w-72">
                <CardHeader>
                  <CardTitle>Surface card</CardTitle>
                  <CardDescription>Default borderTone, solid tonal surface.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-body-sm text-on-surface-variant">Body content area.</p>
                </CardContent>
                <CardFooter>
                  <Button size="sm">Action</Button>
                </CardFooter>
              </Card>
              <Card variant="glass" borderTone="primary" className="w-72">
                <CardHeader>
                  <CardTitle>Glass card</CardTitle>
                  <CardDescription>
                    variant=&quot;glass&quot; borderTone=&quot;primary&quot;.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-body-sm text-on-surface-variant">
                    Translucent panel with the primary hover/active border.
                  </p>
                </CardContent>
              </Card>
              <Card borderTone="none" className="w-72">
                <CardHeader>
                  <CardTitle>No border</CardTitle>
                  <CardDescription>borderTone=&quot;none&quot;.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Table</h3>
            <Table>
              <TableCaption>Recent orders</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>#1042</TableCell>
                  <TableCell>Sita Rai</TableCell>
                  <TableCell>
                    <Badge variant="success">Delivered</Badge>
                  </TableCell>
                  <TableCell className="text-right">NPR 145,000</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>#1043</TableCell>
                  <TableCell>Bikash Thapa</TableCell>
                  <TableCell>
                    <Badge variant="warning">Processing</Badge>
                  </TableCell>
                  <TableCell className="text-right">NPR 62,500</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">NPR 207,500</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Tabs</h3>
            <Tabs defaultValue="specs" className="max-w-md">
              <TabsList>
                <TabsTrigger value="specs">Specs</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                <TabsTrigger value="warranty" disabled>
                  Warranty
                </TabsTrigger>
              </TabsList>
              <TabsContent value="specs">
                <p className="text-body-sm text-on-surface-variant">
                  CPU, GPU, RAM and storage details.
                </p>
              </TabsContent>
              <TabsContent value="reviews">
                <p className="text-body-sm text-on-surface-variant">Verified customer reviews.</p>
              </TabsContent>
              <TabsContent value="warranty">
                <p className="text-body-sm text-on-surface-variant">Warranty terms.</p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Accordion</h3>
            <Accordion type="single" collapsible className="max-w-md">
              <AccordionItem value="warranty">
                <AccordionTrigger>What&apos;s covered under warranty?</AccordionTrigger>
                <AccordionContent>
                  Parts and labour for one year from date of purchase.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="emi">
                <AccordionTrigger>Do you offer EMI?</AccordionTrigger>
                <AccordionContent>
                  Yes, EMI is available through our partner banks.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Pagination</h3>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink>1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink isActive>2</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink>3</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Breadcrumb</h3>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Laptops</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>ASUS ROG Strix G16</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Avatar</h3>
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage src="/avatars/demo-user.jpg" alt="Sita Rai" />
                <AvatarFallback>SR</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>BT</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">Separator</h3>
            <div className="flex flex-col gap-4">
              <Separator />
              <div className="flex h-8 items-center gap-4">
                <span className="text-body-sm text-on-surface-variant">Left</span>
                <Separator orientation="vertical" />
                <span className="text-body-sm text-on-surface-variant">Right</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-title text-on-surface">EmptyState</h3>
            <EmptyState
              icon={<PackageOpen />}
              title="No products match these filters"
              description="Try removing a filter or searching a different brand."
              action={<Button variant="outline">Clear filters</Button>}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
