import nodemailer from 'nodemailer';
import path from 'path';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

interface CashAdvanceEmailData {
  requesterName: string;
  requesterEmail: string;
  type: 'personal' | 'support';
  amount: number;
  date: string;
  purpose?: string;
  requestId: string;
}

export async function sendCashAdvanceRequestEmail(data: CashAdvanceEmailData) {
  const formattedAmount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(data.amount);

  const formattedDate = new Date(data.date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const typeLabel = data.type === 'personal' ? 'Personal' : 'Support';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cash Advance Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #dc2626 0%, #2563eb 50%, #16a34a 100%);"></td>
          </tr>

          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="cid:cerventech-logo" alt="CervenTech" style="height: 45px; width: auto; display: block;" />
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="display: inline-block; padding: 8px 16px; background-color: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 600; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Action Required
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title Section -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <h1 style="margin: 0 0 8px; color: #111827; font-size: 26px; font-weight: 700;">
                Cash Advance Request
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.5;">
                A new request has been submitted and requires your review.
              </p>
            </td>
          </tr>

          <!-- Request Details Card -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <!-- Amount Highlight -->
                <tr>
                  <td style="padding: 24px 24px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Requested</p>
                          <p style="margin: 0; color: #111827; font-size: 32px; font-weight: 700;">${formattedAmount}</p>
                        </td>
                        <td style="text-align: right; vertical-align: bottom;">
                          <span style="display: inline-block; padding: 6px 14px; background-color: ${data.type === 'personal' ? '#dbeafe' : '#dcfce7'}; color: ${data.type === 'personal' ? '#1d4ed8' : '#166534'}; font-size: 13px; font-weight: 600; border-radius: 20px;">
                            ${typeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Details -->
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Requested By</td>
                              <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.requesterName}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Email</td>
                              <td style="color: #111827; font-size: 14px; text-align: right;">${data.requesterEmail}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;${data.purpose ? ' border-bottom: 1px solid #e2e8f0;' : ''}">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Date Requested</td>
                              <td style="color: #111827; font-size: 14px; text-align: right;">${formattedDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${data.purpose ? `
                      <tr>
                        <td style="padding: 10px 0;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px; vertical-align: top;">Purpose</td>
                              <td style="color: #111827; font-size: 14px; text-align: right; max-width: 280px;">${data.purpose}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Section -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="https://erp.cerventech.com/dashboard/admin/cash-flow-requests" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                Review Request
              </a>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 13px;">
                Click the button above to review and process this request
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 6px; color: #9ca3af; font-size: 12px;">
                      This is an automated notification from CervenTech HR Portal
                    </p>
                    <p style="margin: 0; color: #d1d5db; font-size: 11px;">
                      Request ID: ${data.requestId}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const mailOptions = {
    from: `"CervenTech HR Portal" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_RECIPIENT || 'zrv.valles@gmail.com',
    subject: `Cash Advance Request - ${typeLabel} - ${formattedAmount}`,
    html: htmlContent,
    attachments: [
      {
        filename: 'logo.png',
        path: path.join(process.cwd(), 'public', 'logo.png'),
        cid: 'cerventech-logo',
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Cash advance request email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending cash advance email:', error);
    return { success: false, error };
  }
}
