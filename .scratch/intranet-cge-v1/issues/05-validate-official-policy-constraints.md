# Validate official policy constraints

Type: research
Status: resolved
Blocked by:

## Question

Which official Brazilian and Amazonas public-sector, LGPD, and eMAG constraints materially affect the v1 directory, birthday reminders, local access control, audit trail, and vacation request workflow?

## Answer

- LGPD requires a documented public purpose and legal basis, data minimization, accuracy, transparency, security, prevention, accountability, and a route for access/correction. The existing CGE privacy channel and DPO contact should be linked instead of duplicated.
- Birthday publication is a separate use of personal data. Until the CGE DPO confirms another lawful basis, birthday visibility defaults to private and a worker must deliberately enable name plus day/month publication. The year and other personnel data are never exposed by the reminder.
- Audit records are personal data too. Store only actor, action, object, time, outcome, and necessary metadata; restrict export and obtain the CGE retention schedule.
- Amazonas Law 1,762/1986 gives covered civil servants 30 annual vacation days after the first year and establishes an annual scale. The application must not calculate entitlement or become the authoritative record.
- CGE's internal rules place vacation-scale tracking with GERH and approval with the Controlador-Geral. The final-decision permission must therefore be assignable rather than hard-coded to an “HR” job title.
- Accessibility remains an acceptance requirement using WCAG 2.2 AA and the interaction/content requirements of eMAG 3.1.

Primary sources:

- [Lei Geral de Proteção de Dados Pessoais](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [ANPD security incident guidance](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)
- [CGE-AM LGPD and DPO channel](https://www.cge.am.gov.br/lgpd/)
- [ANPD guide for data processing by public authorities](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_tratamento_de_dados_pessoais_pelo_poder_publico___defeso_eleitoral.pdf/@@display-file/file)
- [Amazonas Law 1,762/1986](https://legisla.imprensaoficial.am.gov.br/diario_am/12/1986/11/5974)
- [CGE-AM internal regulations, Decree 40,824/2019](https://legisla.imprensaoficial.am.gov.br/diario_am/41538/2019/6/9747)
- [Brazilian Inclusion Law](https://planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm)
- [eMAG 3.1](https://emag.governoeletronico.gov.br/)

## Comments

Client confirmation remains required for the current delegation chain, SEAD rules, covered employment categories, birthday legal basis, retention schedule, and exact eMAG applicability to the internal-only network.
