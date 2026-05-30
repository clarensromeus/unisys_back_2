import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendEmailInput) {
    const apiKey = this.config.get<string>('resend.apiKey');
    const from = this.config.get<string>('resend.fromEmail') || 'UNISYS ERP <onboarding@resend.dev>';

    if (!apiKey) {
      this.logger.warn(`RESEND_API_KEY is not configured. Email to ${input.to} was skipped.`);
      return { skipped: true };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;

    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.message === 'string' ? payload.message : 'Resend email delivery failed';
      throw new Error(message);
    }

    return payload;
  }
}
