import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
	session: Session | null;
	user: User | null;
	profile: { username: string; avatar_url: string | null } | null;
	loading: boolean;
}

export function useAuth() {
	const [state, setState] = useState<AuthState>({
		session: null,
		user: null,
		profile: null,
		loading: true,
	});

	// Listen for auth state changes
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setState((s) => ({
				...s,
				session,
				user: session?.user ?? null,
				loading: false,
			}));
			if (session?.user) {
				fetchProfile(session.user.id);
			}
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setState((s) => ({ ...s, session, user: session?.user ?? null }));
			if (session?.user) {
				fetchProfile(session.user.id);
			} else {
				setState((s) => ({ ...s, profile: null }));
			}
		});

		return () => subscription.unsubscribe();
	}, []);

	const fetchProfile = async (userId: string) => {
		const { data } = await supabase
			.from("profiles")
			.select("username, avatar_url")
			.eq("id", userId)
			.single();
		if (data) {
			setState((s) => ({ ...s, profile: data }));
		}
	};

	const signUp = useCallback(
		async (email: string, password: string, username: string) => {
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: { username }, // passed to handle_new_user trigger
				},
			});
			if (error) return { error: error.message };
			return { success: true, user: data.user };
		},
		[],
	);

	const signIn = useCallback(async (email: string, password: string) => {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) return { error: error.message };
		return { success: true, user: data.user };
	}, []);

	const signInWithGoogle = useCallback(async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: { redirectTo: window.location.origin },
		});
		if (error) return { error: error.message };
		return { success: true };
	}, []);

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
	}, []);

	return {
		...state,
		authenticated: !!state.user,
		signUp,
		signIn,
		signInWithGoogle,
		signOut,
	};
}
