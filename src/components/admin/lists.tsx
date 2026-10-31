"use client";

// One small client component per admin list: columns and filters. Data comes
// from the Server Component first, then from the GET routes (useApiList).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, FileText, LayoutGrid, Pencil, Rows3, Star, Trash2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { MediaCard } from "@/components/ui/media-card";
import { OverflowMenu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/sheet";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, NoAccess } from "@/components/ui/states";
import { approveEquipment, deleteEquipment, setEquipmentStatus, updateEquipment } from "@/server/modules/catalog/equipment/equipment.actions";
import { deleteProduct, updateProduct } from "@/server/modules/catalog/product/product.actions";
import { divisionByEnum, DIVISIONS } from "@/config/divisions";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { formatDate, formatDateTime, formatPhone, formatRwf, humanize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/server/core/result";
import { deleteReview, setReviewStatus } from "@/server/modules/access/review/review.actions";
import { PayDialog } from "./payments-panel";
import { DataTable, FilterBar, useApiList, type Column, type Filter, type Params } from "./list";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Page = { items: Row[]; nextCursor: string | null };

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: humanize(v) }));
const handlerFilter: Filter = { name: "handler", label: "Any handler", type: "select", options: [{ value: "me", label: "Handled by me" }, { value: "none", label: "No handler" }] };
const clientName = (r: Row) => r.client?.companyName ?? r.client?.name ?? "-";
const code = (href: string) =>
  function CodeCell(r: Row) {
    return (
      <Link href={`${href}/${r.id}`} className="num font-semibold hover:underline">
        {r.code}
      </Link>
    );
  };

function ListView({ endpoint, initial, params, filters, columns, empty, rowHref }: { endpoint: `/api/${string}`; initial: Page; params: Params; filters: Filter[]; columns: Column<Row>[]; empty: string; rowHref?: (r: Row) => string }) {
  const list = useApiList<Row>(endpoint, initial, params);
  // A "status" filter becomes tabs above the toolbar (All + each status).
  const status = filters.find((f) => f.name === "status" && f.type === "select") as Extract<Filter, { type: "select" }> | undefined;
  const rest = status ? filters.filter((f) => f !== status) : filters;
  return (
    <>
      {status && (
        <div role="tablist" aria-label="Status" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
          {[{ value: "", label: "All" }, ...status.options].map((o) => {
            const active = (list.params.status ?? "") === o.value;
            return (
              <button
                key={o.value || "all"}
                role="tab"
                aria-selected={active}
                onClick={() => list.setParam("status", o.value || undefined)}
                className={cn("relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors", active ? "text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full after:bg-brand" : "text-muted hover:text-ink")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      <FilterBar filters={rest} params={list.params} setParam={list.setParam} count={`${list.items.length}${list.hasMore ? "+" : ""} shown`} />
      <DataTable list={list} columns={columns} empty={{ title: empty }} onRowHref={rowHref} />
    </>
  );
}

export function EquipmentRequestsList({ initial, params }: { initial: Page; params: Params }) {
  const href = "/admin/equipment-requests";
  return (
    <ListView
      endpoint="/api/v1/operations/equipment-request"
      initial={initial}
      params={params}
      rowHref={(r) => `${href}/${r.id}`}
      empty="No equipment requests match."
      filters={[
        { name: "q", label: "Search code, client, equipment", type: "search" },
        { name: "status", label: "Any status", type: "select", options: opts(["NEW", "QUOTED", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"]) },
        { name: "type", label: "Rent or buy", type: "select", options: [{ value: "RENT", label: "Rent" }, { value: "BUY", label: "Buy" }] },
        handlerFilter,
      ]}
      columns={[
        { header: "Code", cell: code(href) },
        { header: "Client", cell: clientName },
        { header: "Item", cell: (r) => <span>{r.type === "RENT" ? "Rent" : "Buy"} · {r.equipment?.name ?? <em className="text-muted">sourcing</em>}</span> },
        { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
        { header: "Handler", cell: (r) => r.handledBy?.name ?? <span className="text-muted">-</span> },
        { header: "Created", cell: (r) => formatDate(r.createdAt), className: "whitespace-nowrap" },
      ]}
    />
  );
}

export function SupplyOrdersList({ initial, params }: { initial: Page; params: Params }) {
  const href = "/admin/supply-orders";
  return (
    <ListView
      endpoint="/api/v1/operations/supply-order"
      initial={initial}
      params={params}
      rowHref={(r) => `${href}/${r.id}`}
      empty="No supply orders match."
      filters={[
        { name: "q", label: "Search code, client, items", type: "search" },
        { name: "status", label: "Any status", type: "select", options: opts(["NEW", "QUOTED", "CONFIRMED", "DELIVERED", "CANCELLED"]) },
        handlerFilter,
      ]}
      columns={[
        { header: "Code", cell: code(href) },
        { header: "Client", cell: clientName },
        { header: "Items", cell: (r) => <span className="line-clamp-1 max-w-72">{r.product?.name ? `${r.product.name}: ` : ""}{r.items}</span> },
        { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
        { header: "Handler", cell: (r) => r.handledBy?.name ?? <span className="text-muted">-</span> },
        { header: "Created", cell: (r) => formatDate(r.createdAt), className: "whitespace-nowrap" },
      ]}
    />
  );
}

export function ServiceRequestsList({ initial, params }: { initial: Page; params: Params }) {
  const href = "/admin/service-requests";
  return (
    <ListView
      endpoint="/api/v1/operations/service-request"
      initial={initial}
      params={params}
      rowHref={(r) => `${href}/${r.id}`}
      empty="No service requests match."
      filters={[
        { name: "q", label: "Search code, client, service", type: "search" },
        { name: "division", label: "Any division", type: "select", options: DIVISIONS.filter((d) => ["services", "paint", "equipment"].includes(d.variant)).map((d) => ({ value: d.enum, label: d.name })) },
        { name: "status", label: "Any status", type: "select", options: opts(["NEW", "QUOTED", "SCHEDULED", "IN_PROGRESS", "DELIVERED", "CANCELLED"]) },
        handlerFilter,
      ]}
      columns={[
        { header: "Code", cell: code(href) },
        { header: "Client", cell: clientName },
        { header: "Service", cell: (r) => <span>{r.service.name}{r.paymentPlan === "INSTALLMENT" && <Badge tone="brand" className="ml-2">Installments</Badge>}</span> },
        { header: "Division", cell: (r) => divisionByEnum(r.service.category.division)?.shortName },
        { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
        { header: "Handler", cell: (r) => r.handledBy?.name ?? <span className="text-muted">-</span> },
        { header: "Created", cell: (r) => formatDate(r.createdAt), className: "whitespace-nowrap" },
      ]}
    />
  );
}

export function WorkforceRequestsList({ initial, params }: { initial: Page; params: Params }) {
  const href = "/admin/workforce-requests";
  return (
    <ListView
      endpoint="/api/v1/operations/workforce-request"
      initial={initial}
      params={params}
      rowHref={(r) => `${href}/${r.id}`}
      empty="No workforce requests match."
      filters={[
        { name: "q", label: "Search code, role, client", type: "search" },
        { name: "status", label: "Any status", type: "select", options: opts(["NEW", "RECRUITING", "FILLED", "CLOSED"]) },
        { name: "published", label: "Published or not", type: "select", options: [{ value: "true", label: "Published" }, { value: "false", label: "Not published" }] },
        handlerFilter,
      ]}
      columns={[
        { header: "Code", cell: code(href) },
        { header: "Client", cell: clientName },
        { header: "Role", cell: (r) => `${r.quantity} × ${r.role}` },
        { header: "Post", cell: (r) => (r.isOpen ? <Badge tone="success">Open</Badge> : r.isPublished ? <Badge>Published</Badge> : <span className="text-muted">-</span>) },
        { header: "Applicants", cell: (r) => r._count.applications },
        { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
        { header: "Created", cell: (r) => formatDate(r.createdAt), className: "whitespace-nowrap" },
      ]}
    />
  );
}

export function ClientsList({ initial, params }: { initial: Page; params: Params }) {
  return (
    <ListView
      endpoint="/api/v1/parties/client"
      initial={initial}
      params={params}
      rowHref={(r) => `/admin/clients/${r.id}`}
      empty="No clients match."
      filters={[{ name: "q", label: "Search name, phone, email, TIN", type: "search" }]}
      columns={[
        { header: "Name", cell: (r) => <Link href={`/admin/clients/${r.id}`} className="font-semibold hover:underline">{r.companyName ?? r.name}</Link> },
        { header: "Contact", cell: (r) => <span className="text-muted">{[formatPhone(r.phone), r.email].filter((x) => x && x !== "-").join(" · ")}</span> },
        { header: "District", cell: (r) => r.district ?? "-" },
        { header: "Requests", cell: (r) => r._count.equipmentRequests + r._count.supplyOrders + r._count.serviceRequests + r._count.workforceRequests },
        { header: "Since", cell: (r) => formatDate(r.createdAt) },
      ]}
    />
  );
}

export function VendorsList({ initial, params }: { initial: Page; params: Params }) {
  return (
    <ListView
      endpoint="/api/v1/parties/vendor"
      initial={initial}
      params={params}
      rowHref={(r) => `/admin/vendors/${r.id}`}
      empty="No vendors match."
      filters={[
        { name: "q", label: "Search name, phone, email, offer", type: "search" },
        { name: "type", label: "Any type", type: "select", options: opts(["EQUIPMENT_OWNER", "SUPPLIER", "GARAGE", "TECHNICIAN", "CONTRACTOR", "RECYCLER", "OTHER"]) },
        { name: "status", label: "Any status", type: "select", options: opts(["PENDING", "APPROVED", "INACTIVE"]) },
        { name: "partner", label: "Partners or not", type: "select", options: [{ value: "true", label: "Partners" }, { value: "false", label: "Not partners" }] },
      ]}
      columns={[
        {
          header: "Vendor",
          cell: (r) => (
            <span className="flex items-center gap-2">
              <Link href={`/admin/vendors/${r.id}`} className="font-semibold hover:underline">{r.companyName ?? r.name}</Link>
              {r.isPartner && <Badge tone="brand" icon={<BadgeCheck className="h-3 w-3" />}>Approved Partner</Badge>}
            </span>
          ),
        },
        { header: "Type", cell: (r) => humanize(r.type) },
        { header: "Contact", cell: (r) => <span className="text-muted">{[formatPhone(r.phone), r.email].filter((x) => x && x !== "-").join(" · ")}</span> },
        { header: "District", cell: (r) => r.district ?? "-" },
        { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
      ]}
    />
  );
}

export function ApplicantsList({ initial, params }: { initial: Page; params: Params }) {
  return (
    <ListView
      endpoint="/api/v1/parties/applicant"
      initial={initial}
      params={params}
      rowHref={(r) => `/admin/applicants/${r.id}`}
      empty="No applicants match."
      filters={[
        { name: "q", label: "Search name, trade, phone", type: "search" },
        { name: "gender", label: "Any gender", type: "select", options: [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] },
        { name: "minAge", label: "Min age", type: "select", options: ["18", "25", "30", "40", "50"].map((v) => ({ value: v, label: `${v}+` })) },
        { name: "maxAge", label: "Max age", type: "select", options: ["25", "30", "40", "50", "60"].map((v) => ({ value: v, label: `Up to ${v}` })) },
      ]}
      columns={[
        { header: "Name", cell: (r) => <Link href={`/admin/applicants/${r.id}`} className="font-semibold hover:underline">{r.fullName}</Link> },
        { header: "Trade", cell: (r) => r.trade },
        { header: "Age", cell: (r) => r.age },
        { header: "District", cell: (r) => r.district ?? "-" },
        { header: "Contact", cell: (r) => <span className="text-muted">{[formatPhone(r.phone), r.email].filter((x) => x && x !== "-").join(" · ")}</span> },
        { header: "CV", cell: (r) => (r.hasCv ? <FileText className="h-4 w-4" aria-label="Has CV" /> : "-") },
        { header: "Applications", cell: (r) => r._count.applications },
      ]}
    />
  );
}

export function PaymentsList({ initial, params, canRecord }: { initial: Page; params: Params; canRecord: boolean }) {
  const [paying, setPaying] = useState<string | null>(null);
  return (
    <>
      <ListView
        endpoint="/api/v1/parties/payment"
        initial={initial}
        params={params}
        empty="No payments match."
        filters={[
          { name: "status", label: "Any status", type: "select", options: [{ value: "DUE", label: "Due" }, { value: "PAID", label: "Paid" }] },
          { name: "overdue", label: "Overdue or not", type: "select", options: [{ value: "1", label: "Overdue only" }] },
        ]}
        columns={[
          { header: "Amount", cell: (r) => <span className="font-semibold">{formatRwf(r.amount)}</span> },
          { header: "Request", cell: (r) => (r.request ? <Link href={r.request.href} className="font-mono hover:underline">{r.request.code}</Link> : "-") },
          { header: "Client", cell: (r) => (r.request ? <Link href={`/admin/clients/${r.request.clientId}`} className="hover:underline">{r.request.clientName}</Link> : "-") },
          { header: "Due", cell: (r) => formatDate(r.dueDate) },
          { header: "Status", cell: (r) => <StatusPill status={r.isOverdue ? "OVERDUE" : r.status} /> },
          { header: "Method", cell: (r) => (r.method ? humanize(r.method) : "-") },
          { header: "Paid", cell: (r) => formatDate(r.paidAt) },
          { header: "", cell: (r) => (canRecord && r.status === "DUE" ? <Button size="sm" variant="outline" onClick={() => setPaying(r.id)}>Mark paid</Button> : null) },
        ]}
      />
      {paying && <PayDialog id={paying} onClose={() => setPaying(null)} />}
    </>
  );
}

export function ReviewsList({ initial, params, canDelete }: { initial: Page; params: Params; canDelete: boolean }) {
  const list = useApiList<Row>("/api/v1/access/review", initial, params);
  const toast = useToast();
  async function run(p: Promise<ActionResult<unknown>>, message: string) {
    const r = await p;
    if (!r.ok) return toast("error", r.error.message);
    toast("success", message);
    list.reload();
  }
  return (
    <>
      <FilterBar
        params={list.params}
        setParam={list.setParam}
        filters={[
          { name: "status", label: "Any status", type: "select", options: [{ value: "new", label: "New" }, { value: "public", label: "Public" }, { value: "private", label: "Private" }] },
          { name: "rating", label: "Any rating", type: "select", options: ["5", "4", "3", "2", "1"].map((v) => ({ value: v, label: `${v} stars` })) },
        ]}
      />
      <DataTable
        list={list}
        empty={{ title: "No reviews match." }}
        columns={[
          {
            header: "Review",
            cell: (r) => (
              <div className="max-w-md space-y-1">
                <Stars value={r.rating} size={14} />
                <p className="text-sm">{r.message}</p>
                <p className="text-xs text-muted">
                  {r.fullName}
                  {r.company ? ` · ${r.company}` : ""} · {r.division ? divisionByEnum(r.division)?.shortName : "General"} · {formatDateTime(r.createdAt)}
                </p>
              </div>
            ),
          },
          { header: "Contact (private)", cell: (r) => <span className="text-xs text-muted">{[formatPhone(r.phone), r.email].filter((x) => x && x !== "-").join(" · ") || "-"}</span> },
          { header: "Client", cell: (r) => (r.client ? <Link href={`/admin/clients/${r.client.id}`} className="hover:underline">{r.client.name}</Link> : "-") },
          { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
          {
            header: "Actions",
            cell: (r) => (
              <div className="flex flex-wrap gap-1.5">
                {r.status !== "PUBLIC" && (
                  <Button size="sm" variant="dark" onClick={() => run(setReviewStatus({ id: r.id, status: "PUBLIC" }), "Review is public.")} data-testid="review-public">
                    Make public
                  </Button>
                )}
                {r.status !== "PRIVATE" && (
                  <Button size="sm" variant="outline" onClick={() => run(setReviewStatus({ id: r.id, status: "PRIVATE" }), "Review is private.")}>
                    Make private
                  </Button>
                )}
                {canDelete && (
                  <Button size="sm" variant="danger" onClick={() => confirm("Delete this review?") && run(deleteReview({ id: r.id }), "Review deleted.")}>
                    Delete
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

export function UsersList({ initial, params }: { initial: Page; params: Params }) {
  return (
    <ListView
      endpoint="/api/v1/access/user"
      initial={initial}
      params={params}
      rowHref={(r) => `/admin/users/${r.id}`}
      empty="No users match."
      filters={[
        { name: "q", label: "Search name or email", type: "search" },
        { name: "role", label: "Any role", type: "select", options: opts(["SUPER_ADMIN", "ADMIN", "STAFF"]) },
      ]}
      columns={[
        { header: "Name", cell: (r) => <Link href={`/admin/users/${r.id}`} className="font-semibold hover:underline" data-testid="user-row">{r.name}</Link> },
        { header: "Email", cell: (r) => r.email },
        { header: "Role", cell: (r) => humanize(r.role) },
        { header: "Status", cell: (r) => (r.invitePending ? <Badge tone="warning">Invite pending</Badge> : r.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>) },
        { header: "Last login", cell: (r) => formatDateTime(r.lastLoginAt) },
      ]}
    />
  );
}

export type CatalogCan = { update?: boolean; approve?: boolean; delete?: boolean };

export function CatalogList({ kind, initial, params, can = {} }: { kind: "equipment" | "products" | "services"; initial: Page; params: Params; can?: CatalogCan }) {
  const endpoint = { equipment: "/api/v1/catalog/equipment", products: "/api/v1/catalog/product", services: "/api/v1/catalog/service" }[kind] as `/api/${string}`;
  const href = `/admin/catalog/${kind}`;
  const filters: Filter[] = [{ name: "q", label: kind === "equipment" ? "Search machines" : "Search", type: "search" }];
  if (kind === "equipment") filters.push({ name: "status", label: "Any status", type: "select", options: opts(["PENDING", "AVAILABLE", "RENTED", "SOLD", "INACTIVE"]) }, { name: "mode", label: "Rent or sale", type: "select", options: [{ value: "rent", label: "For rent" }, { value: "sale", label: "For sale" }] });
  if (kind === "services") filters.push({ name: "division", label: "Any division", type: "select", options: DIVISIONS.map((d) => ({ value: d.enum, label: d.name })) });
  const price = (r: Row) => (kind === "equipment" ? (r.forRent ? formatRwf(r.rentPrice) : formatRwf(r.salePrice)) : r.price ? formatRwf(r.price) : null);
  const columns: Column<Row>[] =
    kind === "equipment"
      ? [
          { header: "Name", primary: true, cell: (r) => <Link href={`${href}/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
          { header: "Category", cell: (r) => r.category.name },
          { header: "Owner", cell: (r) => (r.owner ? (r.owner.companyName ?? r.owner.name) : "Marino") },
          { header: "Price", mono: true, cell: (r) => (r.forRent ? `${formatRwf(r.rentPrice)}${r.rentUnit ? ` / ${r.rentUnit.toLowerCase()}` : ""}` : formatRwf(r.salePrice)) },
          { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
          { header: "Featured", cell: (r) => (r.isFeatured ? "Yes" : "-") },
        ]
      : kind === "products"
        ? [
            { header: "Name", primary: true, cell: (r) => <Link href={`${href}/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
            { header: "Category", cell: (r) => r.category.name },
            { header: "Price", mono: true, cell: (r) => (r.price ? `${formatRwf(r.price)} / ${r.unit.toLowerCase()}` : "On request") },
            { header: "Available", cell: (r) => (r.isAvailable ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>) },
            { header: "Featured", cell: (r) => (r.isFeatured ? "Yes" : "-") },
          ]
        : [
            { header: "Name", primary: true, cell: (r) => <Link href={`${href}/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
            { header: "Category", cell: (r) => r.category.name },
            { header: "Division", cell: (r) => divisionByEnum(r.category.division)?.shortName },
            { header: "Requests", mono: true, cell: (r) => r._count.requests },
            { header: "Active", cell: (r) => (r.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>) },
          ];
  if (kind === "services") return <ListView endpoint={endpoint} initial={initial} params={params} filters={filters} columns={columns} rowHref={(r) => `${href}/${r.id}`} empty="Nothing here yet." />;
  return <CatalogGrid kind={kind} endpoint={endpoint} href={href} initial={initial} params={params} filters={filters} columns={columns} price={price} can={can} />;
}

function CatalogGrid({ kind, endpoint, href, initial, params, filters, columns, price, can }: { kind: "equipment" | "products"; endpoint: `/api/${string}`; href: string; initial: Page; params: Params; filters: Filter[]; columns: Column<Row>[]; price: (r: Row) => string | null; can: CatalogCan }) {
  const router = useRouter();
  const toast = useToast();
  const list = useApiList<Row>(endpoint, initial, params);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [pending, setPending] = useState<Row[] | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind !== "equipment") return;
    let stop = false;
    apiGet<Page>(endpoint, { status: "PENDING", limit: 12 }).then((r) => !stop && r.ok && setPending((r.data as Page).items));
    return () => {
      stop = true;
    };
  }, [kind, endpoint, list.items]);

  const run = async (p: Promise<ActionResult<unknown>>, done: string) => {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) return toast("error", r.error.message);
    toast("success", done);
    list.reload();
    router.refresh();
  };
  const feature = (r: Row) => run(kind === "equipment" ? updateEquipment({ id: r.id, isFeatured: !r.isFeatured }) : updateProduct({ id: r.id, isFeatured: !r.isFeatured }), r.isFeatured ? "Removed from featured." : "Featured on the home page.");
  const menu = (r: Row): MenuItem[] => [
    { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => router.push(`${href}/${r.id}`) },
    ...(can.update ? [{ label: r.isFeatured ? "Remove from featured" : "Feature on home page", icon: <Star className="h-4 w-4" />, onSelect: () => feature(r) }] : []),
    ...(kind === "equipment" && can.update
      ? (["AVAILABLE", "SOLD", "INACTIVE"] as const).filter((st) => st !== r.status && r.status !== "PENDING").map((st) => ({ label: `Mark ${humanize(st).toLowerCase()}`, onSelect: () => run(setEquipmentStatus({ id: r.id, status: st }), `Marked ${humanize(st).toLowerCase()}.`) }))
      : []),
    ...(can.delete ? ["separator" as const, { label: "Delete", danger: true, icon: <Trash2 className="h-4 w-4" />, onSelect: () => setConfirm(r) }] : []),
  ];
  const card = (r: Row, i: number) => (
    <MediaCard
      key={r.id}
      href={`${href}/${r.id}`}
      image={r.images?.[0]}
      title={r.name}
      seed={i}
      icon={kind === "equipment" ? "Truck" : "BrickWall"}
      meta={[r.category?.name, kind === "equipment" ? (r.owner ? (r.owner.companyName ?? r.owner.name) : "Marino fleet") : null, r.location].filter(Boolean).join(" · ")}
      price={price(r)}
      priceUnit={kind === "equipment" ? (r.forRent ? r.rentUnit?.toLowerCase() : null) : r.unit?.toLowerCase()}
      status={kind === "equipment" ? <StatusPill status={r.status} className="bg-white/95" /> : r.isAvailable ? null : <Badge className="bg-white/95">Not available</Badge>}
      featured={r.isFeatured}
      attention={r.status === "PENDING"}
      menu={<OverflowMenu items={menu(r)} label={`Actions for ${r.name}`} />}
      footer={
        r.status === "PENDING" && can.approve ? (
          <Button size="sm" className="w-full" disabled={busy} onClick={() => run(approveEquipment({ id: r.id }), "Approved and published.")}>
            <BadgeCheck className="h-4 w-4" /> Approve &amp; publish
          </Button>
        ) : undefined
      }
    />
  );
  const showStrip = kind === "equipment" && pending && pending.length > 0 && list.params.status !== "PENDING";

  return (
    <>
      {showStrip && (
        <section className="hazard-edge mb-6 overflow-hidden rounded-[var(--radius-card)] border border-brand/60 bg-brand-tint/40 p-4 pl-6" aria-label="Awaiting approval">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Awaiting approval · <span className="num">{pending.length}</span></h2>
            <button onClick={() => list.setParam("status", "PENDING")} className="text-xs font-medium underline-offset-2 hover:underline">
              Show only these
            </button>
          </div>
          <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
            {pending.map((r, i) => (
              <div key={r.id} className="w-64 shrink-0 snap-start">
                {card(r, i)}
              </div>
            ))}
          </div>
        </section>
      )}
      <FilterBar filters={filters} params={list.params} setParam={list.setParam} count={`${list.items.length}${list.hasMore ? "+" : ""} shown`}>
        <div className="inline-flex rounded-[var(--radius-input)] border border-line bg-white p-0.5" role="group" aria-label="View">
          <button aria-pressed={view === "cards"} onClick={() => setView("cards")} className={cn("rounded-[9px] p-2", view === "cards" ? "bg-charcoal text-white" : "text-muted hover:text-ink")} aria-label="Cards">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button aria-pressed={view === "table"} onClick={() => setView("table")} className={cn("rounded-[9px] p-2", view === "table" ? "bg-charcoal text-white" : "text-muted hover:text-ink")} aria-label="Table">
            <Rows3 className="h-4 w-4" />
          </button>
        </div>
      </FilterBar>
      {view === "table" ? (
        <DataTable list={list} columns={columns} empty={{ title: "Nothing here yet." }} onRowHref={(r) => `${href}/${r.id}`} />
      ) : list.error?.code === "FORBIDDEN" ? (
        <NoAccess />
      ) : list.error && !list.items.length ? (
        <ErrorState message={list.error.message} retry={<Button onClick={list.reload}>Try again</Button>} />
      ) : list.loading && !list.items.length ? (
        <CardGridSkeleton count={8} />
      ) : !list.items.length ? (
        <EmptyState title={kind === "equipment" ? "No machines match these filters" : "No products match these filters"} />
      ) : (
        <>
          <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4", list.loading && "opacity-70")}>{list.items.map(card)}</div>
          {list.hasMore && (
            <div className="mt-5 flex justify-center">
              <Button variant="outline" onClick={list.loadMore} disabled={list.loading}>
                {list.loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} pending={busy} title={`Delete ${confirm?.name ?? ""}?`} confirmLabel="Delete" onConfirm={() => confirm && run(kind === "equipment" ? deleteEquipment({ id: confirm.id }) : deleteProduct({ id: confirm.id }), "Deleted.").then(() => setConfirm(null))}>
        This removes the listing from the website. Items with requests cannot be deleted: set them inactive instead.
      </ConfirmDialog>
    </>
  );
}
