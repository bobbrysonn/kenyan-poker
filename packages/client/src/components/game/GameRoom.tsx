import { useParams } from 'react-router-dom';

export function GameRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();

  return (
    <div className="min-h-screen bg-felt p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gold">🎴 Room: {roomCode}</h1>
        <span className="text-green-300 text-sm">Connected</span>
      </header>
      <div className="bg-felt-light rounded-lg p-6 text-center">
        <p className="text-green-300">Game board coming soon...</p>
        <p className="text-green-500 text-sm mt-2">
          Waiting for players to join. Share the room code: <strong className="text-gold">{roomCode}</strong>
        </p>
      </div>
    </div>
  );
}
