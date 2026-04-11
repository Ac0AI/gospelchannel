"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), magicLinkClient()],
});

export async function signInWithPassword(input: { email: string; password: string }) {
  return authClient.signIn.email(input);
}

export async function requestEmailOtp(input: { email: string }) {
  return authClient.emailOtp.sendVerificationOtp({
    email: input.email,
    type: "sign-in",
  });
}

export async function signInWithEmailOtp(input: { email: string; otp: string }) {
  return authClient.signIn.emailOtp({
    email: input.email,
    otp: input.otp,
  });
}

export async function requestMagicLink(input: {
  email: string;
  callbackURL?: string;
  errorCallbackURL?: string;
}) {
  return authClient.signIn.magicLink({
    email: input.email,
    callbackURL: input.callbackURL,
    errorCallbackURL: input.errorCallbackURL,
  });
}

export async function signOutCurrentUser() {
  return authClient.signOut();
}
