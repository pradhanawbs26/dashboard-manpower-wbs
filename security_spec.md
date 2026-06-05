# Security Specification: Manpower Control system

This document defines the high-strength architectural boundaries and data invariants established inside our Firestore Security Rules environment.

## 1. Data Invariants

1. **Authentication Boundary**: No unauthenticated client can retrieve or construct any heavy unit operational parameters or manpower records.
2. **Identity Verification**: Active write-operations are restricted to logged-in users with a Google-verified email address (`request.auth.token.email_verified == true`).
3. **Immutability of Document ID references**: All update statements require that the underlying entity ID (`id`) matches the pre-existing record to block entity spoofing.
4. **Strict Field Whitelist**: Any custom shadow fields injects will violate `.keys().size()` checks and trigger a `permission_denied` fault.

## 2. Invalidation Test Matrix ("The Dirty Dozen" Payloads)

| Fault ID | Target Collection | Payload Structure | Attack Mode / Vulnerability | Expected Result |
|---|---|---|---|---|
| D1 | `heavyUnits` | `{id: "u1", unitCode: "UX1", brand: "X", type: "Dump Truck", status: "Ready", maliciousFlag: true}` | Extra shadow keys injection (Values Poisoning) | `PERMISSION_DENIED` |
| D2 | `heavyUnits` | `{id: "u1", unitCode: "UX1", status: "Ready"}` | Missing required fields | `PERMISSION_DENIED` |
| D3 | `heavyUnits` | `{id: "u2", unitCode: 12345, brand: "X", type: "Dump Truck", status: "Ready"}` | Invalid field type (`unitCode` is numerical) | `PERMISSION_DENIED` |
| D4 | `employees` | `{id: "e1", nrp: "NRP1", name: "A", rosterPattern: "6-1", status: "Active", specializations: "Dump Truck"}` | Specialized EGI must be of type `List` | `PERMISSION_DENIED` |
| D5 | `employees` | `{id: "e1", nrp: "NRP1", name: "A", rosterPattern: "6-1", status: "Active", specializations: ["DT", "DT", "DT", "DT", "DT", "DT", "DT", "DT", "DT", "DT", "DT", "DT"]}` | Specializations list size exceeds bound size of 10 | `PERMISSION_DENIED` |
| D6 | `unitSettings` | `{id: "s1", groupId: "utama", unitId: "u1", operator1Id: "e1", operator2Id: "e2", rosterPattern: "6-1", fixedOffDayOfWeek: "Sunday", startSiangDate: "2026-06-01"}` | `fixedOffDayOfWeek` must be a numerical integer representation | `PERMISSION_DENIED` |
| D7 | `unitSettings` | `{id: "s1", groupId: "utama", unitId: "u1", operator1Id: "e1", operator2Id: "e2", rosterPattern: "6-1", fixedOffDayOfWeek: 0, startSiangDate: "2026-06-01-MALICIOUS-INJECTION-STRING-EXCEEDING-EXPECTED-DATE-SIZE"}` | Date code string exceeds buffer allocation | `PERMISSION_DENIED` |
| D8 | `heavyUnits/u1` | Authenticated client (`email_verified` = false) writing | Unverified email bypass attempt | `PERMISSION_DENIED` |
| D9 | `heavyUnits/MALICIOUS_RESOURCE_ID_STRING_CONTAINING_MORE_THAN_128_JUNK_CHARACTERS` | Any payload | ID Poisoning string flood attack | `PERMISSION_DENIED` |
| D10 | `unitSettings` | `{id: "s1", groupId: "utama", unitId: "u1", operator1Id: "e1", operator2Id: "e2", rosterPattern: "6-1", fixedOffDayOfWeek: 0, startSiangDate: "2026-06-01"}` with doc ID `s2` | Route Parameter mismatch (spoofing) | `PERMISSION_DENIED` |
| D11 | `heavyUnits` | Unauthenticated read query | Public listing leakage attempt | `PERMISSION_DENIED` |
| D12 | `heavyUnits` | `{id: "u1", unitCode: "UNIT 01", brand: "Scania", type: "Dump Truck", status: "Ready"}` update to change `id` to `"u2"` | Mutating record primary identifier | `PERMISSION_DENIED` |
