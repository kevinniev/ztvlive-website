import { useState } from "react";
import BigScreenTVMode from "@/components/BigScreenTVMode";
import RoundTimer from "@/components/RoundTimer";
import { Button } from "@/components/ui/button";
import { Tv, Timer, Play, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Big Screen TV Mode Test Page
 * 
 * Preview and test the OTT "Big Screen" experience
 * before the April 3rd launch.
 */

export default function BigScreenTestPage() {
  const [showBigScreen, setShowBigScreen] = useState(false);
  const [showTimerDemo, setShowTimerDemo] = useState(false);
  const [timerActive, setTimerActive] = useState(false);

  if (showBigScreen) {
    return <BigScreenTVMode onClose={() => setShowBigScreen(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <Link to="/admin" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-500 rounded-2xl flex items-center justify-center">
            <Tv className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white">Big Screen TV Mode</h1>
            <p className="text-zinc-400">Test the OTT experience for Roku, Fire TV, Samsung & LG</p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Big Screen Mode */}
          <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center">
                <Tv className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Full Show Experience</h2>
                <p className="text-zinc-500 text-sm">30-minute 3-round format</p>
              </div>
            </div>
            
            <ul className="text-zinc-400 text-sm space-y-2 mb-6">
              <li>• TV-safe zones (10% margins)</li>
              <li>• Large fonts for 10-foot viewing</li>
              <li>• Prominent QR code for phone joining</li>
              <li>• 3 rounds with escalating prizes ($5 → $10 → $15)</li>
              <li>• Hybrid scoring (accuracy + majority match bonus)</li>
            </ul>

            <Button
              onClick={() => setShowBigScreen(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6"
            >
              <Play className="w-5 h-5 mr-2" />
              Launch Big Screen Mode
            </Button>
          </div>

          {/* Round Timer Demo */}
          <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-600/20 rounded-xl flex items-center justify-center">
                <Timer className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Round Timer Component</h2>
                <p className="text-zinc-500 text-sm">10-minute countdown per round</p>
              </div>
            </div>

            <div className="mb-4">
              <RoundTimer 
                isActive={timerActive}
                roundDuration={30} // 30 seconds for demo
                onRoundEnd={(round, prize) => {
                  console.log(`Round ${round} ended! Prize: ${prize.label}`);
                }}
                onShowEnd={() => {
                  setTimerActive(false);
                  console.log("Show complete!");
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setTimerActive(!timerActive)}
                variant={timerActive ? "destructive" : "default"}
                className="flex-1"
              >
                {timerActive ? "Stop Timer" : "Start Timer Demo"}
              </Button>
              <Button
                variant="outline"
                className="border-zinc-700"
                onClick={() => setShowTimerDemo(!showTimerDemo)}
              >
                {showTimerDemo ? "Hide" : "Show"} Compact
              </Button>
            </div>

            {showTimerDemo && (
              <div className="mt-4">
                <p className="text-zinc-500 text-xs mb-2">Compact version:</p>
                <RoundTimer isActive={timerActive} roundDuration={30} compact />
              </div>
            )}
          </div>
        </div>

        {/* Show Format Info */}
        <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-700">
          <h3 className="text-xl font-bold text-white mb-4">30-Minute Show Format</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="py-3 px-4 text-zinc-400 font-semibold">Time</th>
                  <th className="py-3 px-4 text-zinc-400 font-semibold">Segment</th>
                  <th className="py-3 px-4 text-zinc-400 font-semibold">Duration</th>
                  <th className="py-3 px-4 text-zinc-400 font-semibold">What Happens</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-800">
                  <td className="py-3 px-4 font-mono">0:00</td>
                  <td className="py-3 px-4 font-semibold text-purple-400">INTRO</td>
                  <td className="py-3 px-4">2 min</td>
                  <td className="py-3 px-4">Branding, QR invite, "Join the Pool!"</td>
                </tr>
                <tr className="border-b border-zinc-800 bg-green-500/5">
                  <td className="py-3 px-4 font-mono">2:00</td>
                  <td className="py-3 px-4 font-semibold text-green-400">ROUND 1</td>
                  <td className="py-3 px-4">8 min</td>
                  <td className="py-3 px-4">6 questions, <span className="text-green-400 font-bold">$5 Winner</span></td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-3 px-4 font-mono">10:00</td>
                  <td className="py-3 px-4 font-semibold text-zinc-400">HIGHLIGHTS</td>
                  <td className="py-3 px-4">2 min</td>
                  <td className="py-3 px-4">Best clips from Practice loops</td>
                </tr>
                <tr className="border-b border-zinc-800 bg-blue-500/5">
                  <td className="py-3 px-4 font-mono">12:00</td>
                  <td className="py-3 px-4 font-semibold text-blue-400">ROUND 2</td>
                  <td className="py-3 px-4">8 min</td>
                  <td className="py-3 px-4">Fresh questions, <span className="text-blue-400 font-bold">$10 Winner</span></td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-3 px-4 font-mono">20:00</td>
                  <td className="py-3 px-4 font-semibold text-zinc-400">CREATOR SPOTLIGHT</td>
                  <td className="py-3 px-4">2 min</td>
                  <td className="py-3 px-4">Featured creator moment</td>
                </tr>
                <tr className="border-b border-zinc-800 bg-yellow-500/5">
                  <td className="py-3 px-4 font-mono">22:00</td>
                  <td className="py-3 px-4 font-semibold text-yellow-400">ROUND 3 (FINALE)</td>
                  <td className="py-3 px-4">6 min</td>
                  <td className="py-3 px-4">Championship round, <span className="text-yellow-400 font-bold">$15 Winner</span></td>
                </tr>
                <tr className="bg-red-500/5">
                  <td className="py-3 px-4 font-mono">28:00</td>
                  <td className="py-3 px-4 font-semibold text-red-400">PRIZE DROP</td>
                  <td className="py-3 px-4">2 min</td>
                  <td className="py-3 px-4">DoorDash reveal, "See you at 10 PM!"</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-zinc-800/50 rounded-xl">
            <p className="text-zinc-400 text-sm">
              <strong className="text-white">Launch Target:</strong> Friday, April 3rd<br/>
              <strong className="text-white">Broadcast Windows:</strong> 10:00 AM & 10:00 PM (appointment viewing)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
