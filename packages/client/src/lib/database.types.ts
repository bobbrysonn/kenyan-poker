export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      friendships: {
        Row: {
          addressee_id: string
          created_at: string | null
          id: string
          requester_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requester_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_history: {
        Row: {
          cards_remaining: number | null
          created_at: string | null
          id: string
          placement: number
          player_id: string
          room_id: string
          turns_played: number | null
        }
        Insert: {
          cards_remaining?: number | null
          created_at?: string | null
          id?: string
          placement: number
          player_id: string
          room_id: string
          turns_played?: number | null
        }
        Update: {
          cards_remaining?: number | null
          created_at?: string | null
          id?: string
          placement?: number
          player_id?: string
          room_id?: string
          turns_played?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          cards_per_player: number | null
          code: string
          created_at: string | null
          deck_count: number | null
          host_id: string
          id: string
          max_players: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          cards_per_player?: number | null
          code: string
          created_at?: string | null
          deck_count?: number | null
          host_id: string
          id?: string
          max_players?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          cards_per_player?: number | null
          code?: string
          created_at?: string | null
          deck_count?: number | null
          host_id?: string
          id?: string
          max_players?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          status: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          status?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          username?: string
        }
        Relationships: []
      }
      room_players: {
        Row: {
          id: string
          joined_at: string | null
          player_id: string
          room_id: string
          seat_index: number
        }
        Insert: {
          id?: string
          joined_at?: string | null
          player_id: string
          room_id: string
          seat_index: number
        }
        Update: {
          id?: string
          joined_at?: string | null
          player_id?: string
          room_id?: string
          seat_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
