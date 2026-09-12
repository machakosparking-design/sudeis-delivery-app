import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CEO_EMAIL = Deno.env.get("CEO_EMAIL");
const FROM_EMAIL = "Falcon Delivery <notifications@falcondelivery.co.ke>";

serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify the request is from Supabase (basic auth check via webhook secret)
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Supabase DB webhook sends: { type, table, record, old_record, schema }
  const record = (body.record ?? body) as Record<string, unknown>;

  // Only fire for new riders with pending_approval status
  const approvalStatus = record.approval_status as string;
  if (approvalStatus !== "pending_approval") {
    return new Response(
      JSON.stringify({ message: "Not a pending rider, skipping." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const riderName = (record.name as string) || "Unknown";
  const riderPhone = (record.phone as string) || "Not provided";
  const riderGender = (record.gender as string) || "Not provided";
  const riderAge = (record.age as number | null) ?? "Not provided";
  const appliedAt = new Date().toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "full",
    timeStyle: "short",
  });

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY environment variable is not set.");
    return new Response("Server configuration error", { status: 500 });
  }

  if (!CEO_EMAIL) {
    console.error("CEO_EMAIL environment variable is not set.");
    return new Response("Server configuration error", { status: 500 });
  }

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Rider Application</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563EB,#1D4ED8);padding:32px 40px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">🦅</div>
              <h1 style="color:white;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
                New Rider Application
              </h1>
              <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">
                Falcon Delivery — Rider Portal
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#374151;font-size:16px;margin:0 0 24px;line-height:1.6;">
                A new rider has submitted an application and is waiting for your approval.
              </p>

              <!-- Rider Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h2 style="margin:0 0 16px;color:#0369A1;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                      Applicant Details
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#64748B;font-size:14px;width:120px;">Full Name</td>
                        <td style="padding:6px 0;color:#0F172A;font-size:14px;font-weight:700;">${riderName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748B;font-size:14px;">Gender</td>
                        <td style="padding:6px 0;color:#0F172A;font-size:14px;font-weight:600;">${riderGender}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748B;font-size:14px;">Age</td>
                        <td style="padding:6px 0;color:#0F172A;font-size:14px;font-weight:600;">${riderAge}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748B;font-size:14px;">Phone</td>
                        <td style="padding:6px 0;color:#0F172A;font-size:14px;font-weight:600;">${riderPhone}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748B;font-size:14px;">Applied At</td>
                        <td style="padding:6px 0;color:#0F172A;font-size:14px;font-weight:600;">${appliedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a
                      href="https://system.falcondelivery.co.ke"
                      style="display:inline-block;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(37,99,235,0.35);"
                    >
                      Review Application →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#94A3B8;font-size:13px;margin:28px 0 0;text-align:center;line-height:1.6;">
                Log in to the CEO Admin Panel → click <strong>Riders</strong> to approve or reject this application.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
              <p style="color:#94A3B8;font-size:12px;margin:0;">
                © ${new Date().getFullYear()} Falcon Delivery · falcondelivery.co.ke
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [CEO_EMAIL],
        subject: `🦅 New Rider Application — ${riderName}`,
        html: emailHtml,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: result }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", result.id);
    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
