function subscriptionSourceTag(source) {
  if (source === "booklet-reader" || source === "ads-landing") {
    return source;
  }

  return "newsletter";
}

function registerSubscriptionRoutes(
  app,
  {
    requireMongo,
    getDb,
    getResend,
    getResendFrom,
    getAdminNotificationEmail,
    buildSubscriberEmail,
    buildOwnerEmail,
    sendResendEmail,
    cookieOptions,
    createAccessToken
  }
) {
  app.post("/api/subscribe", async (request, response, next) => {
    try {
      // Check if MongoDB is available
      let hasMongo = true;
      try {
        if (getDb) {
          await getDb();
        } else {
          hasMongo = false;
        }
      } catch {
          hasMongo = false;
      }
      
      // If no MongoDB, just return success for local dev
      if (!hasMongo) {
        const email = String(request.body?.email || "").trim().toLowerCase();
        const name = String(request.body?.name || "").trim();
        const bookletSlug = String(request.body.bookletSlug || "").trim();
        
        console.log("[subscribe] Local dev mode - MongoDB not available, returning success");
        
        if (bookletSlug) {
          response.cookie(`valluru_booklet_${bookletSlug}`, "true", cookieOptions(request));
        }
        
        return response.json({
          ok: true,
          emailDelivery: {
            subscriber: "skipped_local",
            owner: "skipped_local"
          },
          accessToken: bookletSlug ? createAccessToken(bookletSlug) : undefined
        });
      }

      // Original MongoDB logic
      if (!requireMongo(response)) {
        return;
      }

      const email = String(request.body?.email || "").trim().toLowerCase();
      const name = String(request.body?.name || "").trim();
      const bookletSlug = String(request.body.bookletSlug || "").trim();
      const bookletTitle = String(request.body?.bookletTitle || "").trim() || null;
      const source = String(request.body?.source || "newsletter").trim() || "newsletter";

      if (!name) {
        response.status(400).json({ error: "Name is required." });
        return;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        response.status(400).json({ error: "A valid email is required." });
        return;
      }

      const db = await getDb();
      const subscribedAt = new Date();
      const subscriberUpdate = {
        $set: {
          email,
          name,
          lastSource: source,
          lastBookletSlug: bookletSlug || null,
          lastBookletTitle: bookletTitle,
          updatedAt: subscribedAt
        },
        $setOnInsert: { createdAt: subscribedAt }
      };

      if (bookletSlug) {
        subscriberUpdate.$addToSet = {
          subscribedBooklets: bookletSlug
        };
      }

      const subscriberResult = await db.collection("subscribers").updateOne({ email }, subscriberUpdate, {
        upsert: true
      });
      const isNewSubscriber = subscriberResult.upsertedCount > 0;

      if (bookletSlug) {
        await db.collection("booklet_readers").updateOne(
          { email, bookletSlug },
          {
            $set: {
              email,
              name,
              bookletSlug,
              bookletTitle,
              source,
              updatedAt: new Date(),
              lastReadAt: new Date()
            },
            $inc: {
              readCount: 1
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        // We only use booklet_readers now, so no need to write to booklet_unlocks
      }

      const resend = getResend();
      const from = getResendFrom();
      const adminEmail = getAdminNotificationEmail();
      const replyTo = String(process.env.REPLY_TO_EMAIL || adminEmail || "").trim();
      const emailDelivery = {
        subscriber: { status: "not_configured" },
        owner: { status: "not_configured" }
      };

      console.log(
        `[email] Subscribe email flow started — resend=${Boolean(resend)}, from=${from}, adminEmail=${
          adminEmail || "NOT SET"
        }, replyTo=${replyTo || "NOT SET"}`
      );

      if (!resend) {
        console.error(
          "[email] RESEND_API_KEY is missing or still contains a placeholder. Subscription was saved, but emails were not sent."
        );
      } else {
        const subscriberEmail = buildSubscriberEmail({ name, bookletTitle });
        const deliveries = [
          sendResendEmail(resend, "subscriber confirmation", {
            from,
            to: email,
            ...(replyTo ? { replyTo } : {}),
            subject: subscriberEmail.subject,
            html: subscriberEmail.html,
            text: subscriberEmail.text,
            tags: [
              { name: "email_type", value: "subscriber_confirmation" },
              { name: "source", value: subscriptionSourceTag(source) }
            ]
          }).then((result) => {
            emailDelivery.subscriber = result;
            if (result.status !== "sent") {
              console.error(`[email] Subscriber confirmation to ${email} FAILED:`, result.error);
            }
          })
        ];

        if (adminEmail) {
          const ownerEmail = buildOwnerEmail({
            name,
            email,
            source,
            bookletTitle,
            subscribedAt,
            isNewSubscriber
          });

          console.log(`[email] Sending owner notification to ${adminEmail}...`);

          deliveries.push(
            sendResendEmail(resend, "owner notification", {
              from,
              to: adminEmail,
              replyTo: email,
              subject: ownerEmail.subject,
              html: ownerEmail.html,
              text: ownerEmail.text,
              tags: [
                { name: "email_type", value: "owner_notification" },
                { name: "source", value: subscriptionSourceTag(source) }
              ]
            }).then((result) => {
              emailDelivery.owner = result;
              if (result.status !== "sent") {
                console.error(`[email] Owner notification to ${adminEmail} FAILED:`, result.error);
              } else {
                console.log(`[email] Owner notification to ${adminEmail} sent successfully (id: ${result.id})`);
              }
            })
          );
        } else {
          console.error(
            `[email] ADMIN_NOTIFICATION_EMAIL is missing, invalid, or still a placeholder. Current raw value: "${
              process.env.ADMIN_NOTIFICATION_EMAIL || ""
            }". Owner notification was SKIPPED.`
          );
          emailDelivery.owner = { status: "skipped", error: "ADMIN_NOTIFICATION_EMAIL not configured" };
        }

        await Promise.all(deliveries);

        console.log(
          `[email] Delivery results — subscriber: ${emailDelivery.subscriber.status}, owner: ${emailDelivery.owner.status}`
        );
      }

      await db.collection("subscribers").updateOne(
        { email },
        {
          $set: {
            lastEmailDelivery: emailDelivery,
            lastEmailAttemptAt: new Date()
          }
        }
      );

      if (bookletSlug) {
        response.cookie(`valluru_booklet_${bookletSlug}`, "true", cookieOptions(request));
      }

      response.json({
        ok: true,
        emailDelivery: {
          subscriber: emailDelivery.subscriber.status,
          owner: emailDelivery.owner.status
        },
        accessToken: bookletSlug ? createAccessToken(bookletSlug) : undefined
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  registerSubscriptionRoutes
};
