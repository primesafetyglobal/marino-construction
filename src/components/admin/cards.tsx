import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { formatPhone, humanize } from "@/lib/format";
import { Panel } from "./ui";

export function ClientCard({ client }: { client: { id: string; name: string; companyName: string | null; entityType: string; phone: string | null; email: string | null; district: string | null; tin: string | null } }) {
  return (
    <Panel title="Client">
      <Link href={`/admin/clients/${client.id}`} className="text-base font-semibold hover:underline">
        {client.companyName ?? client.name}
      </Link>
      {client.companyName && <p className="text-sm text-muted">Contact: {client.name}</p>}
      <ul className="mt-3 space-y-1.5 text-sm">
        {client.phone && (
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted" />
            <a href={`tel:${client.phone}`} className="hover:underline">
              {formatPhone(client.phone)}
            </a>
          </li>
        )}
        {client.email && (
          <li className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted" />
            <a href={`mailto:${client.email}`} className="hover:underline">
              {client.email}
            </a>
          </li>
        )}
      </ul>
      <p className="mt-3 text-xs text-muted">
        {humanize(client.entityType)}
        {client.district ? ` · ${client.district}` : ""}
        {client.tin ? ` · TIN ${client.tin}` : ""}
      </p>
    </Panel>
  );
}
