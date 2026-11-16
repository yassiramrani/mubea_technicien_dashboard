# Technician dashboard: SAP / Bluebird assessment

Scope corrected by the user on 16 November 2026: Anna's messages concern the **Mubea technician dashboard**, also called Workshop Tool Tracking. The local implementation was rejected. The options discussed are to use SAP if it meets the requirements, or develop the solution in Bluebird. The local tool was not recommended in the feedback. The quoted Bluebird estimate of approximately 1–2 days is indicative; requirements coverage and delivery timing remain unverified.

## Process description for the assessment

The current source tracks shared workshop tools: which tool exists, who has it and since when. Its README places PM orders and spare-parts management in the separate Maintenance application. Confirm the PM/Production process boundary with Anna rather than assuming a target SAP module or transaction.

| Existing flow to assess | Evidence required from the proposed solution |
|---|---|
| Identify a tool by its label or QR code | Scan an actual printed label and resolve the correct tool |
| Maintain tool identity and photos | Demonstrate agreed catalogue fields and who may change them |
| Take and return tools | Record the responsible technician, time and current assignment; reject conflicting movements |
| Follow up overdue returns | Show the agreed overdue rule, assigned technician and actionable follow-up list |
| Search and export inventory | Find by tool or technician; reconcile exported availability and assignments |
| Manage profiles and permissions | Confirm technician, identification and administrator responsibilities with the owner |
| Review movements and reports | Demonstrate the required history, retention and visibility |
| Operate the service | Name the owner for access, devices, backups, recovery and monitoring |

For each row, PM, Production and IT should record SAP coverage, configuration/development needs, any Bluebird alternative, demonstration evidence, owner and unresolved gap. No SAP transaction, Bluebird API or migration mapping has been assumed. Agree requirements and target ownership before implementation or target data import.

## Current evidence and next decision

The latest source batch added health endpoints, with 17 tests and the production build passing locally. Those results do not establish platform approval or production acceptance. Existing source, deployment instructions and database configuration are assessment material; no remote data, roles or schema were changed for this correction.

Next: gather Anna's required process information, confirm whether SAP meets it, assess any Bluebird gaps and agree the supported platform, acceptance criteria and schedule. Spare-parts/MRP has separate inventory validation and operating decisions.
