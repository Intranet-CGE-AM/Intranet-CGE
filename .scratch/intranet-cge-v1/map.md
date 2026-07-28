# Intranet CGE v1

## Destination

An implementation-ready and deployed-on-main v1 specification and application for the CGE internal network: a modular React/Vite and Fastify/PostgreSQL monorepo with shared UI, secure local access, and an HR module for people, birthdays, and vacation approvals.

## Notes

- Specifications and code use English; product copy and Brazilian HR terms use PT-BR.
- Deploy as a modular monolith on one internal Docker Compose host.
- Keep replaceable integration seams narrow. Do not build a runtime plugin system.
- Use `/grilling`, `/domain-modeling`, `/research`, and `/frontend-design` when the relevant ticket calls for them.
- Delivery is part of this map: validated, coherent commits are pushed directly to `main`.

## Decisions so far

- [Define the v1 product boundary](issues/01-define-v1-product-boundary.md) — HR is the only v1 business module; payroll, benefits, documents, communications, events, and IT service management remain outside the destination.
- [Define people and employment language](issues/02-define-people-and-employment-language.md) — people, employment relationships, and login accounts have independent lifecycles.
- [Define security and delivery constraints](issues/03-define-security-and-delivery-constraints.md) — local password accounts, database sessions, scoped roles, auditability, and direct validated delivery to `main`.
- [Define the shared visual system](issues/04-define-shared-visual-system.md) — a restrained institutional dashboard using customized, self-owned primitives derived from the supplied reference.
- [Validate official policy constraints](issues/05-validate-official-policy-constraints.md) — minimize personal data, default birthday publication to private pending DPO confirmation, and keep final vacation authority assignable.

## Not yet specified

- CGE-specific vacation deadlines, delegation rules, and records-retention periods require validation with the client.
- Future modules will be prioritized after HR v1 is running; their detailed requirements are intentionally still in the fog.

## Out of scope

- Payroll, benefits, accrual calculations, absence calendars, and HR document management.
- LDAP, Active Directory, OIDC, MFA, and external HR synchronization in v1.
- Runtime module toggles, third-party plugins, microservices, Kubernetes, and public internet hosting.
- News, document management, system links, events, and IT service desk implementation.
