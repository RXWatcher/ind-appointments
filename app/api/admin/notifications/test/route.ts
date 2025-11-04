import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyAuth } from '@/lib/security';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { provider, testEmail } = await request.json();

    // Get settings from database
    const settings = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key LIKE ?
    `, [`${provider}_%`]);

    const settingsObj: any = {};
    for (const row of settings as any[]) {
      settingsObj[row.setting_key] = row.setting_value;
    }

    if (provider === 'smtp') {
      return await testSMTP(settingsObj, testEmail);
    } else if (provider === 'pushover') {
      return await testPushover(settingsObj);
    } else if (provider === 'whatsapp') {
      return await testWhatsApp(settingsObj);
    }

    return NextResponse.json(
      { success: false, message: 'Unknown provider' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error testing notification:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function testSMTP(settings: any, testEmail: string): Promise<NextResponse> {
  try {
    if (!settings.smtp_host || !settings.smtp_port || !settings.smtp_user || !settings.smtp_pass) {
      return NextResponse.json({
        success: false,
        message: 'SMTP settings are incomplete. Please fill in all required fields.'
      });
    }

    if (!testEmail) {
      return NextResponse.json({
        success: false,
        message: 'Test email address is required'
      });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port),
      secure: settings.smtp_secure === '1', // true for 465, false for other ports
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: settings.smtp_from || settings.smtp_user,
      to: testEmail,
      subject: 'IND Appointments - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Test Email Successful</h2>
          <p>Your SMTP configuration is working correctly!</p>
          <p>This is a test email from the IND Appointments notification system.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            If you received this email, your email notifications are configured properly.
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`
    });
  } catch (error) {
    console.error('SMTP test error:', error);
    return NextResponse.json({
      success: false,
      message: `SMTP test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function testPushover(settings: any): Promise<NextResponse> {
  try {
    if (!settings.pushover_user_key || !settings.pushover_api_token) {
      return NextResponse.json({
        success: false,
        message: 'Pushover settings are incomplete. Please fill in all required fields.'
      });
    }

    // Send test push notification via Pushover API
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: settings.pushover_api_token,
        user: settings.pushover_user_key,
        message: 'Your Pushover configuration is working correctly! This is a test notification from the IND Appointments system.',
        title: 'IND Appointments - Test Notification',
      }),
    });

    const data = await response.json();

    if (response.ok && data.status === 1) {
      return NextResponse.json({
        success: true,
        message: 'Test push notification sent successfully via Pushover'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Pushover test failed: ${data.errors ? data.errors.join(', ') : 'Unknown error'}`
      });
    }
  } catch (error) {
    console.error('Pushover test error:', error);
    return NextResponse.json({
      success: false,
      message: `Pushover test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function testWhatsApp(settings: any): Promise<NextResponse> {
  try {
    if (!settings.whatsapp_access_token || !settings.whatsapp_phone_number_id) {
      return NextResponse.json({
        success: false,
        message: 'WhatsApp settings are incomplete. Please configure Access Token and Phone Number ID.'
      });
    }

    // For testing, we need a test phone number
    // We'll use a hardcoded test number or the admin should provide one
    const testPhoneNumber = '+15550123456'; // This should be replaced with actual test number

    const apiUrl = `https://graph.facebook.com/v18.0/${settings.whatsapp_phone_number_id}/messages`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsapp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: testPhoneNumber,
        type: 'text',
        text: {
          body: 'Your WhatsApp configuration is working correctly! This is a test message from the IND Appointments system.'
        }
      }),
    });

    const data = await response.json();

    if (response.ok && data.messages) {
      return NextResponse.json({
        success: true,
        message: `Test WhatsApp message sent successfully to ${testPhoneNumber}`
      });
    } else {
      const errorMessage = data.error?.message || JSON.stringify(data);
      return NextResponse.json({
        success: false,
        message: `WhatsApp test failed: ${errorMessage}`
      });
    }
  } catch (error) {
    console.error('WhatsApp test error:', error);
    return NextResponse.json({
      success: false,
      message: `WhatsApp test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}
