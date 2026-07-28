"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GuidedForm } from "@/components/admin/guided-form";
import { PublishChecklist, type PublishChecklistItem } from "@/components/admin/publish-checklist";
import { Badge } from "@/components/ui/badge";
import type { ComboboxOption } from "@/components/ui/combobox";
import { paisaToRupees, rupeesToPaisa } from "@/lib/money";
import type { ProductStatus } from "@/generated/prisma/client";
import type { AdminSpecFieldOption, ProductWizardData } from "@/server/services/admin/product";
import type { BasicInfoFormState, ProductSpecRow, WizardFormState } from "./_lib/wizard-types";
import { emptyWizardState } from "./_lib/wizard-types";
import { BasicInfoStep } from "./_components/basic-info-step";
import { PhotosStep } from "./_components/photos-step";
import { DetailsStep } from "./_components/details-step";
import { SearchStep, defaultPageTitle, defaultSearchDescription } from "./_components/search-step";
import {
  getPublishReadinessAction,
  getSpecTemplateFieldsAction,
  publishProductAction,
  saveBasicInfoAction,
  savePhotosAction,
  saveSeoAction,
  saveSpecsAction,
} from "./_actions";

/**
 * The four-step product wizard's orchestrator (docs/09-ADMIN-DAD-MODE.md
 * §5.1). Owns one flat `WizardFormState` covering all four steps, the
 * current step index, and every save call — the four step components
 * (`_components/*-step.tsx`) are deliberately "dumb": controlled inputs
 * in, a changed value out, exactly like `ImageDropzone`/`SeoPreview`
 * already were before this file existed.
 *
 * SAVE MODEL: each step's data is written to the database when the owner
 * clicks "Next", "Back", the step indicator, "Save as draft", or when the
 * 20-second autosave timer fires — there is no separate "this step is
 * only local until the very end" state to reason about, which is also
 * what makes "no step that can't be skipped and returned to" (docs/09
 * §5.1) true without extra plumbing. Step 1 must save successfully once
 * (creating the draft `Product`) before Steps 2-4 have anything to save
 * against; every other step's save is a no-op-safe no-op if attempted
 * with no product yet (shouldn't happen in the ordinary flow, since Step
 * 1 is always first, but `onStepClick` and "Back" call it defensively).
 *
 * NOT BUILT, flagged rather than faked: "Restore your unsaved changes?"
 * on return (docs/09 §8) would need persisting not-yet-saved edits
 * client-side (e.g. `localStorage`) and a restore prompt keyed by
 * product/route — real, separate work. What IS built from that same
 * §8 row: the 20-second autosave itself, and a `beforeunload` warning
 * while there's a change the autosave timer hasn't caught yet.
 */
export interface ProductWizardProps {
  existingProductId?: string;
  initialData?: ProductWizardData;
  initialSpecs?: ProductSpecRow[];
  initialTemplateFields?: AdminSpecFieldOption[];
  brandOptions: ComboboxOption[];
  categoryOptions: ComboboxOption[];
}

const STEPS = ["Basics", "Photos", "Details", "Search"];
const AUTOSAVE_INTERVAL_MS = 20_000;

function fromWizardData(data: ProductWizardData): Omit<WizardFormState, "specs"> {
  return {
    basicInfo: {
      name: data.basicInfo.name,
      shortTitle: data.basicInfo.shortTitle,
      description: data.basicInfo.description,
      brandId: data.basicInfo.brandId,
      primaryCategoryId: data.basicInfo.primaryCategoryId,
      additionalCategoryIds: data.basicInfo.additionalCategoryIds,
      priceRupees: paisaToRupees(data.basicInfo.pricePaisa),
      compareAtPriceRupees:
        data.basicInfo.compareAtPricePaisa !== null
          ? paisaToRupees(data.basicInfo.compareAtPricePaisa)
          : "",
      stockQuantity: data.basicInfo.stockQuantity,
      productCode: data.basicInfo.productCode,
      conditionType: data.basicInfo.conditionType,
      warrantyMonths: data.basicInfo.warrantyMonths ?? "",
      warrantyText: data.basicInfo.warrantyText ?? "",
    },
    photos: data.photos.map((photo, index) => ({
      id: photo.mediaId,
      url: photo.url,
      description: photo.description,
      isMain: index === 0,
    })),
    seo: {
      metaTitle: data.seo.metaTitle,
      metaDescription: data.seo.metaDescription,
      canonicalOverride: data.seo.canonicalOverride,
    },
  };
}

function basicInfoPayload(form: BasicInfoFormState) {
  return {
    name: form.name,
    shortTitle: form.shortTitle || undefined,
    description: form.description || undefined,
    brandId: form.brandId,
    primaryCategoryId: form.primaryCategoryId,
    additionalCategoryIds: form.additionalCategoryIds,
    pricePaisa: form.priceRupees === "" ? 0 : rupeesToPaisa(form.priceRupees),
    compareAtPricePaisa:
      form.compareAtPriceRupees === "" ? undefined : rupeesToPaisa(form.compareAtPriceRupees),
    stockQuantity: form.stockQuantity === "" ? 0 : form.stockQuantity,
    productCode: form.productCode || undefined,
    conditionType: form.conditionType,
    warrantyMonths: form.warrantyMonths === "" ? undefined : form.warrantyMonths,
    warrantyText: form.warrantyText || undefined,
  };
}

export function ProductWizard({
  existingProductId,
  initialData,
  initialSpecs,
  initialTemplateFields,
  brandOptions,
  categoryOptions,
}: ProductWizardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [productId, setProductId] = useState(existingProductId);
  const [slug, setSlug] = useState(initialData?.slug);
  const [status, setStatus] = useState<ProductStatus | undefined>(initialData?.status);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [form, setForm] = useState<WizardFormState>(() =>
    initialData
      ? { ...fromWizardData(initialData), specs: initialSpecs ?? [] }
      : emptyWizardState(),
  );
  const [templateFields, setTemplateFields] = useState<AdminSpecFieldOption[]>(
    initialTemplateFields ?? [],
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<PublishChecklistItem[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  function updateForm(patch: Partial<WizardFormState>) {
    setDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  }

  // Loads Step 3's template fields whenever the chosen category changes
  // (docs/09 §5.1: "the category chosen in step 1 loads the right
  // template automatically"). Guards against an older, slower request
  // overwriting a newer one's fields — same pattern as `admin-topbar.tsx`'s
  // search debounce.
  const latestTemplateRequest = useRef(0);
  useEffect(() => {
    const categoryId = form.basicInfo.primaryCategoryId;
    if (!categoryId) {
      setTemplateFields([]);
      return;
    }
    const requestId = ++latestTemplateRequest.current;
    getSpecTemplateFieldsAction(categoryId).then((result) => {
      if (requestId !== latestTemplateRequest.current) return;
      setTemplateFields(result.ok ? (result.data ?? []) : []);
    });
  }, [form.basicInfo.primaryCategoryId]);

  const saveBasics = useCallback(async (): Promise<boolean> => {
    if (
      !form.basicInfo.name.trim() ||
      !form.basicInfo.brandId ||
      !form.basicInfo.primaryCategoryId
    ) {
      setStepError("Fill in the product name, brand, and category before continuing.");
      return false;
    }
    if (form.basicInfo.priceRupees === "" || form.basicInfo.stockQuantity === "") {
      setStepError("Fill in the price and stock before continuing.");
      return false;
    }
    const result = await saveBasicInfoAction(basicInfoPayload(form.basicInfo), productId);
    if (!result.ok || !result.data) {
      setStepError(result.message ?? "Couldn't save. Please check the fields above.");
      return false;
    }
    setProductId(result.data.id);
    setSlug(result.data.slug);
    setStatus(result.data.status);
    setStepError(null);
    return true;
  }, [form.basicInfo, productId]);

  const savePhotosStep = useCallback(async (): Promise<boolean> => {
    if (!productId) return false;
    const result = await savePhotosAction(productId, {
      photos: form.photos.map((photo) => ({
        mediaId: photo.id,
        description: photo.description || undefined,
      })),
    });
    if (!result.ok) {
      setStepError(result.message ?? "Couldn't save the photos.");
      return false;
    }
    setStepError(null);
    return true;
  }, [form.photos, productId]);

  const saveDetailsStep = useCallback(async (): Promise<boolean> => {
    if (!productId) return false;
    const result = await saveSpecsAction(productId, { specs: form.specs });
    if (!result.ok) {
      setStepError(result.message ?? "Couldn't save the details.");
      return false;
    }
    setStepError(null);
    return true;
  }, [form.specs, productId]);

  const brandName =
    brandOptions.find((option) => option.value === form.basicInfo.brandId)?.label ?? "";
  const shortDescription =
    form.basicInfo.description || form.basicInfo.shortTitle || form.basicInfo.name;

  const saveSeoStep = useCallback(async (): Promise<boolean> => {
    if (!productId) return false;
    const metaTitle = form.seo.metaTitle || defaultPageTitle(form.basicInfo.name, brandName);
    const metaDescription = form.seo.metaDescription || defaultSearchDescription(shortDescription);
    const result = await saveSeoAction(productId, {
      metaTitle,
      metaDescription,
      canonicalOverride: form.seo.canonicalOverride || undefined,
    });
    if (!result.ok) {
      setStepError(result.message ?? "Couldn't save the search information.");
      return false;
    }
    setStepError(null);
    return true;
  }, [form.seo, form.basicInfo.name, brandName, shortDescription, productId]);

  const saveStep = useCallback(
    async (index: number): Promise<boolean> => {
      if (index === 0) return saveBasics();
      if (index === 1) return savePhotosStep();
      if (index === 2) return saveDetailsStep();
      return saveSeoStep();
    },
    [saveBasics, savePhotosStep, saveDetailsStep, saveSeoStep],
  );

  // docs/09 §8: "Losing unsaved work: Autosave drafts every 20 s." Silent —
  // failures here don't surface an error toast (the owner hasn't asked to
  // save yet), they just leave `dirty` set so the next explicit save or
  // the next tick tries again.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!dirty) return;
      startTransition(async () => {
        const saved = await saveStep(currentIndex);
        if (saved) setDirty(false);
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [dirty, currentIndex, saveStep, startTransition]);

  // docs/09 §8: "browser-close warning" — the other half of the same row,
  // for the up-to-20-seconds of edits the autosave timer hasn't caught yet.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function handleNext() {
    startTransition(async () => {
      const saved = await saveStep(currentIndex);
      if (saved) {
        setDirty(false);
        setCurrentIndex((index) => Math.min(STEPS.length - 1, index + 1));
      }
    });
  }

  function handleBack() {
    startTransition(async () => {
      await saveStep(currentIndex);
      setDirty(false);
      setCurrentIndex((index) => Math.max(0, index - 1));
    });
  }

  function handleStepClick(index: number) {
    startTransition(async () => {
      await saveStep(currentIndex);
      setDirty(false);
      setCurrentIndex(index);
    });
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const saved = await saveStep(currentIndex);
      if (!saved) return;
      setDirty(false);
      toast("Saved as a draft.");
      router.push("/admin/products");
    });
  }

  async function doPublish() {
    if (!productId) return;
    setIsPublishing(true);
    const result = await publishProductAction(productId);
    setIsPublishing(false);
    if (!result.ok) {
      toast(result.message ?? "Couldn't publish. Please try again.");
      return;
    }
    setChecklistOpen(false);
    setStatus("ACTIVE" as ProductStatus);
    toast(`Saved. Your product is now live at citycomputer.com.np/p/${slug}.`);
    router.push("/admin/products");
  }

  function handlePublishClick() {
    startTransition(async () => {
      const saved = await saveSeoStep();
      if (!saved || !productId) return;
      setDirty(false);
      const readiness = await getPublishReadinessAction(productId);
      if (!readiness.ok || !readiness.data) {
        toast(readiness.message ?? "Couldn't check if this is ready to publish.");
        return;
      }
      if (readiness.data.allOk) {
        await doPublish();
      } else {
        setChecklistItems(readiness.data.items);
        setChecklistOpen(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <p className="text-body-sm text-on-surface-variant">
          This is where you add and change the products on your website. Customers see everything
          marked &ldquo;Live&rdquo;.
        </p>
        {status && (
          <Badge variant={status === "ACTIVE" ? "success" : "glass"} className="shrink-0">
            {status === "ACTIVE" ? "Live" : "Not published yet"}
          </Badge>
        )}
      </div>

      <GuidedForm
        steps={STEPS}
        currentIndex={currentIndex}
        onStepClick={handleStepClick}
        onBack={handleBack}
        onNext={handleNext}
        onSaveDraft={handleSaveDraft}
        finalStepAction={{ label: "Publish", onClick: handlePublishClick }}
      >
        {stepError && (
          <p role="alert" className="mb-4 text-body-sm text-error">
            {stepError}
          </p>
        )}

        {currentIndex === 0 && (
          <BasicInfoStep
            value={form.basicInfo}
            onChange={(basicInfo) => updateForm({ basicInfo })}
            brandOptions={brandOptions}
            categoryOptions={categoryOptions}
            existingProductId={productId}
          />
        )}
        {currentIndex === 1 && (
          <PhotosStep
            photos={form.photos}
            onPhotosChange={(photos) => updateForm({ photos })}
            altTextHint={form.basicInfo.name || undefined}
          />
        )}
        {currentIndex === 2 && (
          <DetailsStep
            templateFields={templateFields}
            specs={form.specs}
            onSpecsChange={(specs) => updateForm({ specs })}
          />
        )}
        {currentIndex === 3 && (
          <SearchStep
            value={form.seo}
            onChange={(seo) => updateForm({ seo })}
            productName={form.basicInfo.name}
            brandName={brandName}
            shortDescription={shortDescription}
            slug={slug}
          />
        )}
      </GuidedForm>

      <PublishChecklist
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        items={checklistItems}
        onPublishAnyway={() => void doPublish()}
        isPublishing={isPublishing}
      />
    </div>
  );
}
