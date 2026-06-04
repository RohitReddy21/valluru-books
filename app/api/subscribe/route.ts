import { NextRequest, NextResponse } from "next/server";
import { getMongoDb, hasMongoConfig } from "@/lib/mongodb";
import { getEmailFromAddress, getResend, hasResendConfig } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    email?: string;
    source?: string;
    bookletSlug?: string;
    bookletTitle?: string;
  };
  const email = payload.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  if (!hasMongoConfig()) {
    return NextResponse.json(
      { error: "MONGODB_URI is required to store subscribers." },
      { status: 500 }
    );
  }

  const db = await getMongoDb();
  await db.collection("subscribers").updateOne(
    { email },
    {
      $set: {
        email,
        lastSource: payload.source || "newsletter",
        lastBookletSlug: payload.bookletSlug || null,
        lastBookletTitle: payload.bookletTitle || null,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  if (hasResendConfig()) {
    const resend = getResend();
    const from = getEmailFromAddress();
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const bookletLine = payload.bookletTitle
      ? `<p>Requested booklet: <strong>${payload.bookletTitle}</strong></p>`
      : "";

    await resend.emails.send({
      from,
      to: email,
      subject: "The Inward Fire Letter",
      html: `
        <div style="font-family: Georgia, serif; line-height: 1.7; color: #1a1815;">
          <p>Thank you for subscribing to The Inward Fire Letter.</p>
          ${bookletLine}
          <p>You will hear from us quietly.</p>
        </div>
      `
    });

    if (adminEmail) {
      await resend.emails.send({
        from,
        to: adminEmail,
        subject: "New Valluru subscriber",
        html: `
          <div style="font-family: Georgia, serif; line-height: 1.7; color: #1a1815;">
            <p>New subscriber: <strong>${email}</strong></p>
            <p>Source: ${payload.source || "newsletter"}</p>
            ${bookletLine}
          </div>
        `
      });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("valluru_subscribed", "true", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  if (payload.bookletSlug) {
    response.cookies.set(`valluru_booklet_${payload.bookletSlug}`, "true", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  return response;
}
