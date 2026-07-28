# Define security and delivery constraints

Type: grilling
Status: resolved
Blocked by: 02

## Question

Which identity, authorization, audit, deployment, and delivery constraints define v1?

## Answer

V1 uses locally provisioned password accounts without MFA, secure revocable database sessions, a fixed permission catalog grouped into editable roles, and role assignments scoped globally or to an organizational unit. The API is the authorization boundary. Security, people, import, role, and vacation changes are auditable and exportable. The application runs on one internal Docker Compose host. Coherent validated commits are pushed directly to `main` without force-pushes.

## Comments

Resolved with the product owner during initial Wayfinder grilling.
