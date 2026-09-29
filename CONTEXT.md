# Domain Glossary

## Person

A human represented in the CGE internal directory, whether or not they can sign in.

## Worker

A Person with a current Employment Relationship to CGE. This umbrella term includes the employment categories maintained by HR.

## Employment Relationship

The time-bounded relationship between a Person and CGE. It identifies the person's employment category, primary Organizational Unit, and Supervisor. A Person has at most one active relationship in v1.

## Employment Category

The HR classification of an Employment Relationship. A category determines whether its workers may use the vacation workflow.

## Organizational Unit

A named part of the CGE organizational structure to which an active Employment Relationship belongs.

## Supervisor

The Worker explicitly responsible for the first decision on another Worker's vacation request.

## User Account

The credentials and access state that allow a Person to sign in. A Person may exist without a User Account.

## Role

A named collection of Permissions administered inside the application.

## Permission

A fixed application capability that can be granted through a Role.

## Role Assignment

A grant of a Role to a User Account, either globally or for one Organizational Unit.

## Vacation Request

A Worker's proposed vacation period. It requires a Supervisor decision followed by an HR decision and does not establish or calculate legal entitlement.

## Audit Event

An immutable record that a security-relevant or business-relevant action occurred.

## Audit Team

An Organizational Unit under the Internal Control Subcontroller's Office (SCI) whose members prepare Audit Documents. Membership is a Role Assignment scoped to that unit.

## Audit Document

A work product of an Audit Team (report, technical note, working paper) submitted to the Reviewer. It has a free-text category and moves through in review, correction requested, approved or cancelled.

## Version

One immutable file of an Audit Document, numbered from 1. A Version is either uploaded or saved from the browser editor, and is sent either by the team or by the Reviewer.

## Correction Round

One request for correction by the Reviewer. A document that reaches the configured number of rounds is flagged as a bottleneck.

## Reviewer

The account holding the audit document review permission for a team, usually the Subcontroller. The Reviewer approves, requests correction, cancels, reopens and may save edited Versions while a document is in review.
