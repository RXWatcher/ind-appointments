import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id || !email) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Unsubscribe Link</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc2626; font-size: 20px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="error">❌ Invalid unsubscribe link</div>
          <p>The unsubscribe link is invalid or has expired.</p>
          <a href="/" style="color: #2563eb;">Go to Homepage</a>
        </body>
        </html>
        `,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Get the preference to verify it belongs to this user
    const preference = await db.query(`
      SELECT np.id, u.email
      FROM notification_preferences np
      JOIN users u ON np.user_id = u.id
      WHERE np.id = ?
    `, [id]);

    if (!preference || preference.length === 0 || (preference[0] as any).email !== email) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribe Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc2626; font-size: 20px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="error">❌ Unsubscribe failed</div>
          <p>We couldn't find this notification preference or it doesn't belong to your account.</p>
          <a href="/preferences" style="color: #2563eb;">Manage Your Preferences</a>
        </body>
        </html>
        `,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Deactivate the preference
    await db.query(`
      UPDATE notification_preferences
      SET is_active = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed Successfully</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background: linear-gradient(to bottom right, #eff6ff, #ffffff, #eff6ff);
            min-height: 100vh;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .success {
            color: #16a34a;
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 20px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          p {
            color: #4b5563;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          a {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-weight: 600;
            margin: 10px;
            transition: background-color 0.2s;
          }
          a:hover {
            background-color: #1d4ed8;
          }
          .secondary {
            background-color: #6b7280;
          }
          .secondary:hover {
            background-color: #4b5563;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <div class="success">Successfully Unsubscribed!</div>
          <p>
            You will no longer receive notifications for this alert preference.
            <br><br>
            Your other alert preferences (if any) remain active.
          </p>
          <div>
            <a href="/preferences">Manage All Preferences</a>
            <a href="/" class="secondary">Go to Homepage</a>
          </div>
        </div>
      </body>
      </html>
      `,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { color: #dc2626; font-size: 20px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="error">❌ An error occurred</div>
        <p>We encountered an error while processing your unsubscribe request. Please try again later.</p>
        <a href="/" style="color: #2563eb;">Go to Homepage</a>
      </body>
      </html>
      `,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
