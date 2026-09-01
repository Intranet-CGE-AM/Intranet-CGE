import nodemailer from "nodemailer";

/* =========================================================
 * TIPOS
 * ======================================================= */

export type VisitConfirmationMailInput = {
  visitorName: string;
  visitorEmail: string;

  protocol: string;
  subject: string;

  scheduledDate: string;

  startTime: string;
  endTime: string;

  location: string;

  confirmationUrl: string;
};

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;

  user: string;
  pass: string;

  from: string;

  publicWebUrl: string;
};

/* =========================================================
 * CONFIGURAÇÃO SMTP
 * ======================================================= */

function getMailConfig(): MailConfig {
  const host =
    process.env.SMTP_HOST?.trim();

  const user =
    process.env.SMTP_USER?.trim();

  const pass =
    process.env.SMTP_PASS
      ?.replace(/\s+/g, "")
      .trim();

  const from =
    process.env.SMTP_FROM?.trim();

  const publicWebUrl =
    process.env.PUBLIC_WEB_URL
      ?.trim()
      .replace(/\/$/, "");

  const port =
    Number(
      process.env.SMTP_PORT ??
        "587",
    );

  const secure =
    process.env.SMTP_SECURE ===
    "true";

  if (!host) {
    throw new Error(
      "SMTP_HOST não configurado.",
    );
  }

  if (!user) {
    throw new Error(
      "SMTP_USER não configurado.",
    );
  }

  if (!pass) {
    throw new Error(
      "SMTP_PASS não configurado.",
    );
  }

  if (!from) {
    throw new Error(
      "SMTP_FROM não configurado.",
    );
  }

  if (!publicWebUrl) {
    throw new Error(
      "PUBLIC_WEB_URL não configurado.",
    );
  }

  if (
    !Number.isInteger(port) ||
    port <= 0
  ) {
    throw new Error(
      "SMTP_PORT inválido.",
    );
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    publicWebUrl,
  };
}

/* =========================================================
 * TRANSPORTER
 * ======================================================= */

function createTransporter() {
  const config =
    getMailConfig();

  return nodemailer.createTransport({
    host:
      config.host,

    port:
      config.port,

    secure:
      config.secure,

    /*
     * Porta 587:
     *
     * secure = false
     * requireTLS = true
     *
     * A conexão inicia normal e é promovida para TLS.
     */
    requireTLS:
      !config.secure,

    auth: {
      user:
        config.user,

      pass:
        config.pass,
    },
  });
}

/* =========================================================
 * TESTE SMTP
 * ======================================================= */

export async function verifyMailConnection() {
  const transporter =
    createTransporter();

  await transporter.verify();

  return true;
}

/* =========================================================
 * GERAR LINK DE CONFIRMAÇÃO
 * ======================================================= */

export function buildConfirmationUrl(
  token: string,
) {
  const config =
    getMailConfig();

  return (
    `${config.publicWebUrl}` +
    `/confirmar-visita?token=${encodeURIComponent(
      token,
    )}`
  );
}

/* =========================================================
 * ENVIO DO E-MAIL
 * ======================================================= */

export async function sendVisitConfirmationMail(
  input:
    VisitConfirmationMailInput,
) {
  const config =
    getMailConfig();

  const transporter =
    createTransporter();

  const formattedDate =
    formatDate(
      input.scheduledDate,
    );

  const result =
    await transporter.sendMail({
      /*
       * REMETENTE
       */
      from:
        config.from,

      /*
       * DESTINATÁRIO DINÂMICO
       *
       * Este endereço será o e-mail
       * cadastrado no visitante:
       *
       * visit_visitors.email
       */
      to:
        input.visitorEmail,

      subject:
        `Confirmação de visita à CGE-AM - ${input.protocol}`,

      /* ===================================================
       * TEXTO PURO
       * ================================================= */

      text: `
Prezado(a) ${input.visitorName},

Existe uma visita agendada em seu nome junto à Controladoria-Geral do Estado do Amazonas.

Protocolo: ${input.protocol}
Motivo da visita: ${input.subject}
Data: ${formattedDate}
Horário: ${input.startTime} às ${input.endTime}
Local: ${input.location}

Para confirmar sua presença ou informar que não poderá comparecer, acesse:

${input.confirmationUrl}

Atenciosamente,

Controladoria-Geral do Estado do Amazonas
Intranet CGE - Agendamento de Visitas
      `.trim(),

      /* ===================================================
       * HTML
       * ================================================= */

      html: `
<!doctype html>

<html lang="pt-BR">

<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>
    Confirmação de visita à CGE
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f5f8f7;
    font-family:Arial,Helvetica,sans-serif;
    color:#173433;
  "
>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    width:100%;
    background:#f5f8f7;
    padding:32px 12px;
  "
>

<tr>

<td align="center">

<table
  width="620"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    width:100%;
    max-width:620px;
    background:#ffffff;
    border:1px solid #dce9e7;
    border-radius:12px;
  "
>

<!-- CABEÇALHO -->

<tr>

<td
  style="
    padding:24px 28px;
    border-bottom:4px solid #08756f;
  "
>

<div
  style="
    color:#075f5b;
    font-size:21px;
    font-weight:700;
  "
>
  CGE Amazonas
</div>

<div
  style="
    margin-top:5px;
    color:#71817f;
    font-size:11px;
    letter-spacing:1px;
  "
>
  CONTROLADORIA-GERAL DO ESTADO DO AMAZONAS
</div>

</td>

</tr>

<!-- CONTEÚDO -->

<tr>

<td
  style="
    padding:30px 28px;
  "
>

<p
  style="
    margin-top:0;
    font-size:15px;
  "
>
  Prezado(a)
  <strong>
    ${escapeHtml(
      input.visitorName,
    )}
  </strong>,
</p>

<p
  style="
    color:#526765;
    font-size:14px;
    line-height:1.6;
  "
>
  Existe uma visita agendada em seu nome junto à
  Controladoria-Geral do Estado do Amazonas.
  Confira os dados abaixo e confirme sua participação.
</p>

<!-- DADOS -->

<table
  width="100%"
  cellpadding="10"
  cellspacing="0"
  border="0"
  style="
    margin-top:22px;
    background:#f3f8f7;
    border:1px solid #dce9e7;
    border-radius:8px;
  "
>

<tr>
<td>
  <strong>
    Protocolo
  </strong>
</td>

<td>
  ${escapeHtml(
    input.protocol,
  )}
</td>
</tr>

<tr>
<td>
  <strong>
    Motivo
  </strong>
</td>

<td>
  ${escapeHtml(
    input.subject,
  )}
</td>
</tr>

<tr>
<td>
  <strong>
    Data
  </strong>
</td>

<td>
  ${escapeHtml(
    formattedDate,
  )}
</td>
</tr>

<tr>
<td>
  <strong>
    Horário
  </strong>
</td>

<td>
  ${escapeHtml(
    input.startTime,
  )}
  às
  ${escapeHtml(
    input.endTime,
  )}
</td>
</tr>

<tr>
<td>
  <strong>
    Local
  </strong>
</td>

<td>
  ${escapeHtml(
    input.location,
  )}
</td>
</tr>

</table>

<!-- CTA -->

<p
  style="
    margin-top:28px;
    color:#526765;
    font-size:14px;
    line-height:1.6;
  "
>
  Para confirmar sua presença ou informar que não poderá
  comparecer, utilize o botão abaixo.
</p>

<p
  style="
    margin:30px 0;
    text-align:center;
  "
>

<a
  href="${escapeHtml(
    input.confirmationUrl,
  )}"
  style="
    display:inline-block;
    background:#08756f;
    color:#ffffff;
    padding:14px 26px;
    border-radius:8px;
    text-decoration:none;
    font-size:14px;
    font-weight:bold;
  "
>
  RESPONDER AO AGENDAMENTO
</a>

</p>

<p
  style="
    color:#71817f;
    font-size:11px;
    line-height:1.5;
  "
>
  Caso o botão não funcione, copie e cole o endereço
  abaixo no navegador:
</p>

<p
  style="
    color:#08756f;
    font-size:11px;
    line-height:1.5;
    word-break:break-all;
  "
>
  ${escapeHtml(
    input.confirmationUrl,
  )}
</p>

</td>

</tr>

<!-- RODAPÉ -->

<tr>

<td
  style="
    padding:18px 28px;
    border-top:1px solid #dce9e7;
    color:#71817f;
    font-size:11px;
    line-height:1.5;
  "
>

Esta é uma mensagem automática do módulo
Agendamento de Visitas da Intranet CGE-AM.

<br><br>

Controladoria-Geral do Estado do Amazonas.

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>
      `.trim(),
    });

  return {
    messageId:
      result.messageId,

    accepted:
      result.accepted,

    rejected:
      result.rejected,
  };
}

/* =========================================================
 * FORMATAR DATA
 * ======================================================= */

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}

/* =========================================================
 * ESCAPE DE HTML
 * ======================================================= */

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}