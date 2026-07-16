import { Component, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Recovers from a routed view whose reactive queries throw — most importantly
// "Not a member of this server" after the owner removes you (or you leave)
// while you're still viewing that server. Convex's useQuery throws on a query
// error, so without this the whole app crashes. We redirect Home instead; the
// server list (ServerRail, outside this boundary) updates reactively on its
// own. Backend authorization is unchanged — this is purely graceful handling.
class Boundary extends Component<
  { resetKey: string; fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Route error — returning Home:", error);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    // Once the redirect changes the route, clear the error so the new route
    // (Home) renders normally.
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function RedirectHome() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return (
    <div className="flex h-full items-center justify-center text-content-muted">
      Returning to home…
    </div>
  );
}

export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <Boundary resetKey={location.pathname} fallback={<RedirectHome />}>
      {children}
    </Boundary>
  );
}
