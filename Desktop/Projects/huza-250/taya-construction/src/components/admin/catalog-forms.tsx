"use client";

// Catalog forms: full-page forms with image upload; categories and trainings in dialogs (Design §6).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { DIVISIONS } from "@/config/divisions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { UploadField } from "@/components/ui/upload";
import { useActionForm } from "@/lib/forms";
import { createCatalogUploadTicket, createEquipment, updateEquipment } from "@/server/modules/catalog/equipment/equipment.actions";
import { createEquipmentSchema, updateEquipmentSchema } from "@/server/modules/catalog/equipment/equipment.schema";
import { createProduct, updateProduct } from "@/server/modules/catalog/product/product.actions";
import { createProductSchema, updateProductSchema } from "@/server/modules/catalog/product/product.schema";
import { createService, updateService } from "@/server/modules/catalog/service/service.actions";
import { createServiceSchema, updateServiceSchema, type ContentSection } from "@/server/modules/catalog/service/service.schema";
import { createTraining, updateTraining } from "@/server/modules/catalog/training/training.actions";
import { createTrainingSchema, updateTrainingSchema } from "@/server/modules/catalog/training/training.schema";
import { createCategory, updateCategory } from "@/server/modules/catalog/category/category.actions";
import { createCategorySchema, updateCategorySchema } from "@/server/modules/catalog/category/category.schema";
import { EntityPicker } from "./actions";

type Opt = { id: string; name: string };
type Kind = "equipment" | "product" | "service" | "training" | "category";
const ticket = (kind: Kind) => (i: { mimeType: string; sizeBytes: number }) => createCatalogUploadTicket({ kind, ...i });

function useSaver<T extends { id: string }>(back: string) {
  const router = useRouter();
  const toast = useToast();
  const form = useActionForm<T>();
  return {
    form,
    done: (created: boolean, id: string) => {
      toast("success", created ? "Created." : "Saved.");
      router.push(created ? `${back}/${id}` : back);
      router.refresh();
    },
  };
}

const err = (f: { formError: ReturnType<typeof useActionForm>["formError"] }) => (f.formError && !f.formError.fieldErrors ? f.formError.message : f.formError?.fieldErrors?._form?.[0] ?? null);

// ---------------- Equipment ----------------

export function EquipmentForm({
  item,
  categories,
  uploadsEnabled,
}: {
  item?: { id: string; categoryId: string; ownerId: string | null; owner: { name: string; companyName: string | null } | null; name: string; slug: string; description: string; images: string[]; specs: { label: string; value: string }[]; location: string; forRent: boolean; rentPrice: number | null; rentUnit: string | null; forSale: boolean; salePrice: number | null; isFeatured: boolean };
  categories: Opt[];
  uploadsEnabled: boolean;
}) {
  const [v, setV] = useState({
    categoryId: item?.categoryId ?? "",
    name: item?.name ?? "",
    slug: item?.slug ?? "",
    description: item?.description ?? "",
    location: item?.location ?? "",
    forRent: item?.forRent ?? true,
    rentPrice: item?.rentPrice?.toString() ?? "",
    rentUnit: item?.rentUnit ?? "DAY",
    forSale: item?.forSale ?? false,
    salePrice: item?.salePrice?.toString() ?? "",
    isFeatured: item?.isFeatured ?? false,
  });
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(item?.ownerId ? { id: item.ownerId, name: item.owner?.companyName ?? item.owner?.name ?? "Vendor" } : null);
  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const [specs, setSpecs] = useState(item?.specs ?? []);
  const { form, done } = useSaver<{ id: string }>("/admin/catalog/equipment");
  const e = form.errors;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));

  async function save() {
    const input = { ...v, ownerId: owner?.id ?? null, images, specs: specs.filter((s) => s.label || s.value), rentPrice: v.forRent ? v.rentPrice : "", rentUnit: v.forRent && v.rentPrice ? v.rentUnit : null, salePrice: v.forSale ? v.salePrice : "" };
    const r = item ? await form.run({ schema: updateEquipmentSchema, input: { id: item.id, ...input }, action: updateEquipment }) : await form.run({ schema: createEquipmentSchema, input, action: createEquipment });
    if (r) done(!item, r.id);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" error={e.categoryId}>
          <Select value={v.categoryId} onChange={(x) => set({ categoryId: x.target.value })}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner" hint="Empty = Marino-owned">
          {owner ? (
            <div className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5 text-sm">
              {owner.name}
              <button type="button" className="text-muted underline" onClick={() => setOwner(null)}>
                Remove
              </button>
            </div>
          ) : (
            <EntityPicker<{ id: string; name: string; companyName: string | null }> endpoint="/api/v1/parties/vendor" label="Owner" placeholder="Marino-owned, or pick a vendor…" labelOf={(x) => x.companyName ?? x.name} onPick={(x) => setOwner({ id: x.id, name: x.companyName ?? x.name })} />
          )}
        </Field>
        <Field label="Name" error={e.name}>
          <Input placeholder="e.g. CAT 320 Excavator" value={v.name} onChange={(x) => set({ name: x.target.value })} />
        </Field>
        <Field label="URL slug" optional error={e.slug} hint="Made from the name when empty.">
          <Input placeholder="https://example.rw" value={v.slug} onChange={(x) => set({ slug: x.target.value })} />
        </Field>
      </div>
      <Field label="Description" error={e.description}>
        <Textarea placeholder="e.g. 20-tonne excavator with operator, well maintained, available for sites around Kigali." value={v.description} onChange={(x) => set({ description: x.target.value })} className="min-h-32" />
      </Field>
      <Field label="Location (district)" error={e.location}>
        <Input placeholder="Kicukiro, Kigali" value={v.location} onChange={(x) => set({ location: x.target.value })} />
      </Field>
      <Field label="Photos" hint="The first photo is the cover. You can also keep existing links." error={e.images}>
        <UploadField enabled={uploadsEnabled} value={images} onChange={setImages} getTicket={ticket("equipment")} maxMb={8} library={{ folder: "equipment" }} />
      </Field>
      <SpecsEditor specs={specs} onChange={setSpecs} error={e.specs?.[0]} />
      <div className="grid gap-4 rounded-2xl bg-mist p-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Checkbox label="For rent" checked={v.forRent} onChange={(x) => set({ forRent: x.target.checked })} />
          {v.forRent && (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input aria-label="Rent price" placeholder="Rent price (RWF)" value={v.rentPrice} onChange={(x) => set({ rentPrice: x.target.value })} />
              <Select aria-label="Rent unit" className="w-32" value={v.rentUnit} onChange={(x) => set({ rentUnit: x.target.value })}>
                <option value="DAY">/ day</option>
                <option value="WEEK">/ week</option>
                <option value="MONTH">/ month</option>
                <option value="PROJECT">/ project</option>
              </Select>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <Checkbox label="For sale" checked={v.forSale} onChange={(x) => set({ forSale: x.target.checked })} />
          {v.forSale && <Input aria-label="Sale price" placeholder="Sale price (RWF)" value={v.salePrice} onChange={(x) => set({ salePrice: x.target.value })} />}
        </div>
        {(e.forRent || e.rentUnit || e.rentPrice || e.salePrice) && <p className="text-xs text-danger sm:col-span-2">{(e.forRent ?? e.rentUnit ?? e.rentPrice ?? e.salePrice)![0]}</p>}
      </div>
      <Checkbox label="Featured on the home page" checked={v.isFeatured} onChange={(x) => set({ isFeatured: x.target.checked })} />
      <FormError message={err(form)} />
      <Button size="lg" onClick={save} disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} {item ? "Save changes" : "Create equipment"}
      </Button>
    </div>
  );
}

function SpecsEditor({ specs, onChange, error }: { specs: { label: string; value: string }[]; onChange: (s: { label: string; value: string }[]) => void; error?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Specifications</p>
      {specs.map((s, i) => (
        <div key={i} className="flex gap-2">
          <Input aria-label="Label" placeholder="Label" value={s.label} onChange={(x) => onChange(specs.map((y, j) => (j === i ? { ...y, label: x.target.value } : y)))} />
          <Input aria-label="Value" placeholder="Value" value={s.value} onChange={(x) => onChange(specs.map((y, j) => (j === i ? { ...y, value: x.target.value } : y)))} />
          <Button variant="ghost" aria-label="Remove" onClick={() => onChange(specs.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {specs.length < 20 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...specs, { label: "", value: "" }])}>
          <Plus className="h-4 w-4" /> Add a row
        </Button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ---------------- Product ----------------

export function ProductForm({
  item,
  categories,
  uploadsEnabled,
}: {
  item?: { id: string; categoryId: string; supplierId: string | null; supplier: { name: string; companyName: string | null } | null; name: string; slug: string; description: string; images: string[]; brand: string | null; price: number | null; unit: string; isAvailable: boolean; isFeatured: boolean };
  categories: Opt[];
  uploadsEnabled: boolean;
}) {
  const [v, setV] = useState({
    categoryId: item?.categoryId ?? "",
    name: item?.name ?? "",
    slug: item?.slug ?? "",
    description: item?.description ?? "",
    brand: item?.brand ?? "",
    price: item?.price?.toString() ?? "",
    unit: item?.unit ?? "PIECE",
    isAvailable: item?.isAvailable ?? true,
    isFeatured: item?.isFeatured ?? false,
  });
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(item?.supplierId ? { id: item.supplierId, name: item.supplier?.companyName ?? item.supplier?.name ?? "Vendor" } : null);
  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const { form, done } = useSaver<{ id: string }>("/admin/catalog/products");
  const e = form.errors;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    const input = { ...v, supplierId: supplier?.id ?? null, images };
    const r = item ? await form.run({ schema: updateProductSchema, input: { id: item.id, ...input }, action: updateProduct }) : await form.run({ schema: createProductSchema, input, action: createProduct });
    if (r) done(!item, r.id);
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" error={e.categoryId}>
          <Select value={v.categoryId} onChange={(x) => set({ categoryId: x.target.value })}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Supplier" optional hint="Never shown publicly.">
          {supplier ? (
            <div className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5 text-sm">
              {supplier.name}
              <button type="button" className="text-muted underline" onClick={() => setSupplier(null)}>
                Remove
              </button>
            </div>
          ) : (
            <EntityPicker<{ id: string; name: string; companyName: string | null }> endpoint="/api/v1/parties/vendor" label="Supplier" placeholder="Pick a vendor…" labelOf={(x) => x.companyName ?? x.name} onPick={(x) => setSupplier({ id: x.id, name: x.companyName ?? x.name })} />
          )}
        </Field>
        <Field label="Name" error={e.name}>
          <Input placeholder="e.g. Cement CEM II 42.5R, 50 kg" value={v.name} onChange={(x) => set({ name: x.target.value })} />
        </Field>
        <Field label="URL slug" optional error={e.slug}>
          <Input placeholder="https://example.rw" value={v.slug} onChange={(x) => set({ slug: x.target.value })} />
        </Field>
        <Field label="Brand" optional>
          <Input placeholder="e.g. Cimerwa" value={v.brand} onChange={(x) => set({ brand: x.target.value })} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Price (RWF)" optional error={e.price} hint="Empty = “Request a quote”">
            <Input placeholder="150,000" value={v.price} onChange={(x) => set({ price: x.target.value })} />
          </Field>
          <Field label="Unit">
            <Select value={v.unit} onChange={(x) => set({ unit: x.target.value })} className="w-28">
              {["PIECE", "BAG", "M2", "M3", "TON", "LITRE", "TRIP"].map((u) => (
                <option key={u} value={u}>
                  {u.toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
      <Field label="Description" error={e.description}>
        <Textarea placeholder="e.g. Portland cement for blocks, slabs and plaster. Delivered across Kigali." value={v.description} onChange={(x) => set({ description: x.target.value })} className="min-h-32" />
      </Field>
      <Field label="Photos" error={e.images}>
        <UploadField enabled={uploadsEnabled} value={images} onChange={setImages} getTicket={ticket("product")} maxMb={8} library={{ folder: "products" }} />
      </Field>
      <div className="flex flex-wrap gap-6">
        <Checkbox label="Available (shown publicly)" checked={v.isAvailable} onChange={(x) => set({ isAvailable: x.target.checked })} />
        <Checkbox label="Featured on the home page" checked={v.isFeatured} onChange={(x) => set({ isFeatured: x.target.checked })} />
      </div>
      <FormError message={err(form)} />
      <Button size="lg" onClick={save} disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} {item ? "Save changes" : "Create product"}
      </Button>
    </div>
  );
}

// ---------------- Service ----------------

export function ServiceForm({
  item,
  categories,
  uploadsEnabled,
}: {
  item?: { id: string; categoryId: string; name: string; slug: string; summary: string; description: string; content: ContentSection[]; image: string | null; order: number; isActive: boolean };
  categories: Opt[];
  uploadsEnabled: boolean;
}) {
  const [v, setV] = useState({ categoryId: item?.categoryId ?? "", name: item?.name ?? "", slug: item?.slug ?? "", summary: item?.summary ?? "", description: item?.description ?? "", order: String(item?.order ?? 0), isActive: item?.isActive ?? true });
  const [image, setImage] = useState<string[]>(item?.image ? [item.image] : []);
  const [content, setContent] = useState<ContentSection[]>(item?.content ?? []);
  const { form, done } = useSaver<{ id: string }>("/admin/catalog/services");
  const e = form.errors;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    const input = { ...v, image: image[0] ?? "", content };
    const r = item ? await form.run({ schema: updateServiceSchema, input: { id: item.id, ...input }, action: updateService }) : await form.run({ schema: createServiceSchema, input, action: createService });
    if (r) done(!item, r.id);
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" error={e.categoryId} hint="The division comes from the category.">
          <Select value={v.categoryId} onChange={(x) => set({ categoryId: x.target.value })}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order" hint="Lower comes first.">
          <Input placeholder="0" type="number" value={v.order} onChange={(x) => set({ order: x.target.value })} />
        </Field>
        <Field label="Name" error={e.name}>
          <Input placeholder="e.g. Structural Inspection" value={v.name} onChange={(x) => set({ name: x.target.value })} />
        </Field>
        <Field label="URL slug" optional error={e.slug}>
          <Input placeholder="https://example.rw" value={v.slug} onChange={(x) => set({ slug: x.target.value })} />
        </Field>
      </div>
      <Field label="Summary (one line, for cards)" error={e.summary}>
        <Input placeholder="One sentence shown on the cards" value={v.summary} onChange={(x) => set({ summary: x.target.value })} />
      </Field>
      <Field label="Introduction" error={e.description}>
        <Textarea placeholder="e.g. A full check of slabs, columns and beams with a written report within 5 days." value={v.description} onChange={(x) => set({ description: x.target.value })} />
      </Field>
      <Field label="Image" optional>
        <UploadField enabled={uploadsEnabled} value={image} onChange={setImage} getTicket={ticket("service")} multiple={false} label="Add image" maxMb={8} library={{ folder: "services" }} />
      </Field>
      <ContentEditor value={content} onChange={setContent} error={e.content?.[0]} />
      <Checkbox label="Active (shown publicly)" checked={v.isActive} onChange={(x) => set({ isActive: x.target.checked })} />
      <FormError message={err(form)} />
      <Button size="lg" onClick={save} disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} {item ? "Save changes" : "Create service"}
      </Button>
    </div>
  );
}

// Structured editor for Service.content: never raw JSON (Data Model §1).
function ContentEditor({ value, onChange, error }: { value: ContentSection[]; onChange: (v: ContentSection[]) => void; error?: string }) {
  const update = (i: number, s: ContentSection) => onChange(value.map((x, j) => (j === i ? s : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = (type: ContentSection["type"]) => {
    const blank: ContentSection = type === "text" ? { type, title: "", body: "" } : type === "faq" ? { type, title: "Questions", items: [{ q: "", a: "" }] } : { type, title: "", items: [""] };
    onChange([...value, blank]);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Page sections</p>
      {value.map((s, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-line/60 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold uppercase">{s.type}</span>
            <Input aria-label="Section title" placeholder="Section title" value={s.title} onChange={(x) => update(i, { ...s, title: x.target.value })} />
            <Button variant="ghost" aria-label="Up" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" aria-label="Down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" aria-label="Remove section" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {s.type === "text" && <Textarea aria-label="Text" placeholder="Write the paragraph shown on the service page" value={s.body} onChange={(x) => update(i, { ...s, body: x.target.value })} />}
          {(s.type === "list" || s.type === "steps") && (
            <Textarea aria-label="One item per line" placeholder="One item per line" value={s.items.join("\n")} onChange={(x) => update(i, { ...s, items: x.target.value.split("\n") })} onBlur={() => update(i, { ...s, items: s.items.map((t) => t.trim()).filter(Boolean) })} />
          )}
          {s.type === "faq" && (
            <div className="space-y-2">
              {s.items.map((f, k) => (
                <div key={k} className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="Question" placeholder="Question" value={f.q} onChange={(x) => update(i, { ...s, items: s.items.map((y, m) => (m === k ? { ...y, q: x.target.value } : y)) })} />
                  <Input aria-label="Answer" placeholder="Answer" value={f.a} onChange={(x) => update(i, { ...s, items: s.items.map((y, m) => (m === k ? { ...y, a: x.target.value } : y)) })} />
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => update(i, { ...s, items: [...s.items, { q: "", a: "" }] })}>
                <Plus className="h-4 w-4" /> Question
              </Button>
            </div>
          )}
        </div>
      ))}
      {value.length < 10 && (
        <div className="flex flex-wrap gap-2">
          {(["text", "list", "steps", "faq"] as const).map((t) => (
            <Button key={t} size="sm" variant="outline" onClick={() => add(t)}>
              <Plus className="h-4 w-4" /> {t === "faq" ? "FAQ" : t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ---------------- Training (dialog) ----------------

export function TrainingDialogButton({ item, label, uploadsEnabled }: { item?: { id: string; title: string; slug: string; summary: string; image: string | null; type: string; duration: string | null; externalUrl: string; isFeatured: boolean; isPublished: boolean }; label: string; uploadsEnabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: item?.title ?? "", slug: item?.slug ?? "", summary: item?.summary ?? "", type: item?.type ?? "HSE", duration: item?.duration ?? "", externalUrl: item?.externalUrl ?? "https://primesafetyglobal.com/", isFeatured: item?.isFeatured ?? false, isPublished: item?.isPublished ?? true });
  const [image, setImage] = useState<string[]>(item?.image ? [item.image] : []);
  const form = useActionForm<unknown>();
  const e = form.errors;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    const input = { ...v, image: image[0] ?? "" };
    const r = item ? await form.run({ schema: updateTrainingSchema, input: { id: item.id, ...input }, action: updateTraining }) : await form.run({ schema: createTrainingSchema, input, action: createTraining });
    if (!r) return;
    toast("success", "Saved.");
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button variant={item ? "outline" : "primary"} size={item ? "sm" : "md"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={item ? "Edit training" : "New training"} footer={<Button onClick={save} disabled={form.pending}>{form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>}>
        <div className="space-y-4">
          <Field label="Title" error={e.title}>
            <Input placeholder="e.g. Working at Heights (HSE)" value={v.title} onChange={(x) => set({ title: x.target.value })} />
          </Field>
          <Field label="Summary" error={e.summary}>
            <Textarea placeholder="One sentence shown on the cards" value={v.summary} onChange={(x) => set({ summary: x.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={v.type} onChange={(x) => set({ type: x.target.value })}>
                <option value="HSE">HSE</option>
                <option value="CONSTRUCTION">Construction</option>
              </Select>
            </Field>
            <Field label="Duration" optional>
              <Input value={v.duration} onChange={(x) => set({ duration: x.target.value })} placeholder="3 days" />
            </Field>
          </div>
          <Field label="Course link on Prime Safety Global" error={e.externalUrl}>
            <Input placeholder="https://example.rw" value={v.externalUrl} onChange={(x) => set({ externalUrl: x.target.value })} />
          </Field>
          <Field label="URL slug" optional error={e.slug}>
            <Input placeholder="https://example.rw" value={v.slug} onChange={(x) => set({ slug: x.target.value })} />
          </Field>
          <Field label="Image" optional>
            <UploadField enabled={uploadsEnabled} value={image} onChange={setImage} getTicket={ticket("training")} multiple={false} label="Add image" maxMb={8} library={{ folder: "trainings" }} />
          </Field>
          <div className="flex gap-6">
            <Checkbox label="Published" checked={v.isPublished} onChange={(x) => set({ isPublished: x.target.checked })} />
            <Checkbox label="Featured" checked={v.isFeatured} onChange={(x) => set({ isFeatured: x.target.checked })} />
          </div>
          <FormError message={err(form)} />
        </div>
      </Dialog>
    </>
  );
}

// ---------------- Category (dialog) ----------------

export function CategoryDialogButton({ item, label, uploadsEnabled = false }: { item?: { id: string; name: string; slug: string; type: string; division: string; description: string | null; order: number; image?: string | null }; label: string; uploadsEnabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: item?.name ?? "", slug: item?.slug ?? "", type: item?.type ?? "EQUIPMENT", division: item?.division ?? "EQUIPMENT", description: item?.description ?? "", order: String(item?.order ?? 0) });
  const [image, setImage] = useState<string[]>(item?.image ? [item.image] : []);
  const form = useActionForm<unknown>();
  const e = form.errors;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    const input = { ...v, image: image[0] ?? "" };
    const r = item ? await form.run({ schema: updateCategorySchema, input: { id: item.id, ...input }, action: updateCategory }) : await form.run({ schema: createCategorySchema, input, action: createCategory });
    if (!r) return;
    toast("success", "Saved.");
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button variant={item ? "outline" : "primary"} size={item ? "sm" : "md"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={item ? "Edit category" : "New category"} footer={<Button onClick={save} disabled={form.pending}>{form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>}>
        <div className="space-y-4">
          <Field label="Name" error={e.name}>
            <Input placeholder="e.g. Heavy Equipment" value={v.name} onChange={(x) => set({ name: x.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" error={e.type}>
              <Select value={v.type} onChange={(x) => set({ type: x.target.value })}>
                <option value="EQUIPMENT">Equipment</option>
                <option value="PRODUCT">Product</option>
                <option value="SERVICE">Service</option>
              </Select>
            </Field>
            <Field label="Division">
              <Select value={v.division} onChange={(x) => set({ division: x.target.value })}>
                {DIVISIONS.map((d) => (
                  <option key={d.enum} value={d.enum}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="URL slug" optional error={e.slug}>
              <Input placeholder="https://example.rw" value={v.slug} onChange={(x) => set({ slug: x.target.value })} />
            </Field>
            <Field label="Order">
              <Input placeholder="0" type="number" value={v.order} onChange={(x) => set({ order: x.target.value })} />
            </Field>
          </div>
          <Field label="Description" optional hint="One or two sentences shown on the division page.">
            <Textarea value={v.description} maxLength={500} showCount placeholder="e.g. Excavators, loaders and rollers for earthworks across Rwanda." onChange={(x) => set({ description: x.target.value })} />
          </Field>
          <Field label="Image" optional error={e.image}>
            <UploadField enabled={uploadsEnabled} value={image} onChange={setImage} getTicket={ticket("category")} multiple={false} label="Add image" maxMb={8} library={{ folder: "categories" }} />
          </Field>
          <FormError message={err(form)} />
        </div>
      </Dialog>
    </>
  );
}
