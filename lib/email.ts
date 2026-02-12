import nodemailer from 'nodemailer';
import path from 'path';
import { getUserEmailsWithPermission } from './permissions';

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
  type: 'personal' | 'support' | 'reimbursement';
  amount: number;
  date: string;
  purpose?: string;
  requestId: string;
}

interface CashAdvanceLevelApprovalEmailData {
  requesterName: string;
  requesterEmail: string;
  type: 'personal' | 'support' | 'reimbursement';
  amount: number;
  date: string;
  purpose?: string;
  requestId: string;
  level: 'level1' | 'level2';
  previousApprover?: string;
  previousApprovalDate?: string;
}

interface CashAdvanceStatusEmailData {
  requesterName: string;
  requesterEmail: string;
  type: 'personal' | 'support' | 'reimbursement';
  amount: number;
  date: string;
  purpose?: string;
  requestId: string;
  status: 'approved' | 'rejected';
  rejectedAtLevel?: 'level1' | 'level2';
  reviewerName?: string;
  reviewerComment?: string;
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

  const typeLabel = data.type === 'personal' ? 'Personal' : data.type === 'support' ? 'Support' : 'Reimbursement';

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
                          <span style="display: inline-block; padding: 6px 14px; background-color: ${data.type === 'personal' ? '#dbeafe' : data.type === 'support' ? '#dcfce7' : '#ede9fe'}; color: ${data.type === 'personal' ? '#1d4ed8' : data.type === 'support' ? '#166534' : '#7c3aed'}; font-size: 13px; font-weight: 600; border-radius: 20px;">
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

  // Get all users with manage_cash_flow permission
  const recipientEmails = await getUserEmailsWithPermission('manage_cash_flow');

  if (recipientEmails.length === 0) {
    console.error('No users found with manage_cash_flow permission');
    return { success: false, error: 'No recipients found' };
  }

  const mailOptions = {
    from: `"CervenTech HR Portal" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '),
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
    console.log(`Cash advance request email sent successfully to ${recipientEmails.length} recipient(s)`);
    return { success: true };
  } catch (error) {
    console.error('Error sending cash advance email:', error);
    return { success: false, error };
  }
}

/**
 * Send email notification to Level 1 approvers when a new cash advance request is submitted
 */
export async function sendCashAdvanceLevel1Email(data: CashAdvanceLevelApprovalEmailData) {
  const formattedAmount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(data.amount);

  const formattedDate = new Date(data.date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const typeLabel = data.type === 'personal' ? 'Personal' : data.type === 'support' ? 'Support' : 'Reimbursement';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cash Advance - Level 1 Approval Required</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #f59e0b 0%, #eab308 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="cid:cerventech-logo" alt="CervenTech" style="height: 45px; width: auto; display: block;" />
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="display: inline-block; padding: 8px 16px; background-color: #fef3c7; color: #b45309; font-size: 12px; font-weight: 600; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Level 1 Review
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 24px;">
              <h1 style="margin: 0 0 8px; color: #111827; font-size: 26px; font-weight: 700;">
                Level 1 Approval Required
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.5;">
                A new cash advance request requires your Level 1 approval.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px 24px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Requested</p>
                          <p style="margin: 0; color: #111827; font-size: 32px; font-weight: 700;">${formattedAmount}</p>
                        </td>
                        <td style="text-align: right; vertical-align: bottom;">
                          <span style="display: inline-block; padding: 6px 14px; background-color: ${data.type === 'personal' ? '#dbeafe' : data.type === 'support' ? '#dcfce7' : '#ede9fe'}; color: ${data.type === 'personal' ? '#1d4ed8' : data.type === 'support' ? '#166534' : '#7c3aed'}; font-size: 13px; font-weight: 600; border-radius: 20px;">
                            ${typeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
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
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="https://erp.cerventech.com/dashboard/admin/cash-flow-requests" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                Review Request
              </a>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 13px;">
                Click the button above to review and approve/reject this request
              </p>
            </td>
          </tr>
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

  // Get all users with approve_cash_advance_level1 permission
  const recipientEmails = await getUserEmailsWithPermission('approve_cash_advance_level1');

  if (recipientEmails.length === 0) {
    console.error('No users found with approve_cash_advance_level1 permission');
    return { success: false, error: 'No Level 1 approvers found' };
  }

  const mailOptions = {
    from: `"CervenTech HR Portal" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '),
    subject: `[Level 1 Approval] Cash Advance Request - ${data.requesterName} - ${formattedAmount}`,
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
    console.log(`Cash advance Level 1 email sent successfully to ${recipientEmails.length} recipient(s)`);
    return { success: true };
  } catch (error) {
    console.error('Error sending cash advance Level 1 email:', error);
    return { success: false, error };
  }
}

/**
 * Send email notification to Level 2 approvers when Level 1 is approved
 */
export async function sendCashAdvanceLevel2Email(data: CashAdvanceLevelApprovalEmailData) {
  const formattedAmount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(data.amount);

  const formattedDate = new Date(data.date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const typeLabel = data.type === 'personal' ? 'Personal' : data.type === 'support' ? 'Support' : 'Reimbursement';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cash Advance - Level 2 Approval Required</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="cid:cerventech-logo" alt="CervenTech" style="height: 45px; width: auto; display: block;" />
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="display: inline-block; padding: 8px 16px; background-color: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 600; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Level 2 Review
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 24px;">
              <h1 style="margin: 0 0 8px; color: #111827; font-size: 26px; font-weight: 700;">
                Level 2 Approval Required
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.5;">
                A cash advance request has passed Level 1 approval and requires your final review.
              </p>
            </td>
          </tr>
          <!-- Level 1 Approval Info -->
          ${data.previousApprover ? `
          <tr>
            <td style="padding: 0 40px 16px;">
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">
                  ✓ Level 1 Approved by <strong>${data.previousApprover}</strong>
                  ${data.previousApprovalDate ? ` on ${new Date(data.previousApprovalDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px 24px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Requested</p>
                          <p style="margin: 0; color: #111827; font-size: 32px; font-weight: 700;">${formattedAmount}</p>
                        </td>
                        <td style="text-align: right; vertical-align: bottom;">
                          <span style="display: inline-block; padding: 6px 14px; background-color: ${data.type === 'personal' ? '#dbeafe' : data.type === 'support' ? '#dcfce7' : '#ede9fe'}; color: ${data.type === 'personal' ? '#1d4ed8' : data.type === 'support' ? '#166534' : '#7c3aed'}; font-size: 13px; font-weight: 600; border-radius: 20px;">
                            ${typeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
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
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="https://erp.cerventech.com/dashboard/admin/cash-flow-requests" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                Review Request
              </a>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 13px;">
                Click the button above to give final approval or reject this request
              </p>
            </td>
          </tr>
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

  // Get all users with approve_cash_advance_level2 permission
  const recipientEmails = await getUserEmailsWithPermission('approve_cash_advance_level2');

  if (recipientEmails.length === 0) {
    console.error('No users found with approve_cash_advance_level2 permission');
    return { success: false, error: 'No Level 2 approvers found' };
  }

  const mailOptions = {
    from: `"CervenTech HR Portal" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '),
    subject: `[Level 2 Approval] Cash Advance Request - ${data.requesterName} - ${formattedAmount}`,
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
    console.log(`Cash advance Level 2 email sent successfully to ${recipientEmails.length} recipient(s)`);
    return { success: true };
  } catch (error) {
    console.error('Error sending cash advance Level 2 email:', error);
    return { success: false, error };
  }
}

/**
 * Send email notification to the requester about the final status of their cash advance
 */
interface LiquidationSubmittedEmailData {
  requesterName: string;
  requesterEmail: string;
  cashAdvanceAmount: number;
  totalExpenses: number;
  returnToCompany: number;
  reimbursement: number;
  liquidationDate: string;
  storeName?: string;
  ticketReference?: string;
  requestId: string;
}

/**
 * Send email notification to Level 1 approvers when a new liquidation is submitted
 */
export async function sendLiquidationSubmittedEmail(data: LiquidationSubmittedEmailData) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);

  const formattedDate = new Date(data.liquidationDate).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Liquidation Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%);"></td>
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
                    <span style="display: inline-block; padding: 8px 16px; background-color: #ede9fe; color: #7c3aed; font-size: 12px; font-weight: 600; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Approval Required
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
                Liquidation Request Submitted
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.5;">
                A new liquidation has been submitted and requires your review.
              </p>
            </td>
          </tr>

          <!-- Request Details Card -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <!-- Amount Summary -->
                <tr>
                  <td style="padding: 24px 24px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="width: 50%; padding-right: 12px;">
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Cash Advance</p>
                          <p style="margin: 0; color: #111827; font-size: 24px; font-weight: 700;">${formatCurrency(data.cashAdvanceAmount)}</p>
                        </td>
                        <td style="width: 50%; padding-left: 12px; border-left: 1px solid #e2e8f0;">
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total Expenses</p>
                          <p style="margin: 0; color: #111827; font-size: 24px; font-weight: 700;">${formatCurrency(data.totalExpenses)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Balance Info -->
                <tr>
                  <td style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        ${data.returnToCompany > 0 ? `
                        <td style="text-align: center;">
                          <span style="display: inline-block; padding: 8px 16px; background-color: #dcfce7; color: #166534; font-size: 14px; font-weight: 600; border-radius: 8px;">
                            Return to Company: ${formatCurrency(data.returnToCompany)}
                          </span>
                        </td>
                        ` : ''}
                        ${data.reimbursement > 0 ? `
                        <td style="text-align: center;">
                          <span style="display: inline-block; padding: 8px 16px; background-color: #fef3c7; color: #b45309; font-size: 14px; font-weight: 600; border-radius: 8px;">
                            Reimbursement: ${formatCurrency(data.reimbursement)}
                          </span>
                        </td>
                        ` : ''}
                        ${data.returnToCompany === 0 && data.reimbursement === 0 ? `
                        <td style="text-align: center;">
                          <span style="display: inline-block; padding: 8px 16px; background-color: #dbeafe; color: #1d4ed8; font-size: 14px; font-weight: 600; border-radius: 8px;">
                            Exact Amount Used
                          </span>
                        </td>
                        ` : ''}
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
                              <td style="color: #6b7280; font-size: 14px;">Submitted By</td>
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
                        <td style="padding: 10px 0;${data.storeName || data.ticketReference ? ' border-bottom: 1px solid #e2e8f0;' : ''}">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Liquidation Date</td>
                              <td style="color: #111827; font-size: 14px; text-align: right;">${formattedDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${data.storeName ? `
                      <tr>
                        <td style="padding: 10px 0;${data.ticketReference ? ' border-bottom: 1px solid #e2e8f0;' : ''}">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Store</td>
                              <td style="color: #111827; font-size: 14px; text-align: right;">${data.storeName}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                      ${data.ticketReference ? `
                      <tr>
                        <td style="padding: 10px 0;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Related Ticket</td>
                              <td style="color: #111827; font-size: 14px; text-align: right;">${data.ticketReference}</td>
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
              <a href="https://erp.cerventech.com/dashboard/admin/liquidation-requests" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);">
                Review Liquidation
              </a>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 13px;">
                Click the button above to review and process this liquidation
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

  // Get all users with approve_liquidations_level1 permission
  const recipientEmails = await getUserEmailsWithPermission('approve_liquidations_level1');

  if (recipientEmails.length === 0) {
    console.error('No users found with approve_liquidations_level1 permission');
    return { success: false, error: 'No Level 1 approvers found' };
  }

  const mailOptions = {
    from: `"CervenTech HR Portal" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '),
    subject: `Liquidation Request - ${data.requesterName} - ${formatCurrency(data.totalExpenses)}`,
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
    console.log(`Liquidation submitted email sent successfully to ${recipientEmails.length} recipient(s)`);
    return { success: true };
  } catch (error) {
    console.error('Error sending liquidation submitted email:', error);
    return { success: false, error };
  }
}

export async function sendCashAdvanceStatusEmail(data: CashAdvanceStatusEmailData) {
  const formattedAmount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(data.amount);

  const formattedDate = new Date(data.date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const typeLabel = data.type === 'personal' ? 'Personal' : data.type === 'support' ? 'Support' : 'Reimbursement';
  const isApproved = data.status === 'approved';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cash Advance Request ${isApproved ? 'Approved' : 'Rejected'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="height: 6px; background: ${isApproved ? 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)' : 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'};"></td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="cid:cerventech-logo" alt="CervenTech" style="height: 45px; width: auto; display: block;" />
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="display: inline-block; padding: 8px 16px; background-color: ${isApproved ? '#dcfce7' : '#fef2f2'}; color: ${isApproved ? '#166534' : '#dc2626'}; font-size: 12px; font-weight: 600; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${isApproved ? 'Approved' : 'Rejected'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 24px;">
              <h1 style="margin: 0 0 8px; color: #111827; font-size: 26px; font-weight: 700;">
                Cash Advance ${isApproved ? 'Approved' : 'Rejected'}
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.5;">
                ${isApproved
                  ? 'Great news! Your cash advance request has been fully approved.'
                  : `Your cash advance request has been rejected${data.rejectedAtLevel ? ` at ${data.rejectedAtLevel === 'level1' ? 'Level 1' : 'Level 2'}` : ''}.`}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px 24px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount ${isApproved ? 'Approved' : 'Requested'}</p>
                          <p style="margin: 0; color: ${isApproved ? '#16a34a' : '#111827'}; font-size: 32px; font-weight: 700;">${formattedAmount}</p>
                        </td>
                        <td style="text-align: right; vertical-align: bottom;">
                          <span style="display: inline-block; padding: 6px 14px; background-color: ${data.type === 'personal' ? '#dbeafe' : data.type === 'support' ? '#dcfce7' : '#ede9fe'}; color: ${data.type === 'personal' ? '#1d4ed8' : data.type === 'support' ? '#166534' : '#7c3aed'}; font-size: 13px; font-weight: 600; border-radius: 20px;">
                            ${typeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Date Requested</td>
                              <td style="color: #111827; font-size: 14px; text-align: right;">${formattedDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${data.reviewerName ? `
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">${isApproved ? 'Final Approver' : 'Reviewed By'}</td>
                              <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.reviewerName}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                      ${data.purpose ? `
                      <tr>
                        <td style="padding: 10px 0;${data.reviewerComment ? ' border-bottom: 1px solid #e2e8f0;' : ''}">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px; vertical-align: top;">Purpose</td>
                              <td style="color: #111827; font-size: 14px; text-align: right; max-width: 280px;">${data.purpose}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                      ${data.reviewerComment ? `
                      <tr>
                        <td style="padding: 10px 0;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px; vertical-align: top;">Reviewer Comment</td>
                              <td style="color: #111827; font-size: 14px; text-align: right; max-width: 280px; font-style: italic;">"${data.reviewerComment}"</td>
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
          ${isApproved ? `
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; text-align: center;">
                  ✓ Your request has been fully approved. Please coordinate with HR/Finance for the release of funds.
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="https://erp.cerventech.com/dashboard/employee" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: ${isApproved ? '#16a34a' : '#6b7280'}; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                View Dashboard
              </a>
            </td>
          </tr>
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
    to: data.requesterEmail,
    subject: `Cash Advance ${isApproved ? 'Approved' : 'Rejected'} - ${formattedAmount}`,
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
    console.log(`Cash advance status email sent successfully to ${data.requesterEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending cash advance status email:', error);
    return { success: false, error };
  }
}

// ============================================================================
// LIQUIDATION TWO-LEVEL APPROVAL EMAILS
// ============================================================================

interface LiquidationLevel1ApprovedEmailData {
  requesterName: string;
  level1ApproverName: string;
  cashAdvanceAmount: number;
  totalExpenses: number;
  liquidationDate: string;
  requestId: string;
}

/**
 * Send email notification to Level 2 approvers when a liquidation is approved at Level 1
 */
export async function sendLiquidationLevel1ApprovedEmail(data: LiquidationLevel1ApprovedEmailData) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);

  const formattedDate = new Date(data.liquidationDate).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liquidation Approved at Level 1 - Needs Final Approval</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 30px;">
              <img src="cid:cerventech-logo" alt="CervenTech Logo" style="height: 50px; margin-bottom: 30px;">
              <h1 style="margin: 0 0 10px; color: #1e293b; font-size: 28px; font-weight: 700;">Level 1 Approved</h1>
              <p style="margin: 0; color: #64748b; font-size: 16px;">Final approval needed for liquidation request</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <p style="margin: 0 0 10px; color: #ffffff; font-size: 14px; opacity: 0.9;">Employee</p>
                <p style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${data.requesterName}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Liquidation Date</span>
                    <p style="margin: 5px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Cash Advance</span>
                    <p style="margin: 5px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${formatCurrency(data.cashAdvanceAmount)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Total Expenses</span>
                    <p style="margin: 5px 0 0; color: #f59e0b; font-size: 18px; font-weight: 700;">${formatCurrency(data.totalExpenses)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0;">
                    <span style="color: #64748b; font-size: 14px;">Level 1 Approved By</span>
                    <p style="margin: 5px 0 0; color: #10b981; font-size: 16px; font-weight: 600;">✓ ${data.level1ApproverName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 25px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Final Approval Required</strong><br>
                  This liquidation has been approved at Level 1 and now requires your final approval (Level 2).
                </p>
              </div>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/liquidation-requests"
                 style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                Review & Approve
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                This is an automated notification from CervenTech HR Portal. Please log in to review and take action on this liquidation request.
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

  // Get all users with approve_liquidations_level2 permission
  const recipientEmails = await getUserEmailsWithPermission('approve_liquidations_level2');

  if (recipientEmails.length === 0) {
    console.error('No users found with approve_liquidations_level2 permission');
    return { success: false, error: 'No Level 2 approvers found' };
  }

  const mailOptions = {
    from: `"CervenTech HR Portal" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '),
    subject: `🔔 Level 1 Approved - Final Approval Needed | ${data.requesterName} - ${formatCurrency(data.totalExpenses)}`,
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
    console.log(`Liquidation Level 1 approved email sent successfully to ${recipientEmails.length} Level 2 approver(s)`);
    return { success: true };
  } catch (error) {
    console.error('Error sending liquidation Level 1 approved email:', error);
    return { success: false, error };
  }
}

interface LiquidationStatusEmailData {
  requesterName: string;
  requesterEmail: string;
  status: 'approved' | 'rejected';
  level: 1 | 2;
  reviewerName: string;
  reviewerComment?: string;
  cashAdvanceAmount: number;
  totalExpenses: number;
  liquidationDate: string;
}

/**
 * Send email notification to requester when their liquidation is approved or rejected at any level
 */
export async function sendLiquidationStatusEmail(data: LiquidationStatusEmailData) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);

  const formattedDate = new Date(data.liquidationDate).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isApproved = data.status === 'approved';
  const isFinalApproval = data.level === 2 && isApproved;
  const levelText = data.level === 1 ? 'Level 1' : 'Level 2 (Final)';
  const statusText = isApproved ? 'Approved' : 'Rejected';
  const statusColor = isApproved ? '#10b981' : '#ef4444';
  const statusIcon = isApproved ? '✓' : '✕';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liquidation ${statusText} at ${levelText}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="height: 6px; background-color: ${statusColor};"></td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 30px;">
              <img src="cid:cerventech-logo" alt="CervenTech Logo" style="height: 50px; margin-bottom: 30px;">
              <h1 style="margin: 0 0 10px; color: ${statusColor}; font-size: 28px; font-weight: 700;">${statusIcon} ${statusText} at ${levelText}</h1>
              <p style="margin: 0; color: #64748b; font-size: 16px;">Your liquidation request status update</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Liquidation Date</span>
                    <p style="margin: 5px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Total Expenses</span>
                    <p style="margin: 5px 0 0; color: #f59e0b; font-size: 18px; font-weight: 700;">${formatCurrency(data.totalExpenses)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Reviewed By</span>
                    <p style="margin: 5px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${data.reviewerName}</p>
                  </td>
                </tr>
                ${data.reviewerComment ? `
                <tr>
                  <td style="padding: 15px 0;">
                    <span style="color: #64748b; font-size: 14px;">Reviewer Comment</span>
                    <p style="margin: 5px 0 0; color: #1e293b; font-size: 14px; line-height: 1.6; font-style: italic; background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 3px solid ${statusColor};">"${data.reviewerComment}"</p>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              ${isFinalApproval ? `
              <div style="background-color: #dcfce7; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin-bottom: 25px;">
                <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">
                  <strong>🎉 Fully Approved!</strong><br>
                  Your liquidation has been fully approved. The process is now complete.
                </p>
              </div>
              ` : isApproved && data.level === 1 ? `
              <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin-bottom: 25px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                  <strong>📋 Next Step</strong><br>
                  Your liquidation has been approved at Level 1. It now awaits final approval (Level 2).
                </p>
              </div>
              ` : `
              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin-bottom: 25px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  <strong>❌ Rejected</strong><br>
                  Your liquidation has been rejected at ${levelText}. Please review the comment above and contact your approver if you have questions.
                </p>
              </div>
              `}
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/employee"
                 style="display: inline-block; padding: 14px 32px; background-color: ${statusColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View My Liquidations
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                This is an automated notification from CervenTech HR Portal.
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

  const mailOptions = {
    from: `"CervenTech HR Portal" <${process.env.EMAIL_USER}>`,
    to: data.requesterEmail,
    subject: `Liquidation ${statusText} at ${levelText} - ${formatCurrency(data.totalExpenses)}`,
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
    console.log(`Liquidation status email sent successfully to ${data.requesterEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending liquidation status email:', error);
    return { success: false, error };
  }
}
