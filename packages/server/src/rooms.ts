import { supabase } from "./db.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for readability

function generateCode(): string {
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
	}
	return code;
}

/** Create a new game room. Returns the room data with join code. */
export async function createRoom(params: {
	hostId: string;
	maxPlayers?: number;
	cardsPerPlayer?: number;
}) {
	const code = generateCode();

	const { data, error } = await supabase
		.from("game_rooms")
		.insert({
			host_id: params.hostId,
			code,
			max_players: params.maxPlayers ?? 4,
			cards_per_player: params.cardsPerPlayer ?? 5,
			status: "waiting",
		})
		.select()
		.single();

	if (error) throw new Error(`Failed to create room: ${error.message}`);

	// Auto-join host as seat 0
	await supabase.from("room_players").insert({
		room_id: data.id,
		player_id: params.hostId,
		seat_index: 0,
	});

	return data;
}

/** Get room info by join code */
export async function getRoomByCode(code: string) {
	const { data, error } = await supabase
		.from("game_rooms")
		.select("*, room_players(*)")
		.eq("code", code.toUpperCase())
		.single();

	if (error || !data) return null;
	return data;
}

/** Join a room. Returns seat index or null if full. */
export async function joinRoom(params: { roomCode: string; playerId: string }) {
	const room = await getRoomByCode(params.roomCode);
	if (!room) throw new Error("Room not found");
	if (room.status !== "waiting") throw new Error("Game already started");

	const currentPlayers = Array.isArray(room.room_players)
		? room.room_players.length
		: 0;

	if (currentPlayers >= (room.max_players ?? 4)) {
		throw new Error("Room is full");
	}

	// Check if already in room
	const alreadyJoined =
		Array.isArray(room.room_players) &&
		room.room_players.some((rp: any) => rp.player_id === params.playerId);

	if (alreadyJoined) {
		return {
			room,
			seatIndex: room.room_players.find(
				(rp: any) => rp.player_id === params.playerId,
			).seat_index,
		};
	}

	const seatIndex = currentPlayers;

	const { error } = await supabase.from("room_players").insert({
		room_id: room.id,
		player_id: params.playerId,
		seat_index: seatIndex,
	});

	if (error) throw new Error(`Failed to join room: ${error.message}`);

	return { room, seatIndex };
}

/** Leave a room */
export async function leaveRoom(roomId: string, playerId: string) {
	await supabase
		.from("room_players")
		.delete()
		.eq("room_id", roomId)
		.eq("player_id", playerId);
}

/** Get all players in a room (by room UUID, not join code) */
export async function getRoomPlayers(roomId: string) {
	const { data, error } = await supabase
		.from("room_players")
		.select("player_id, seat_index, profiles(username)")
		.eq("room_id", roomId)
		.order("seat_index");

	if (error) return [];
	return (data as any[]).map((rp) => ({
		playerId: rp.player_id,
		seatIndex: rp.seat_index,
		username: rp.profiles?.username ?? "Unknown",
	}));
}

/** Update a room's lifecycle status */
export async function updateRoomStatus(
	roomId: string,
	status: "waiting" | "playing" | "finished",
) {
	const update: Record<string, unknown> = { status };
	if (status === "playing") update.started_at = new Date().toISOString();

	const { error } = await supabase
		.from("game_rooms")
		.update(update)
		.eq("id", roomId);

	if (error) throw new Error(`Failed to update room status: ${error.message}`);
}

/** Save per-player results at the end of a game */
export async function saveGameHistory(
	entries: {
		roomId: string;
		playerId: string;
		placement: number;
		turnsPlayed: number;
		cardsRemaining: number;
	}[],
) {
	const { error } = await supabase.from("game_history").insert(
		entries.map((e) => ({
			room_id: e.roomId,
			player_id: e.playerId,
			placement: e.placement,
			turns_played: e.turnsPlayed,
			cards_remaining: e.cardsRemaining,
		})),
	);

	if (error) throw new Error(`Failed to save game history: ${error.message}`);
}
