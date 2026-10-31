#!/usr/bin/env bash
# DNSA conformance greps (DNSA 42.3-42.4, docs/DNSA.md). Exit 1 on any finding.
set -u
cd "$(dirname "$0")/.."
M=src/server/modules
fail=0

echo "1. Isolation: cross-module imports must be exactly the D-2 list"
ALLOWED='^(src/server/modules/operations/[^:]+:.*modules/parties/(client/client|vendor/vendor|applicant/applicant)\.service"|src/server/modules/operations/[^:]+:.*modules/catalog/(equipment/equipment|product/product|service/service)\.service"|src/server/modules/catalog/equipment/equipment\.service\.ts:.*modules/parties/vendor/vendor\.service"|src/server/modules/parties/payment/payment\.service\.ts:.*modules/operations/(equipment-request/equipment-request|supply-order/supply-order|service-request/service-request)\.service"|src/server/modules/access/review/review\.service\.ts:.*modules/parties/client/client\.service")'
for mod in catalog operations parties access; do
  others=$(echo "catalog operations parties access" | tr ' ' '\n' | grep -v "^$mod$" | paste -sd'|' -)
  grep -rnE "from \"@/server/modules/($others)/" "$M/$mod" | sed -E 's/:[0-9]+:/:/' | grep -vE "$ALLOWED" && fail=1
done
# Only *.service.ts files may hold the D-2 imports, and only of "Shared" functions (checked by review).
grep -rlE "from \"@/server/modules/" "$M" | while read -r f; do
  if grep -qE "from \"@/server/modules/(catalog|operations|parties|access)/" "$f"; then
    mod=$(echo "$f" | cut -d/ -f4)
    if grep -E "from \"@/server/modules/" "$f" | grep -vq "modules/$mod/"; then
      case "$f" in *.service.ts) ;; *) echo "  cross-module import outside a service: $f"; exit 1 ;; esac
    fi
  fi
done || fail=1
# Filing (guide §14.1): other modules import only its public API; Filing imports no other module.
grep -rnE 'from "@/server/modules/filing/' "$M" | grep -v "^$M/filing/" | grep -vE 'from "@/server/modules/filing/lib"' && fail=1
grep -rnE 'from "@/server/modules/(catalog|operations|parties|access)/' "$M/filing" && fail=1
# One door: @aws-sdk only inside filing/lib/storage (also enforced by ESLint).
grep -rlE 'from "@aws-sdk/' src scripts --include='*.ts' --include='*.tsx' | grep -v "^$M/filing/lib/storage/" && fail=1

echo "2. Public entry points (access: \"public\"), compare with the module records"
grep -rn 'access: "public"' "$M" | sed -E 's#^src/server/modules/##; s/:[0-9]+:.*//' | sort | uniq -c

echo "3. No next/* import in any *.service.ts"
grep -rln 'from "next/' "$M" --include='*.service.ts' && fail=1

echo "4. db imported only by services, named helpers, scripts and the seed"
grep -rln 'from "@/server/validation/db"\|validation/db"' src prisma scripts --include='*.ts' --include='*.tsx' \
  | grep -vE '\.service\.ts$|validation/(db|auth|prisma-errors)\.ts$|catalog\.slug\.ts$|\.select\.ts$|prisma/seed|scripts/|modules/filing/lib/' \
  | while read -r f; do
      # select files may import the Prisma *type* only
      grep -q 'import type' "$f" && continue
      echo "  db imported by $f"; exit 1
    done || fail=1

echo "5. Every model folder has the six files"
for d in "$M"/*/*/; do
  name=$(basename "$d")
  case "$d" in "$M"/filing/lib/) continue ;; esac # Filing library layer (guide §3)
  case "$name" in search|contact-check|dashboard|jobs) n=5 ;; *) n=6 ;; esac
  count=$(ls "$d" | grep -cE "^$name\.(schema|select|service|queries|routes|actions)\.ts$")
  [ "$count" -eq "$n" ] || { echo "  $d has $count of $n files"; fail=1; }
done

echo "6. Rule coverage: every rule id in docs/modules/*.md appears in a test title"
for id in $(grep -ohE "(CAT|OPS|PTY|ACC|FIL|STO|SET|BAK|JOB)-R[0-9]+" docs/modules/*.md | sort -u); do
  grep -rqE "it\\(\"$id[ ,]" tests || grep -rqE "\"[^\"]*\b$id\b" tests || { echo "  untested: $id"; fail=1; }
done

[ $fail -eq 0 ] && echo "DNSA checks: clean" || echo "DNSA checks: FINDINGS"
exit $fail
