// backend\src\modules\auth\auth.service.ts

// backend/src/modules/auth/auth.service.ts

import { supabase } from "../../lib/supabase.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";

import { ApiError } from "../../utils/apiError.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { generateUsername } from "../../utils/generateUsername.js";
import { successResponse } from "../../utils/apiResponse.js";

import { AUTH_MESSAGES } from "./auth.constants.js";

import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  RefreshTokenInput,
  ResendVerificationInput,
} from "./auth.validation.js";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface AuthUserPayload {
  id: string;
  email: string;
  fullName: string;
  username: string;
  emailConfirmed: boolean;
}

interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

/* ------------------------------------------------------------------ */
/* Service                                                            */
/* ------------------------------------------------------------------ */

class AuthService {
  /* ================================================================
     REGISTER
     ================================================================ */
  async register(data: RegisterInput) {
    const { fullName, email, password } = data;

    // 1. Check for an existing profile with this email first —
    //    gives a clean, predictable error instead of relying on
    //    Supabase Auth's own duplicate-email response shape.
    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      logger.error({ err: lookupError }, "Failed to check existing profile");
      throw new ApiError(
        "Something went wrong. Please try again.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (existingProfile) {
      throw new ApiError(
        AUTH_MESSAGES.EMAIL_ALREADY_EXISTS,
        HTTP_STATUS.CONFLICT,
      );
    }

    // 2. Create the Supabase Auth user. Supabase sends the
    //    verification email automatically (email confirmations
    //    must be enabled in the Supabase Auth dashboard).
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${env.CLIENT_URL}/auth/verified`,
        },
      },
    );

    if (signUpError) {
      logger.error({ err: signUpError }, "Supabase signUp failed");

      if (signUpError.message.toLowerCase().includes("already registered")) {
        throw new ApiError(
          AUTH_MESSAGES.EMAIL_ALREADY_EXISTS,
          HTTP_STATUS.CONFLICT,
        );
      }

      throw new ApiError(signUpError.message, HTTP_STATUS.BAD_REQUEST);
    }

    const authUser = signUpData.user;

    if (!authUser) {
      throw new ApiError(
        "Registration failed. Please try again.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    // 3. Create the profile row. If this fails, roll back the
    //    orphaned auth user so the email isn't permanently stuck.
    const username = generateUsername(email);

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authUser.id,
      email,
      full_name: fullName,
      username,
      role: "user",
      is_active: true,
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      logger.error({ err: profileError }, "Profile creation failed");

      await supabase.auth.admin
        .deleteUser(authUser.id)
        .catch((rollbackErr) =>
          logger.error(
            { err: rollbackErr },
            "Failed to roll back orphaned auth user",
          ),
        );

      throw new ApiError(
        "Registration failed. Please try again.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    logger.info({ userId: authUser.id, email }, "User registered");

    const userPayload: AuthUserPayload = {
      id: authUser.id,
      email,
      fullName,
      username,
      emailConfirmed: Boolean(authUser.email_confirmed_at),
    };

    return successResponse(AUTH_MESSAGES.REGISTER_SUCCESS, {
      user: userPayload,
      requiresEmailVerification: !authUser.email_confirmed_at,
      // No session returned here on purpose — the user must verify
      // their email before they're considered fully authenticated.
    });
  }

  /* ================================================================
     LOGIN
     ================================================================ */
  async login(data: LoginInput) {
    const { email, password } = data;

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      // Supabase returns a generic message for both "wrong password"
      // and "user doesn't exist" — keep ours generic too, on purpose,
      // to avoid leaking which emails are registered.
      throw new ApiError(
        AUTH_MESSAGES.INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const { user, session } = signInData;

    if (!user || !session) {
      throw new ApiError(
        AUTH_MESSAGES.INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    if (!user.email_confirmed_at) {
      throw new ApiError(
        "Please verify your email before logging in.",
        HTTP_STATUS.FORBIDDEN,
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
id,
email,
full_name,
username,
role,
is_active,
email_verified
`,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logger.error({ err: profileError }, "Failed to fetch profile on login");
      throw new ApiError(
        "Something went wrong. Please try again.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!profile) {
      throw new ApiError(AUTH_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    logger.info({ userId: user.id }, "User logged in");

    const userPayload: AuthUserPayload = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      username: profile.username,
      emailConfirmed: true,
    };

    const sessionPayload: SessionPayload = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? null,
    };

    return successResponse(AUTH_MESSAGES.LOGIN_SUCCESS, {
      user: userPayload,
      session: sessionPayload,
    });
  }

  /* ================================================================
     LOGOUT
     ================================================================ */
  async logout(accessToken: string) {
    if (!accessToken) {
      throw new ApiError("No active session.", HTTP_STATUS.UNAUTHORIZED);
    }

    // Supabase's client-scoped signOut needs the user's session set
    // on this request; the admin API lets us invalidate by token
    // directly without a stateful client instance.
    const { error } = await supabase.auth.admin.signOut(accessToken, "global");

    if (error) {
      logger.error({ err: error }, "Logout failed");
      throw new ApiError(
        "Logout failed. Please try again.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    return successResponse(AUTH_MESSAGES.LOGOUT_SUCCESS);
  }

  /* ================================================================
     FORGOT PASSWORD
     ================================================================ */
  async forgotPassword(data: ForgotPasswordInput) {
    const { email } = data;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.CLIENT_URL}/auth/reset-password`,
    });

    // Always respond with success regardless of whether the email
    // exists — prevents user enumeration via this endpoint.
    if (error) {
      logger.warn(
        { err: error, email },
        "resetPasswordForEmail returned an error (not surfaced to client)",
      );
    }

    return successResponse(AUTH_MESSAGES.PASSWORD_RESET_SENT);
  }

  /* ================================================================
     RESET PASSWORD
     ================================================================ */
  async resetPassword(accessToken: string, data: ResetPasswordInput) {
    if (!accessToken) {
      throw new ApiError(
        "Invalid or expired reset link.",
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser(accessToken);

    if (userError || !userData.user) {
      throw new ApiError(
        "Invalid or expired reset link.",
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { password: data.password },
    );

    if (updateError) {
      logger.error({ err: updateError }, "Password reset failed");
      throw new ApiError(
        "Password reset failed. Please try again.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    logger.info({ userId: userData.user.id }, "Password reset successfully");

    return successResponse(AUTH_MESSAGES.PASSWORD_RESET_SUCCESS);
  }

  /* ================================================================
   RESEND EMAIL VERIFICATION
   ================================================================ */
  async resendVerification(data: ResendVerificationInput) {
    const { email } = data;

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${env.CLIENT_URL}/auth/verified`,
      },
    });

    if (error) {
      logger.error(error);

      throw new ApiError(error.message, HTTP_STATUS.BAD_REQUEST);
    }

    return successResponse("Verification email sent successfully.");
  }

  /* ================================================================
   REFRESH SESSION
   ================================================================ */
  async refreshSession(data: RefreshTokenInput) {
    const { refreshToken } = data;

    const { data: sessionData, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !sessionData.session) {
      throw new ApiError("Refresh token expired.", HTTP_STATUS.UNAUTHORIZED);
    }

    const session = sessionData.session;

    return successResponse("Session refreshed successfully.", {
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
      },
    });
  }

  /* ================================================================
   GET CURRENT USER
   ================================================================ */
  async getCurrentUser(userId: string) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        `
      id,
      email,
      full_name,
      username,
      role,
      email_verified
      `,
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      logger.error(error);

      throw new ApiError(
        "Failed to fetch user.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!profile) {
      throw new ApiError(AUTH_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return successResponse("User fetched successfully.", {
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        username: profile.username,
        role: profile.role,
        emailVerified: profile.email_verified,
      },
    });
  }
}

export const authService = new AuthService();