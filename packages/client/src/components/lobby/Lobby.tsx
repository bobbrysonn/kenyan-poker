import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRooms } from '@/hooks/useRooms';

export function Lobby() {
  const { profile, signOut } = useAuth();
  const { createRoom, joinRoom, loading, error } = useRooms();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');

  const handleCreate = async () => {
    setMessage('');
    const room = await createRoom();
    if (room) {
      navigate(`/game/${room.code}`);
    }
  };

  const handleJoin = async () => {
    setMessage('');
    if (!joinCode.trim()) return;
    const result = await joinRoom(joinCode.trim().toUpperCase());
    if (result) {
      navigate(`/game/${result.room.code}`);
    }
  };

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

      {(error || message) && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${
          error ? 'bg-red-900/50 border border-red-500 text-red-200' :
                  'bg-green-900/50 border border-green-500 text-green-200'
        }`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-felt-light rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-2">Create a Game</h2>
          <p className="text-green-400 text-sm mb-4">
            Start a new game and share the room code with friends.
          </p>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="bg-gold text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </section>

        <section className="bg-felt-light rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-2">Join a Game</h2>
          <p className="text-green-400 text-sm mb-4">
            Enter a room code shared by a friend.
          </p>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="e.g. XK4MP9"
            className="bg-green-900 border border-green-700 rounded-lg px-4 py-3 mb-3 w-full text-white placeholder-green-500 focus:outline-none focus:border-gold transition font-mono text-lg tracking-widest text-center"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button
            onClick={handleJoin}
            disabled={loading || joinCode.trim().length < 3}
            className="w-full bg-gold text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </section>
      </div>
    </div>
  );
}
