import { useAuth } from '@/hooks/useAuth';

export function Lobby() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-felt p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gold">🎴 Kenyan Poker</h1>
          <p className="text-green-300 mt-1">
            Welcome, <span className="text-white font-medium">{profile?.username ?? 'Player'}</span>
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-green-400 hover:text-red-400 transition text-sm font-medium"
        >
          Sign Out
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-felt-light rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Create a Game</h2>
          <p className="text-green-400 text-sm mb-4">
            Start a new game and invite friends with a room code.
          </p>
          <button className="bg-gold text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition">
            Create Room
          </button>
        </section>

        <section className="bg-felt-light rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Join a Game</h2>
          <p className="text-green-400 text-sm mb-4">
            Enter a room code shared by a friend.
          </p>
          <input
            type="text"
            placeholder="Enter room code..."
            className="bg-green-900 border border-green-700 rounded px-3 py-2 mb-3 w-full text-white placeholder-green-500"
          />
          <button className="bg-gold text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition">
            Join Room
          </button>
        </section>
      </div>
    </div>
  );
}
