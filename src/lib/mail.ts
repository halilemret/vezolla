import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

export const DEFAULT_EMAIL_TEMPLATES: Array<{
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
}> = [
  {
    key: "order_placed",
    name: "Sipariş Alındı",
    subject: "Siparişiniz alındı (#{{orderNumber}})",
    bodyHtml: `<div style="font-family:sans-serif;color:#18181b;line-height:1.6">
  <h2>Merhaba {{customerName}},</h2>
  <p><strong>#{{orderNumber}}</strong> numaralı siparişinizi aldık.</p>
  <p>Toplam tutar: <strong>{{orderTotal}}</strong> ({{paymentMethod}})</p>
  <p>Sipariş durumunuzu <a href="{{orderUrl}}">sipariş takip sayfasından</a> izleyebilirsiniz.</p>
</div>`,
  },
  {
    key: "order_shipped",
    name: "Sipariş Kargoya Verildi",
    subject: "Siparişiniz kargoya verildi (#{{orderNumber}})",
    bodyHtml: `<div style="font-family:sans-serif;color:#18181b;line-height:1.6">
  <h2>Merhaba {{customerName}},</h2>
  <p><strong>#{{orderNumber}}</strong> numaralı siparişiniz <strong>{{carrier}}</strong> ile kargoya verildi.</p>
  <p>Kargo takip numarası: <strong>{{trackingNumber}}</strong></p>
</div>`,
  },
  {
    key: "back_in_stock",
    name: "Ürün Tekrar Stokta",
    subject: "Beklediğiniz ürün tekrar stokta: {{productTitle}}",
    bodyHtml: `<div style="font-family:sans-serif;color:#18181b;line-height:1.6">
  <h2>{{productTitle}} tekrar stokta</h2>
  <p>Haber vermemizi istediğiniz ürün yeniden satışa açıldı.</p>
  <p><a href="{{productUrl}}">Ürünü incelemek için tıklayın</a></p>
</div>`,
  },
  {
    key: "abandoned_cart",
    name: "Terk Edilmiş Sepet Hatırlatması",
    subject: "Sepetinizde ürünler kaldı! {{discountNote}}",
    bodyHtml: `<div style="font-family:sans-serif;color:#18181b;line-height:1.6">
  <h2>Merhaba {{customerName}},</h2>
  <p>Alışverişinizi tamamlamadığınızı fark ettik. Sepetinizdeki ürünler tükenmeden sepetinizi tamamlayabilirsiniz.</p>
  <div style="background:#f4f4f5;padding:16px;border-radius:6px;margin:16px 0">
    <p style="margin:0 0 8px 0;font-weight:600">Sepetinizdeki Ürünler:</p>
    <div>{{itemsListHtml}}</div>
    <p style="margin:12px 0 0 0;font-weight:600">Toplam: {{cartTotal}}</p>
  </div>
  {{discountBlockHtml}}
  <p style="margin-top:24px">
    <a href="{{restoreUrl}}" style="background:#18181b;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500">
      Sepetime Geri Dön ve Tamamla
    </a>
  </p>
</div>`,
  },
];

export function renderTemplateString(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}

export async function sendTransactionalEmail(options: {
  to: string;
  templateKey?: string;
  subject?: string;
  html?: string;
  variables?: Record<string, string>;
}): Promise<string> {
  const vars = options.variables ?? {};
  let subject = options.subject ?? "Bilgilendirme";
  let html = options.html ?? "";

  if (options.templateKey) {
    let tpl = await db.emailTemplate.findUnique({ where: { key: options.templateKey } });
    if (!tpl) {
      const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === options.templateKey);
      if (def) {
        tpl = await db.emailTemplate.create({ data: def });
      }
    }
    if (tpl && !tpl.isActive) {
      return "";
    }
    if (tpl) {
      subject = renderTemplateString(tpl.subject, vars);
      html = renderTemplateString(tpl.bodyHtml, vars);
    }
  } else {
    subject = renderTemplateString(subject, vars);
    html = renderTemplateString(html, vars);
  }

  const msg = await db.emailMessage.create({
    data: {
      to: options.to,
      subject,
      html,
      templateKey: options.templateKey ?? null,
      status: "QUEUED",
    },
  });

  const smtpHost = process.env.SMTP_HOST?.trim();
  if (!smtpHost) {
    await db.emailMessage.update({
      where: { id: msg.id },
      data: {
        status: "LOGGED",
        sentAt: new Date(),
      },
    });
    return msg.id;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ?? "",
          }
        : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "magaza@localhost",
      to: options.to,
      subject,
      html,
    });

    await db.emailMessage.update({
      where: { id: msg.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.emailMessage.update({
      where: { id: msg.id },
      data: { status: "FAILED", error },
    });
  }

  return msg.id;
}
