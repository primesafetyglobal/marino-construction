import type { NextConfig } from "next";

// Filing (docs/complete/filing-module.md): storages live in the database, but
// next.config is evaluated at build time, so the hosts that serve PUBLIC files
// are listed in FILING_IMAGE_HOSTS (comma-separated host names or base URLs).
// The bootstrap storage (FILING_BOOTSTRAP_* or the S3_* fallback) is added
// automatically. Add a new storage's host here before activating or migrating to it.
const fallbackBase =
  process.env.FILING_BOOTSTRAP_PUBLIC_BASE_URL ||
  process.env.S3_PUBLIC_URL ||
  (() => {
    const bucket = process.env.FILING_BOOTSTRAP_BUCKET || process.env.S3_BUCKET;
    const region = process.env.FILING_BOOTSTRAP_REGION || process.env.S3_REGION;
    return bucket && region && !process.env.FILING_BOOTSTRAP_ENDPOINT ? `https://${bucket}.s3.${region}.amazonaws.com` : "";
  })();

function toHost(v: string): URL | null {
  const value = v.trim();
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

const imageHosts = [...(process.env.FILING_IMAGE_HOSTS ?? "").split(","), fallbackBase]
  .map(toHost)
  .filter((u): u is URL => !!u)
  .filter((u, i, all) => all.findIndex((x) => x.host === u.host) === i);

const nextConfig: NextConfig = {
  reactCompiler: true,
  // SmartImage optimises images only from these hosts.
  env: { NEXT_PUBLIC_IMAGE_HOSTS: imageHosts.map((u) => u.host).join(",") },
  images: {
    remotePatterns: imageHosts.map((u) => ({ protocol: u.protocol.replace(":", "") as "https" | "http", hostname: u.hostname, pathname: "/**" })),
  },
  // Uploads go browser → storage (presigned PUT); server actions carry no file bytes,
  // so the default 1 MB body limit is kept.
  poweredByHeader: false,
};

export default nextConfig;
