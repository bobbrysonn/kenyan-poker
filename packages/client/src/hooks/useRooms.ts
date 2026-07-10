import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

interface Room {
	id: string;
	code: string;
	host_id: string;
	status: string;
	max_players: number;
	cards_per_player: number;
	created_at: string;
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function useRooms() {
	const { session, user } = useAuth();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const getAccessToken = async () => {
		const { data } = await supabase.auth.getSession();
		return data.session?.access_token;
	};

	const createRoom = useCallback(async (opts?: { maxPlayers?: number }) => {
		setLoading(true);
		setError("");

		try {
			const token = await getAccessToken();
			const resp = await fetch(`${apiBaseUrl}/api/rooms`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ maxPlayers: opts?.maxPlayers }),
			});

			const data = await resp.json();
			if (!resp.ok) throw new Error(data.error);

			return data.room as Room;
		} catch (err: any) {
			setError(err.message);
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	const joinRoom = useCallback(async (code: string) => {
		setLoading(true);
		setError("");

		try {
			const token = await getAccessToken();
			const resp = await fetch(`${apiBaseUrl}/api/rooms/${code}/join`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
			});

			const data = await resp.json();
			if (!resp.ok) throw new Error(data.error);

			return data;
		} catch (err: any) {
			setError(err.message);
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	return { createRoom, joinRoom, loading, error };
}
