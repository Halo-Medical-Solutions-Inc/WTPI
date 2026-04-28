import yagmail

from app.config import settings


def _get_yag() -> yagmail.SMTP:
    return yagmail.SMTP(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)


async def send_password_reset_email(email: str, token: str) -> None:
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    subject = f"Reset your password - {settings.FROM_NAME}"

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Reset your password</h2>
                <p>We received a request to reset your password for {settings.FROM_NAME}.</p>
                <p>Click the button below to reset your password:</p>
                <div style="margin: 30px 0;">
                    <a href="{reset_link}" 
                       style="background-color: #2563eb; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="{reset_link}" style="color: #2563eb;">{reset_link}</a>
                </p>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    This link will expire in {settings.PASSWORD_RESET_EXPIRY_HOURS} hour.
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    If you didn't request a password reset, you can safely ignore this email.
                </p>
            </div>
        </body>
    </html>
    """

    text_content = f"""
Reset your password

We received a request to reset your password for {settings.FROM_NAME}.

Click the link below to reset your password:
{reset_link}

This link will expire in {settings.PASSWORD_RESET_EXPIRY_HOURS} hour.

If you didn't request a password reset, you can safely ignore this email.
    """

    try:
        yag = _get_yag()
        yag.send(to=email, subject=subject, contents=[text_content, html_content])
    except Exception as e:
        print(f"Failed to send password reset email: {e}")


async def send_invitation_email(email: str, token: str, role: str) -> None:
    invitation_link = f"{settings.FRONTEND_URL}/accept-invitation?token={token}"

    subject = f"You've been invited to the Halo platform for {settings.FROM_NAME}"

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">You've been invited!</h2>
                <p>Hello,</p>
                <p>You have been invited to join the Halo platform for {settings.FROM_NAME} as a <strong>{role}</strong>.</p>
                <p>Click the button below to accept your invitation and create your account:</p>
                <div style="margin: 30px 0;">
                    <a href="{invitation_link}" 
                       style="background-color: #2563eb; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accept Invitation
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="{invitation_link}" style="color: #2563eb;">{invitation_link}</a>
                </p>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    This invitation will expire in {settings.INVITATION_EXPIRY_HOURS} hours.
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    If you didn't expect this invitation, you can safely ignore this email.
                </p>
            </div>
        </body>
    </html>
    """

    text_content = f"""
You've been invited to {settings.FROM_NAME}

Hello,

You have been invited to join the Halo platform for {settings.FROM_NAME} as a {role}.

Click the link below to accept your invitation and create your account:
{invitation_link}

This invitation will expire in {settings.INVITATION_EXPIRY_HOURS} hours.

If you didn't expect this invitation, you can safely ignore this email.
    """

    try:
        yag = _get_yag()
        yag.send(to=email, subject=subject, contents=[text_content, html_content])
    except Exception as e:
        print(f"Failed to send invitation email: {e}")


