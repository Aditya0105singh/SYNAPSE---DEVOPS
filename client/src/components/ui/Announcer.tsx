import { useStore } from "../../store/useStore";

/** Screen-reader announcement channel for new critical alerts. */
export function Announcer() {
  const message = useStore((s) => s.liveAnnouncement);
  return (
    <div aria-live="assertive" role="status" className="sr-only-live">
      {message}
    </div>
  );
}
