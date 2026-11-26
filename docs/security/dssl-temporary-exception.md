# D-SSL: temporary, Testing-only OpenSSL exception for School (expires 2026-12-01T00:00:00Z)

**Owner decision (Tamer, 26 Nov 2026, 21:30 UTC, decision card in the thread "Bring Munaxa School
to Testing like Docs"):** the Testing-only D-SSL acceptance of 22 Nov 2026 (munaxa-docs
`docs/security/dssl-temporary-exception.md`, munaxa-platform report
`2026-11-22-testing-temporary-openssl-acceptance`), extended to Work on 26 Nov 2026 (munaxa-work#61),
is extended to the Munaxa School Testing images, so School can reach Testing before Alpine ships
OpenSSL 3.5.10. Same five CVEs, same hard expiry. Testing only. Never production. Not a permanent
suppression.

## What is accepted, exactly

| | |
| --- | --- |
| CVEs | CVE-2026-107493, CVE-2026-107494, CVE-2026-121482, CVE-2026-124709, CVE-2026-84786 |
| Packages | `libssl3` and `libcrypto3`, version `3.5.9-r1`, type `apk` (10 exact combinations) |
| Images (scan names) | `school-api`, `school-migrate`, `school-admin` (in `publish-images-testing.yml` the Testing admin build `munaxa-school/admin:…-nonprod` is scanned under the name `school-admin`, because the exception refuses any image name that mentions production) |
| Workflows | `ci.yml`, `publish-images-testing.yml` only. **Not** `publish-images-ecr.yml` (the release path) or `deploy.yml` (legacy): those keep the permanent gate alone |
| Environment | `testing` (any other value is refused) |
| Expiry | **2026-12-01T00:00:00Z**, hard-coded in `scan-exception.py` as well as in the JSON |

The scripts are byte-for-byte the reviewed munaxa-docs and munaxa-work copies (`scan-exception.py`,
`scan-image-testing.sh`, `verify-permanent-gate.py`); only the JSON's decision text, image list and
workflow list, and the test fixture image names differ (one, `work-api`, now stands for another product).

## How it works

1. `.github/scripts/scan-image.sh` is the **permanent gate** and is **unchanged** (SHA-256
   `68c9f23c…acca2`): Grype `--fail-on high`, digest-pinned scanners, no ignore rule.
2. `.github/scripts/scan-image-testing.sh` runs `verify-permanent-gate.py`, then the permanent gate.
   If the gate passes, nothing else happens.
3. Only if the gate fails, `scan-exception.py` reads that scan's own Grype JSON and accepts it only
   when **every** HIGH/CRITICAL finding is one of the exact combinations in
   `.github/security/dssl-testing-exception.json`, for a listed image, from a listed workflow, in
   environment `testing`, with a trustworthy clock and before the expiry. Anything else is refused.
4. An accepted scan is loud: a `::warning::` annotation, a step-summary section and
   `image-reports/<name>.dssl-exception.json`.
5. Production cannot consume these images: the platform stack refuses any product image in `prod`
   while the exception exists, refuses every listed Testing-only digest in `prod` for ever, and
   after the expiry refuses to start a Testing session with them (munaxa-platform
   `infra/aws/stack/dssl-exception.tf`). Every School digest published under it is added to
   `dssl_testing_only_image_digests` in the School pin PR.

## Verify the permanent gate (anyone, any time)

```sh
python3 -I .github/scripts/verify-permanent-gate.py .
python3 -I -m unittest discover -s .github/scripts -p 'test_scan_exception.py' -v
```

## After expiry (fail closed)

From 2026-12-01T00:00:00Z every School image scan with an OpenSSL 3.5.9-r1 finding fails again, in CI
and before every push. Nothing needs to be done for that to happen.

## Removal procedure (when OpenSSL 3.5.10 is in Alpine v3.24/main)

1. Merge the School OpenSSL 3.5.10 base-image bump once its image scans pass the **permanent** gate.
2. In one PR: delete `.github/scripts/scan-exception.py`, `scan-image-testing.sh`,
   `verify-permanent-gate.py`, `test_scan_exception.py`, `.github/security/dssl-testing-exception.json`
   and this file; change every `scan-image-testing.sh … testing` call back to `scan-image.sh …`;
   remove the "Verify the permanent vulnerability gate" CI step.
3. In munaxa-platform: move the School digests in `dssl_testing_only_image_digests` to
   `withdrawn-images.tf` together with the other products'.
