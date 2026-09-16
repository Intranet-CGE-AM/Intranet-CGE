import { lookup } from "node:dns/promises";
import nodemailer from "nodemailer";

type VisitMailInput = {
  to?: string;
  email?: string;
  visitorEmail?: string;
  visitorName?: string;
  name?: string;
  protocol?: string;
  subject?: string;
  reason?: string;
  purpose?: string;
  scheduledDate?: string | Date;
  visitDate?: string | Date;
  date?: string | Date;
  startTime?: string;
  endTime?: string;
  roomName?: string | null;
  room?: string | null;
  location?: string | null;
  organization?: string | null;
  hostName?: string | null;
  requestedBy?: string | null;
  confirmationUrl?: string;
  [key: string]: unknown;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variável de ambiente não configurada: ${name}`);
  }

  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function normalizePassword(value: string): string {
  return value.replace(/\s+/g, "");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: unknown): string {
  if (!value) {
    return "Não informada";
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      dateStyle: "short",
    }).format(value);
  }

  const text = String(value);
  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    dateStyle: "short",
  }).format(parsed);
}

function formatTimeRange(startTime?: string, endTime?: string): string {
  const start = startTime?.trim();
  const end = endTime?.trim();

  if (start && end) {
    return `${start} às ${end}`;
  }

  if (start) {
    return start;
  }

  if (end) {
    return end;
  }

  return "Não informado";
}

async function createSmtpTransporter() {
  const smtpHost = optionalEnv("SMTP_HOST", "smtp.gmail.com");
  const smtpPort = Number(optionalEnv("SMTP_PORT", "465"));
  const smtpSecure = optionalEnv("SMTP_SECURE", "true").toLowerCase() === "true";
  const smtpUser = requiredEnv("SMTP_USER");
  const smtpPass = normalizePassword(requiredEnv("SMTP_PASS"));

  const ipv4 = await lookup(smtpHost, {
    family: 4,
  });

  return nodemailer.createTransport({
    host: ipv4.address,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      servername: smtpHost,
      rejectUnauthorized: true,
    },
  });
}

function buildVisitScheduledMail(input: VisitMailInput) {
  const visitorName = String(input.visitorName ?? input.name ?? "Visitante");
  const protocol = String(input.protocol ?? "Não informado");
  const subject = String(input.subject ?? input.reason ?? input.purpose ?? "Visita institucional");
  const scheduledDate = formatDate(input.scheduledDate ?? input.visitDate ?? input.date);
  const timeRange = formatTimeRange(input.startTime, input.endTime);
  const room = String(input.roomName ?? input.room ?? input.location ?? "Não informada");
  const organization = String(input.organization ?? "Não informada");
  const hostName = String(input.hostName ?? "Equipe CGE");
  const requestedBy = String(input.requestedBy ?? "Assessoria/Controladoria");

  const mailSubject = `[Intranet CGE] Visita agendada - ${protocol}`;

  const text = `
Olá, ${visitorName}.

Sua visita foi agendada no sistema da Intranet CGE.

Protocolo: ${protocol}
Motivo: ${subject}
Data: ${scheduledDate}
Horário: ${timeRange}
Sala/Local: ${room}
Órgão/Instituição: ${organization}
Responsável interno: ${hostName}
Agendada por: ${requestedBy}

Esta mensagem é apenas um aviso de agendamento.

Atenciosamente,
Controladoria Geral do Estado do Amazonas - CGE
`.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2>Visita agendada - Intranet CGE</h2>

      <p>Olá, <strong>${escapeHtml(visitorName)}</strong>.</p>

      <p>Sua visita foi agendada no sistema da <strong>Intranet CGE</strong>.</p>

      <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Protocolo</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(protocol)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Motivo</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(subject)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Data</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(scheduledDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Horário</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(timeRange)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Sala/Local</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(room)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Órgão/Instituição</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(organization)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Responsável interno</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(hostName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Agendada por</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(requestedBy)}</td>
        </tr>
      </table>

      <p style="margin-top: 16px;">
        Esta mensagem é apenas um aviso de agendamento.
      </p>

      <p style="margin-top: 24px;">
        Atenciosamente,<br />
        <strong>Controladoria Geral do Estado do Amazonas - CGE</strong>
      </p>
    </div>
  `.trim();

  return {
    subject: mailSubject,
    text,
    html,
  };
}

export async function sendVisitScheduledMail(input: VisitMailInput) {
  const to = String(input.to ?? input.visitorEmail ?? input.email ?? "").trim();

  if (!to) {
    throw new Error("E-mail do visitante não informado.");
  }

  const smtpUser = requiredEnv("SMTP_USER");
  const from = process.env.SMTP_FROM?.trim() || smtpUser;
  const transporter = await createSmtpTransporter();
  const mail = buildVisitScheduledMail(input);

  return transporter.sendMail({
    from,
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

export async function sendVisitConfirmationMail(input: VisitMailInput) {
  return sendVisitScheduledMail(input);
}

export function buildConfirmationUrl(token: string): string {
  const publicWebUrl = optionalEnv("PUBLIC_WEB_URL", "http://localhost:5173").replace(/\/$/, "");

  return `${publicWebUrl}/visitas/confirmar/${token}`;
}
