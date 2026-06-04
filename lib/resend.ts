import { Resend } from "resend";

let resendClient: Resend | null = null;

export function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

export function getEmailFromAddress() {
  return process.env.RESEND_FROM || "The Valluru <onboarding@resend.dev>";
}
