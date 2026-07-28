"use client";

import * as React from "react";
import { AlertTriangle, Package, ShoppingCart, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandList } from "@/components/ui/command";
import { MetricTile } from "@/components/admin/metric-tile";
import { StockLevelBar } from "@/components/admin/stock-level-bar";
import { ActivityFeedItem } from "@/components/admin/activity-feed-item";
import { BarChart } from "@/components/admin/bar-chart";
import { Sparkline } from "@/components/admin/sparkline";
import { HelpBubble } from "@/components/admin/help-bubble";
import { StepIndicator } from "@/components/admin/step-indicator";
import { GuidedForm } from "@/components/admin/guided-form";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { showUndoToast } from "@/components/admin/undo-toast";
import { ImageDropzone, type DropzoneImage } from "@/components/admin/image-dropzone";
import { SeoPreview } from "@/components/admin/seo-preview";
import { StockAdjuster, type StockAdjustReason } from "@/components/admin/stock-adjuster";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { GlobalSearch, type GlobalSearchGroup } from "@/components/admin/global-search";
import {
  SpecTemplateEditor,
  type SpecTemplateField,
} from "@/components/admin/spec-template-editor";
import { RuleBuilder, type CompatibilityRuleSummary } from "@/components/admin/rule-builder";

/**
 * AdminSection — docs/05-DESIGN-SYSTEM.md §10 `/design` showcase: renders
 * every component in `src/components/admin/` except `AdminShell`/
 * `AdminSidebar`/`AdminTopBar`, which are showcased by `layout-section.tsx`
 * instead. Grouped into the five subsections described in the task brief,
 * each with real local state so sorting, selection, wizard navigation, and
 * the two editable "administration" tables actually respond to clicks
 * rather than rendering frozen.
 */

const REVENUE_BY_DAY = [
  { label: "Mon", value: 128_400 },
  { label: "Tue", value: 95_200 },
  { label: "Wed", value: 142_800 },
  { label: "Thu", value: 168_500 },
  { label: "Fri", value: 210_300 },
  { label: "Sat", value: 265_900 },
  { label: "Sun", value: 184_700 },
];

const REVENUE_SPARKLINE = REVENUE_BY_DAY.map((day) => day.value);

function formatPaisaAsRupees(value: number): string {
  return `रु ${Math.round(value / 100).toLocaleString("en-IN")}`;
}

interface DemoProductRow {
  id: string;
  name: string;
  price: number;
  stock: number;
}

const DEMO_PRODUCT_ROWS: DemoProductRow[] = [
  { id: "p1", name: "HP Victus 15", price: 8_999_00, stock: 6 },
  { id: "p2", name: "Logitech G102", price: 189_900, stock: 2 },
  { id: "p3", name: 'Samsung 27" Monitor', price: 2_499_900, stock: 0 },
  { id: "p4", name: "Kingston 16GB RAM", price: 349_900, stock: 14 },
];

const DEMO_SEARCH_GROUPS: GlobalSearchGroup[] = [
  {
    label: "Products",
    count: 2,
    results: [
      { id: "sp1", title: "HP Victus 15", subtitle: "Laptop · in stock", href: "#" },
      { id: "sp2", title: "HP LaserJet Printer", subtitle: "Printer · low stock", href: "#" },
    ],
  },
  {
    label: "Orders",
    count: 1,
    results: [{ id: "so1", title: "CC-2607-0042", subtitle: "Rita Shrestha", href: "#" }],
  },
];

const GUIDED_FORM_STEPS = ["Basics", "Photos", "Details", "Search"];

const INITIAL_DROPZONE_IMAGES: DropzoneImage[] = [
  {
    id: "img-1",
    url: "https://placehold.co/200x200/1a1a1c/bbc9cf?text=Main",
    description: "Front view of the HP Victus 15 laptop, lid open.",
    isMain: true,
  },
  {
    id: "img-2",
    url: "https://placehold.co/200x200/1a1a1c/bbc9cf?text=Side",
    description: "",
    isMain: false,
  },
];

const INITIAL_SPEC_FIELDS: SpecTemplateField[] = [
  { id: "f1", label: "Processor", type: "text", required: true },
  { id: "f2", label: "RAM", type: "select", options: ["8GB", "16GB", "32GB"], required: true },
  { id: "f3", label: "Touchscreen", type: "boolean", required: false },
];

const INITIAL_RULES: CompatibilityRuleSummary[] = [
  {
    id: "r1",
    plainLanguageDescription: "Processor and motherboard must use the same socket.",
    severity: "error",
    message: "This processor and motherboard use different sockets and cannot be paired.",
    active: true,
    expressionJson:
      '{"op":"NEQ","left":{"ref":"subject.specs.socket"},"right":{"ref":"object.specs.socket"}}',
  },
  {
    id: "r2",
    plainLanguageDescription: "PSU wattage should exceed total estimated draw by 20%.",
    severity: "warning",
    message: "Your power supply may be underpowered for this build.",
    active: false,
    expressionJson:
      '{"op":"LT","left":{"ref":"subject.specs.wattage"},"right":{"fn":"totalDraw","args":[1.2]}}',
  },
];

function DashboardAtomsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">MetricTile</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Orders today"
            value="12"
            helperLine="3 still need attention"
            icon={ShoppingCart}
            href="#"
          />
          <MetricTile
            label="Money today"
            value={formatPaisaAsRupees(48_520_000)}
            trend={{ direction: "up", label: "Yesterday: रु 3,10,000" }}
            icon={Wallet}
          />
          <MetricTile
            label="Needs your attention"
            value="5"
            helperLine="2 payments to check · 3 orders to send"
            icon={AlertTriangle}
            href="#"
          />
          <MetricTile
            label="Almost out of stock"
            value="7"
            helperLine="See the list"
            icon={Package}
            trend={{ direction: "down", label: "Down from 9 last week" }}
            href="#"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">StockLevelBar</h3>
        <div className="flex max-w-sm flex-col gap-3">
          <StockLevelBar quantity={14} />
          <StockLevelBar quantity={2} />
          <StockLevelBar quantity={0} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">ActivityFeedItem</h3>
        <div className="flex flex-col divide-y divide-glass-stroke rounded-xl border border-glass-stroke bg-surface-container px-4">
          <ActivityFeedItem
            actorName="Sita"
            action="marked order as packed"
            targetLabel="CC-2607-0042"
            timestamp={new Date(Date.now() - 2 * 60_000).toISOString()}
            href="#"
          />
          <ActivityFeedItem
            actorName="Rita"
            action="adjusted stock for"
            targetLabel="HP Victus 15"
            timestamp={new Date(Date.now() - 3 * 60 * 60_000).toISOString()}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">BarChart</h3>
        <BarChart
          data={REVENUE_BY_DAY}
          valueFormatter={formatPaisaAsRupees}
          className="max-w-2xl"
        />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">Sparkline</h3>
        <Sparkline data={REVENUE_SPARKLINE} />
      </div>
    </div>
  );
}

function GuidedFormDemo() {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  return (
    <GuidedForm
      steps={GUIDED_FORM_STEPS}
      currentIndex={currentIndex}
      onStepClick={setCurrentIndex}
      onBack={() => setCurrentIndex((index) => Math.max(0, index - 1))}
      onNext={() => setCurrentIndex((index) => Math.min(GUIDED_FORM_STEPS.length - 1, index + 1))}
      onSaveDraft={() => showUndoToast({ message: "Draft saved.", onUndo: () => undefined })}
      finalStepAction={{
        label: "Publish",
        onClick: () => showUndoToast({ message: "Product published.", onUndo: () => undefined }),
      }}
    >
      <p className="text-body-md text-on-surface">
        {/* `currentIndex` is clamped to `[0, GUIDED_FORM_STEPS.length - 1]` by
           the onBack/onNext handlers above — always in bounds. */}
        {/* eslint-disable-next-line security/detect-object-injection */}
        Placeholder content for step &ldquo;{GUIDED_FORM_STEPS[currentIndex]}&rdquo;.
      </p>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        A real wizard would render this step&rsquo;s own fields here — <code>GuidedForm</code> only
        owns the indicator and footer chrome.
      </p>
    </GuidedForm>
  );
}

function ConfirmDialogDemo() {
  const [hideOpen, setHideOpen] = React.useState(false);
  const [destructiveOpen, setDestructiveOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button type="button" variant="outline" onClick={() => setHideOpen(true)}>
        Hide product…
      </Button>
      <ConfirmDialog
        open={hideOpen}
        onOpenChange={setHideOpen}
        variant="hide"
        title="Hide this product?"
        itemName="HP Victus 15"
        onConfirm={() => undefined}
      />

      <Button type="button" variant="destructive" onClick={() => setDestructiveOpen(true)}>
        Delete discount code…
      </Button>
      <ConfirmDialog
        open={destructiveOpen}
        onOpenChange={setDestructiveOpen}
        variant="destructive"
        title="Delete this discount code?"
        itemName="DASHAIN2026"
        consequence="Customers with this code in their cart will no longer get the discount."
        onConfirm={() => undefined}
      />
    </div>
  );
}

function HelpAndSafetySection() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">HelpBubble</h3>
        <div className="flex items-center gap-2 text-body-md text-on-surface">
          Chipset
          <HelpBubble
            label="The chip that connects your processor to everything else."
            example="e.g. Intel B760, AMD B650"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">StepIndicator</h3>
        <StepIndicator steps={GUIDED_FORM_STEPS} currentIndex={1} />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">GuidedForm</h3>
        <GuidedFormDemo />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">ConfirmDialog</h3>
        <ConfirmDialogDemo />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">UndoToast (showUndoToast)</h3>
        <p className="mb-3 text-body-sm text-on-surface-variant">
          <code>showUndoToast</code> is a plain function, not a component — it triggers a{" "}
          <code>sonner</code> toast directly, so it is demoed here via a button click rather than
          rendered as JSX.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            showUndoToast({
              message: "Marked as packed.",
              onUndo: () => undefined,
            })
          }
        >
          Mark order as packed
        </Button>
      </div>
    </div>
  );
}

function ProductWizardSection() {
  const [images, setImages] = React.useState<DropzoneImage[]>(INITIAL_DROPZONE_IMAGES);
  const [pageTitle, setPageTitle] = React.useState(
    "HP Victus 15 Price in Nepal | HP | City Computer",
  );
  const [searchDescription, setSearchDescription] = React.useState(
    "Buy the HP Victus 15 in Nepal with warranty and fast delivery from City Computer.",
  );
  const [canonicalOverride, setCanonicalOverride] = React.useState("");
  const [stockQuantity, setStockQuantity] = React.useState(6);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">ImageDropzone</h3>
        <ImageDropzone
          images={images}
          onFilesAdded={() => undefined}
          onReorder={setImages}
          onRemove={(id) => setImages((current) => current.filter((image) => image.id !== id))}
          onDescriptionChange={(id, description) =>
            setImages((current) =>
              current.map((image) => (image.id === id ? { ...image, description } : image)),
            )
          }
        />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">SeoPreview</h3>
        <SeoPreview
          pageUrl="citycomputer.com.np/p/hp-victus-15"
          pageTitle={pageTitle}
          onPageTitleChange={setPageTitle}
          searchDescription={searchDescription}
          onSearchDescriptionChange={setSearchDescription}
          productNameForHint="HP Victus 15"
          slug="hp-victus-15"
          canonicalOverride={canonicalOverride}
          onCanonicalOverrideChange={setCanonicalOverride}
        />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">StockAdjuster</h3>
        <StockAdjuster
          quantity={stockQuantity}
          onAdjust={(newQuantity: number, reason: StockAdjustReason, note?: string) => {
            setStockQuantity(newQuantity);
            showUndoToast({
              message: `Stock set to ${newQuantity} (${reason}${note ? ` — ${note}` : ""}).`,
              onUndo: () => setStockQuantity(stockQuantity),
            });
          }}
        />
      </div>
    </div>
  );
}

function DataTableDemo() {
  const [sortKey, setSortKey] = React.useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const columns: DataTableColumn<DemoProductRow>[] = [
    {
      key: "name",
      header: "Product",
      render: (row) => row.name,
      sortable: true,
    },
    {
      key: "price",
      header: "Price",
      render: (row) => formatPaisaAsRupees(row.price),
      sortable: true,
      align: "right",
    },
    {
      key: "stock",
      header: "Stock",
      render: (row) => <StockLevelBar quantity={row.stock} />,
    },
  ];

  const sortedRows = React.useMemo(() => {
    if (!sortKey) return DEMO_PRODUCT_ROWS;
    const sorted = [...DEMO_PRODUCT_ROWS].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "price") return a.price - b.price;
      return 0;
    });
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [sortKey, sortDirection]);

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        rows={sortedRows}
        getRowId={(row) => row.id}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key, direction) => {
          setSortKey(key);
          setSortDirection(direction);
        }}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}

const SIMPLE_PRODUCT_COLUMNS: DataTableColumn<DemoProductRow>[] = [
  { key: "name", header: "Product", render: (row) => row.name },
  {
    key: "price",
    header: "Price",
    render: (row) => formatPaisaAsRupees(row.price),
    align: "right",
  },
];

const NO_PRODUCT_ROWS: DemoProductRow[] = [];

function getDemoProductRowId(row: DemoProductRow): string {
  return row.id;
}

function ListsAndSearchSection() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">DataTable — interactive</h3>
        <DataTableDemo />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">DataTable — loading</h3>
        <DataTable
          columns={SIMPLE_PRODUCT_COLUMNS}
          rows={NO_PRODUCT_ROWS}
          getRowId={getDemoProductRowId}
          loading
        />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">DataTable — empty</h3>
        <DataTable
          columns={SIMPLE_PRODUCT_COLUMNS}
          rows={NO_PRODUCT_ROWS}
          getRowId={getDemoProductRowId}
          emptyMessage="No products match these filters."
        />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">GlobalSearch</h3>
        <Command className="max-w-md border border-glass-stroke">
          <CommandList>
            <GlobalSearch groups={DEMO_SEARCH_GROUPS} onSelect={() => undefined} />
          </CommandList>
        </Command>
      </div>
    </div>
  );
}

function SpecTemplateEditorDemo() {
  const [fields, setFields] = React.useState<SpecTemplateField[]>(INITIAL_SPEC_FIELDS);

  return <SpecTemplateEditor categoryName="Laptop" fields={fields} onFieldsChange={setFields} />;
}

function RuleBuilderDemo() {
  const [rules, setRules] = React.useState<CompatibilityRuleSummary[]>(INITIAL_RULES);

  return (
    <RuleBuilder
      rules={rules}
      onToggleActive={(id, active) =>
        setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, active } : rule)))
      }
      onSeverityChange={(id, severity) =>
        setRules((current) =>
          current.map((rule) => (rule.id === id ? { ...rule, severity } : rule)),
        )
      }
      onMessageChange={(id, message) =>
        setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, message } : rule)))
      }
      onExpressionChange={(id, expressionJson) =>
        setRules((current) =>
          current.map((rule) => (rule.id === id ? { ...rule, expressionJson } : rule)),
        )
      }
      onTestRule={() => showUndoToast({ message: "Rule test queued.", onUndo: () => undefined })}
    />
  );
}

function BuilderAdministrationSection() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">SpecTemplateEditor</h3>
        <SpecTemplateEditorDemo />
      </div>

      <div>
        <h3 className="mb-3 text-body-lg font-medium text-on-surface">RuleBuilder</h3>
        <RuleBuilderDemo />
      </div>
    </div>
  );
}

export function AdminSection() {
  return (
    <div className="flex flex-col gap-12">
      <section>
        <h2 className="mb-4 text-headline-md text-on-surface">Dashboard atoms</h2>
        <DashboardAtomsDemo />
      </section>

      <section>
        <h2 className="mb-4 text-headline-md text-on-surface">In-product help &amp; safety</h2>
        <HelpAndSafetySection />
      </section>

      <section>
        <h2 className="mb-4 text-headline-md text-on-surface">Product wizard</h2>
        <ProductWizardSection />
      </section>

      <section>
        <h2 className="mb-4 text-headline-md text-on-surface">Lists &amp; search</h2>
        <ListsAndSearchSection />
      </section>

      <section>
        <h2 className="mb-4 text-headline-md text-on-surface">Builder administration</h2>
        <BuilderAdministrationSection />
      </section>
    </div>
  );
}
