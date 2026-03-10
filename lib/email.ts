import nodemailer from 'nodemailer';
import { db } from '@/lib/database';
import { security } from '@/lib/security';
import logger from '@/lib/logger';

export async function getSmtpSettings() {
  // Try to get settings from database first, fall back to environment variables
  try {
    const settings = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key LIKE 'smtp_%'
    `);

    const settingsObj: any = {};
    for (const row of settings as any[]) {
      settingsObj[row.setting_key] = row.setting_value;
    }

    // If we have database settings, use them
    if (settingsObj.smtp_host && settingsObj.smtp_user && settingsObj.smtp_pass) {
      return {
        smtp_host: settingsObj.smtp_host,
        smtp_port: parseInt(settingsObj.smtp_port || '587'),
        smtp_secure: settingsObj.smtp_secure === '1',
        smtp_user: settingsObj.smtp_user,
        smtp_password: settingsObj.smtp_pass,
        from_email: settingsObj.smtp_from || settingsObj.smtp_user,
        from_name: 'IND Appointments',
        base_url: process.env.BASE_URL || 'http://localhost:3000'
      };
    }
  } catch (error) {
    logger.info('[EMAIL] Database settings not found, falling back to environment variables');
  }

  // Fall back to environment variables
  return {
    smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtp_port: parseInt(process.env.SMTP_PORT || '587'),
    smtp_secure: process.env.SMTP_SECURE === 'true',
    smtp_user: process.env.SMTP_USER || '',
    smtp_password: process.env.SMTP_PASSWORD || '',
    from_email: process.env.FROM_EMAIL || 'noreply@indappointments.com',
    from_name: process.env.FROM_NAME || 'IND Appointments',
    base_url: process.env.BASE_URL || 'http://localhost:3000'
  };
}

async function createTransporter() {
  const settings = await getSmtpSettings();

  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_secure,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_password
    }
  });
}

export interface NewAppointmentsEmailData {
  userEmail: string;
  userName: string;
  appointments: Array<{
    date: string;
    startTime: string;
    endTime: string;
    appointmentType: string;
    location: string;
  }>;
  appointmentType: string;
  location: string;
  preferenceId: number;
}

export async function sendNewAppointmentsEmail(data: NewAppointmentsEmailData) {
  try {
    const transporter = await createTransporter();
    const settings = await getSmtpSettings();

    const appointmentsList = data.appointments
      .slice(0, 10) // Show first 10
      .map(appt => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${appt.date}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${appt.startTime} - ${appt.endTime}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${appt.location}</td>
        </tr>
      `).join('');

    const totalCount = data.appointments.length;
    const moreText = totalCount > 10 ? `<p style="color: #6b7280; margin-top: 16px;">And ${totalCount - 10} more appointments...</p>` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>New IND Appointments Available</title>
        <style type="text/css">
          @media only screen and (max-width: 600px) {
            .content-wrapper { padding: 10px !important; }
            .header-title { font-size: 20px !important; padding: 20px 16px !important; }
            .main-content { padding: 20px 16px !important; }
            .cta-button { padding: 12px 24px !important; font-size: 16px !important; }
            .table-wrapper { font-size: 13px !important; }
            .table-wrapper th, .table-wrapper td { padding: 8px 6px !important; }
          }
        </style>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <div class="content-wrapper" style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div class="header-title" style="background-color: #2563eb; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">New IND Appointments Available!</h1>
            </div>

            <div class="main-content" style="padding: 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Hello <strong>${data.userName}</strong>,
              </p>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                We found <strong>${totalCount} new appointment${totalCount > 1 ? 's' : ''}</strong> for <strong>${data.appointmentType}</strong> at <strong>${data.location}</strong>:
              </p>

              <div class="table-wrapper" style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 24px;">
                <table style="width: 100%; min-width: 280px; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f3f4f6;">
                      <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 14px; border-bottom: 2px solid #e5e7eb;">Date</th>
                      <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 14px; border-bottom: 2px solid #e5e7eb;">Time</th>
                      <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 14px; border-bottom: 2px solid #e5e7eb;">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${appointmentsList}
                  </tbody>
                </table>
              </div>

              ${moreText}

              <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; margin-top: 24px; border-radius: 4px;">
                <h3 style="color: #1e40af; margin-top: 0; margin-bottom: 12px; font-size: 16px; font-weight: 600;">📋 How to Book an Appointment</h3>
                <ol style="color: #1e3a8a; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Click "View All Appointments" button below</li>
                  <li style="margin-bottom: 8px;">Find the appointment you want and click "Book Now"</li>
                  <li style="margin-bottom: 8px;">Follow the step-by-step booking helper that opens</li>
                  <li style="margin-bottom: 8px;">Navigate to the appointment date using the arrow buttons</li>
                  <li style="margin-bottom: 8px;">Click the time slot to book your appointment</li>
                  <li>Complete the booking on the IND website</li>
                </ol>
                <p style="color: #1e40af; font-size: 14px; margin-top: 12px; margin-bottom: 0;">
                  <strong>⚠️ Important:</strong> Book quickly! Appointments fill up fast.
                </p>
              </div>

              <div style="text-align: center; margin-top: 32px;">
                <a class="cta-button" href="${settings.base_url}/" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3); mso-padding-alt: 14px 36px; mso-text-raise: 0;">
                  🔍 View All Appointments
                </a>
              </div>

              <div style="text-align: center; margin-top: 32px; padding: 20px; background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px;">
                <p style="color: #991b1b; font-size: 16px; font-weight: 700; margin: 0 0 8px 0;">
                  ❌ Don't want these notifications anymore?
                </p>
                <a href="${settings.base_url}/api/preferences/unsubscribe?token=${security.generateSignedToken({ preferenceId: data.preferenceId, email: data.userEmail }, '30d')}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 16px; margin-top: 8px; mso-padding-alt: 12px 28px;">
                  🔕 Unsubscribe from This Alert
                </a>
                <p style="color: #7f1d1d; font-size: 12px; margin: 12px 0 0 0;">
                  Or <a href="${settings.base_url}/preferences" style="color: #991b1b; text-decoration: underline;">manage all your notification preferences</a>
                </p>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5;">
                You are receiving this email because you subscribed to IND appointment notifications.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${settings.from_name} <${settings.from_email}>`,
      to: data.userEmail,
      subject: `${totalCount} New IND Appointment${totalCount > 1 ? 's' : ''} Available - ${data.appointmentType}`,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${data.userEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending email', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendVerificationEmail(userEmail: string, userName: string, verificationToken: string) {
  try {
    const transporter = await createTransporter();
    const settings = await getSmtpSettings();

    const verificationUrl = `${settings.base_url}/api/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Verify Your Email Address</title>
        <style type="text/css">
          @media only screen and (max-width: 600px) {
            .content-wrapper { padding: 10px !important; }
            .header-title { font-size: 20px !important; padding: 20px 16px !important; }
            .main-content { padding: 20px 16px !important; }
            .cta-button { padding: 14px 24px !important; font-size: 16px !important; }
          }
        </style>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <div class="content-wrapper" style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div class="header-title" style="background-color: #2563eb; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✉️ Verify Your Email Address</h1>
            </div>

            <div class="main-content" style="padding: 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Hello <strong>${userName}</strong>,
              </p>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Thank you for signing up for IND Appointments Tracker! To start receiving notifications about available IND appointments, please verify your email address.
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
                  ⚠️ You won't be able to create notification preferences until your email is verified.
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a class="cta-button" href="${verificationUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); mso-padding-alt: 16px 40px; mso-text-raise: 0;">
                  ✅ Verify Email Address
                </a>
              </div>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 24px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="color: #2563eb; font-size: 13px; word-break: break-all; margin: 0; font-family: 'Courier New', monospace;">
                  ${verificationUrl}
                </p>
              </div>

              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-top: 24px; border-radius: 4px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
                  🔒 Security Notice
                </p>
                <p style="color: #7f1d1d; font-size: 13px; margin: 8px 0 0 0;">
                  If you didn't create an account with IND Appointments, you can safely ignore this email.
                </p>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5;">
                This verification link will expire in 24 hours.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${settings.from_name} <${settings.from_email}>`,
      to: userEmail,
      subject: 'Verify Your Email - IND Appointments',
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to ${userEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending verification email', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendWelcomeEmail(userEmail: string, userName: string) {
  try {
    const transporter = await createTransporter();
    const settings = await getSmtpSettings();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Welcome to IND Appointments</title>
        <style type="text/css">
          @media only screen and (max-width: 600px) {
            .content-wrapper { padding: 10px !important; }
            .header-title { font-size: 20px !important; padding: 20px 16px !important; }
            .main-content { padding: 20px 16px !important; }
            .cta-button { padding: 12px 24px !important; font-size: 15px !important; }
          }
        </style>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <div class="content-wrapper" style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div class="header-title" style="background-color: #2563eb; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Welcome to IND Appointments!</h1>
            </div>

            <div class="main-content" style="padding: 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Hello <strong>${userName}</strong>,
              </p>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Welcome to IND Appointments Tracker! We'll help you find available IND appointments and notify you when new slots become available.
              </p>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="margin-top: 0; margin-bottom: 12px; color: #1f2937; font-size: 18px; font-weight: 600;">What's Next?</h3>
                <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">Set up your notification preferences</li>
                  <li style="margin-bottom: 8px;">Choose appointment types you're interested in</li>
                  <li style="margin-bottom: 8px;">Select your preferred IND office locations</li>
                  <li>We'll notify you when new appointments appear!</li>
                </ul>
              </div>

              <div style="text-align: center; margin-top: 32px;">
                <a class="cta-button" href="${settings.base_url}/preferences" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3); mso-padding-alt: 14px 32px; mso-text-raise: 0;">
                  Set Up Preferences
                </a>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${settings.from_name} <${settings.from_email}>`,
      to: userEmail,
      subject: 'Welcome to IND Appointments Tracker!',
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${userEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending welcome email', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendPasswordResetEmail(userEmail: string, userName: string, resetToken: string) {
  try {
    const transporter = await createTransporter();
    const settings = await getSmtpSettings();

    const resetUrl = `${settings.base_url}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Reset Your Password</title>
        <style type="text/css">
          @media only screen and (max-width: 600px) {
            .content-wrapper { padding: 10px !important; }
            .header-title { font-size: 20px !important; padding: 20px 16px !important; }
            .main-content { padding: 20px 16px !important; }
            .cta-button { padding: 14px 24px !important; font-size: 16px !important; }
          }
        </style>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <div class="content-wrapper" style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div class="header-title" style="background-color: #2563eb; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Reset Your Password</h1>
            </div>

            <div class="main-content" style="padding: 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Hello <strong>${userName}</strong>,
              </p>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                We received a request to reset your password for your IND Appointments account. Click the button below to create a new password:
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a class="cta-button" href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3); mso-padding-alt: 16px 40px; mso-text-raise: 0;">
                  Reset Password
                </a>
              </div>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 24px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="color: #2563eb; font-size: 13px; word-break: break-all; margin: 0; font-family: 'Courier New', monospace;">
                  ${resetUrl}
                </p>
              </div>

              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-top: 24px; border-radius: 4px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
                  Security Notice
                </p>
                <p style="color: #7f1d1d; font-size: 13px; margin: 8px 0 0 0;">
                  If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
                </p>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5;">
                This password reset link will expire in 1 hour.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${settings.from_name} <${settings.from_email}>`,
      to: userEmail,
      subject: 'Reset Your Password - IND Appointments',
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${userEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending password reset email', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendEmailChangeVerificationEmail(newEmail: string, userName: string, verificationToken: string) {
  try {
    const transporter = await createTransporter();
    const settings = await getSmtpSettings();

    const verifyUrl = `${settings.base_url}/api/verify-email-change?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Email Change</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background-color: #2563eb; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Verify Your New Email</h1>
            </div>

            <div style="padding: 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Hello <strong>${userName}</strong>,
              </p>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                You requested to change your email address for your IND Appointments account. To complete this change, please verify this new email address by clicking the button below:
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                  Verify New Email
                </a>
              </div>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 24px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="color: #2563eb; font-size: 13px; word-break: break-all; margin: 0; font-family: 'Courier New', monospace;">
                  ${verifyUrl}
                </p>
              </div>

              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-top: 24px; border-radius: 4px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
                  Security Notice
                </p>
                <p style="color: #7f1d1d; font-size: 13px; margin: 8px 0 0 0;">
                  If you didn't request this email change, please ignore this email. Your current email address will remain unchanged.
                </p>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This verification link will expire in 24 hours.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${settings.from_name} <${settings.from_email}>`,
      to: newEmail,
      subject: 'Verify Your New Email Address - IND Appointments',
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email change verification sent to ${newEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending email change verification', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendEmailChangeNotificationEmail(oldEmail: string, userName: string, newEmail: string) {
  try {
    const transporter = await createTransporter();
    const settings = await getSmtpSettings();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Change Request</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background-color: #f59e0b; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">⚠️ Email Change Request</h1>
            </div>

            <div style="padding: 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Hello <strong>${userName}</strong>,
              </p>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                We're writing to let you know that a request was made to change the email address for your IND Appointments account.
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400e; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
                  Current email: ${oldEmail}
                </p>
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
                  New email: ${newEmail}
                </p>
              </div>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                A verification email has been sent to the new email address. The change will only be completed if the new email is verified within 24 hours.
              </p>

              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin-top: 24px; border-radius: 4px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
                  Didn't request this?
                </p>
                <p style="color: #7f1d1d; font-size: 13px; margin: 8px 0 0 0;">
                  If you didn't initiate this email change, your account may be compromised. Please change your password immediately and contact support.
                </p>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This is a security notification from IND Appointments.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${settings.from_name} <${settings.from_email}>`,
      to: oldEmail,
      subject: 'Email Change Request - IND Appointments',
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email change notification sent to ${oldEmail}`, { messageId: result.messageId });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending email change notification', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendEmailChangeConfirmationEmail(newEmail: string, oldEmail: string) {
  try {
    const transporter = await createTransporter();
    const settings = await getSmtpSettings();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Changed Successfully</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background-color: #10b981; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">✅ Email Changed Successfully</h1>
            </div>

            <div style="padding: 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Your email address has been successfully updated for your IND Appointments account.
              </p>

              <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #065f46; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
                  Previous email: ${oldEmail}
                </p>
                <p style="color: #065f46; font-size: 14px; margin: 0; font-weight: 600;">
                  New email: ${newEmail}
                </p>
              </div>

              <p style="font-size: 16px; margin: 0 0 24px 0;">
                You can now log in using your new email address. All future notifications will be sent to this email.
              </p>

              <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; margin-top: 24px; border-radius: 4px;">
                <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: 600;">
                  📝 Important Reminder
                </p>
                <p style="color: #1e3a8a; font-size: 13px; margin: 8px 0 0 0;">
                  Use <strong>${newEmail}</strong> when logging in from now on.
                </p>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Thank you for using IND Appointments.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${settings.from_name} <${settings.from_email}>`,
      to: newEmail,
      subject: 'Email Changed Successfully - IND Appointments',
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email change confirmation sent to ${newEmail}`, { messageId: result.messageId });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending email change confirmation', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
