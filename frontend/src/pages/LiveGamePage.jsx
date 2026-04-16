import LiveGamePlayer from "../components/LiveGamePlayer";

/**
 * Live Game Page - Standalone page for playing the 24/7 game
 * Accessible from /play route
 */
export default function LiveGamePage() {
  return <LiveGamePlayer embedded={false} />;
}
