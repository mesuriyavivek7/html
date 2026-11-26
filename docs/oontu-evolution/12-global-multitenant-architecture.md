# 12 · Global multi-tenant architecture

## 1. Existing code evidence

| Concern | Code |
|---|---|
| Countries | `COUNTRIES`; sign-up `PLACES` (world list since the 24 Nov merge, `PLACE_HOME` = India fallback); country sets phone code, currency, timezone, date format, data region and tax-id label (comment above `WORKSPACE_TYPES`, line ~27,898) |
| Workspace time zone | `wsDay`, `wsDayStart`, `wsFmt`, `SU_TIMEZONES`, `WS_TZ_*`; business days and SLA hours computed in the workspace zone (`OONTU_AGENCY_READY_REPORT.md` §5 "Dates and time zones"); `time-zone.spec.js` |
| Currencies | `SU_CURRENCIES`, `NC_CURRENCIES`, `planCurrency`, plan prices per currency (`BOOSTS.prices`) |
| Legal entities, tax registrations, FY | `company-script`: `legalEntities[].regs[]`, `fy`, `region`, per-company invoice series (`cfFyTag`) |
| Tax packs | GST (`GST_STATES`, `GST_TREATMENTS`), EU VAT (`NC_EU_VAT`), `NC_TAX_TABLE`, `CL_PACKS` |
| Settings | `WSX` + `sGet`/`sSet` (single scope) |
| Language | English only; no i18n layer |
| Data residency | `dataRegion` field set from the country at sign-up; nothing enforces it |

## 2. Current implementation

Strong on time zones (one rule for business days, calendar-day arithmetic, interviews stored as instants) and on multi-entity tax structure for India. Weak on configuration scope, language and residency.

## 3. Limitations

1. One configuration scope; entity- or country-specific values are stored as ad-hoc fields (`legalEntities[i].fy`, `branch.country`).
2. No localisation framework; copy is inline English.
3. `dataRegion` is informational.
4. Working calendars and public holidays are not modelled (business days skip weekends only, per the APS business-hours logic).
5. Employment and tax rules are partly embedded in workflows (GST logic inside client billing).

## 4. Proposed solution

### 4.1 Identity hierarchy
`OrganizationGroup (optional) → Organization (tenant) → LegalEntity → BusinessUnit / Department / Branch`; `Workspace` = tenant at first (one workspace per tenant). A user has many memberships (02).

### 4.2 Configuration scopes and precedence (only where justified)

| Scope | Justified for | Examples |
|---|---|---|
| Platform default | everything | stage names, default SLAs, consent rules |
| Regional default (country pack) | legal and cultural defaults | currency, date format, week start, holidays, tax pack, pay-transparency rule, consent wording, data region |
| Organisation | business policy | approval presets, vendor policy, join policy, terminology |
| Legal entity | legal and fiscal | FY, tax registrations, invoice series, currency of invoices, entity holidays |
| Department / branch | operational routing | HR partner, approval route, working calendar of a site |
| User preference | presentation | language, time-zone display, notification channels |

Not used: workspace scope separate from organisation (1:1 today), team scope (teams drive data scope, not settings).

Resolution: `value = user ?? department ?? entity ?? organisation ?? region ?? platform`, but only for keys declared at that scope (a key declares its allowed scopes). Every change creates a new **version** with actor, reason and time (today's `sSet` already audits and offers Undo); records that depend on policy store the version they used (offers already freeze the terms version; generalise this).

### 4.3 Country packs as data
`CountryPack { iso, version, currency, dateFormat, weekStart, holidaysCalendarId, taxPackId, payTransparency, consentTemplateId, dataRegion, phoneRules }`. GST, VAT and future packs are `TaxPack` data plus a small evaluation engine. No country rule inside a recruitment workflow; workflows ask the pack.

### 4.4 Calendars
`WorkingCalendar { id, scope, weekdays, hours, holidays[] }` used by APS SLAs, interview scheduling and contract timesheets.

### 4.5 Localisation
Externalise UI strings to message catalogues; English first, with locale-aware number, date and currency formatting already partly in place (`wsFmt`, `toLocaleString('en-IN')` calls must become locale-driven).

### 4.6 Data residency
Region-pinned deployments (for example India, EU, US) with the tenant's `dataRegion` chosen at provisioning and immutable without a migration project. Platform metadata (tenant registry, billing) may be global; candidate data stays in-region.

### 4.7 Retention and consent
`RetentionPolicy { scope: region|org, recordType, keepDays, action: delete|anonymise }`; consent records per purpose (submission to a client/buyer, marketing, talent pool), with the existing consent rules (48 h links, limits) as the default policy.

## 5. Data impact

`config_values (key, scope_type, scope_id, value, version)`, `country_packs`, `tax_packs`, `working_calendars`, `retention_policies`, `consents`. `WSX` maps to organisation-scope keys.

## 6. Permissions

`settings.*` stays (`SETTINGS_SECTIONS` + `sCan`); entity- and department-scope settings require scope-matching admin rights.

## 7. Dependencies

07 (configuration service), 10 (country pack applied at provisioning), 16 (residency, retention).

## 8. Acceptance criteria

- A German entity of an Indian group invoices in EUR with its own FY and VAT pack, with no code change.
- An SLA skips a site's public holiday.
- Changing an approval preset does not alter jobs already in approval.
- A UK tenant's candidate data never leaves the EU/UK region store.

## 9. Tests

Precedence resolution per key; versioning; country-pack switching; time-zone suite (`time-zone.spec.js`) ported to the server.

## 10. Migration risks

Existing ad-hoc fields need a one-time mapping into scoped keys; keep read shims until every reader uses the resolver.
