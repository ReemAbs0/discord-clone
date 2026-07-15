import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // The default profile() only persists `email` — FR-001 requires the
      // display name to be captured at signup too, so it must be threaded
      // through explicitly from the signIn(..., { flow: "signUp" }) params.
      profile(params) {
        return {
          email: params.email as string,
          name: params.name as string,
        };
      },
    }),
  ],
});
