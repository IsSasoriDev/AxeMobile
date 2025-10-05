export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      app_updates: {
        Row: {
          created_at: string
          download_url: string | null
          id: string
          is_latest: boolean | null
          release_notes: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_latest?: boolean | null
          release_notes?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_latest?: boolean | null
          release_notes?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      bitcoin_network_stats: {
        Row: {
          block_reward: number
          created_at: string
          difficulty: number
          hashrate: number
          id: string
          market_cap_usd: number
          mempool_count: number
          mempool_vsize: number
          next_difficulty_adjustment: number
          price_usd: number
          updated_at: string
        }
        Insert: {
          block_reward?: number
          created_at?: string
          difficulty: number
          hashrate: number
          id?: string
          market_cap_usd?: number
          mempool_count?: number
          mempool_vsize?: number
          next_difficulty_adjustment?: number
          price_usd?: number
          updated_at?: string
        }
        Update: {
          block_reward?: number
          created_at?: string
          difficulty?: number
          hashrate?: number
          id?: string
          market_cap_usd?: number
          mempool_count?: number
          mempool_vsize?: number
          next_difficulty_adjustment?: number
          price_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      firmware_releases: {
        Row: {
          created_at: string
          download_url: string | null
          id: string
          is_latest: boolean | null
          model: string
          release_notes: string | null
          release_url: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_latest?: boolean | null
          model: string
          release_notes?: string | null
          release_url?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_latest?: boolean | null
          model?: string
          release_notes?: string | null
          release_url?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      influx_instances: {
        Row: {
          bucket: string
          created_at: string
          id: string
          influx_url: string
          measurement: string
          org: string
          status: string
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          influx_url: string
          measurement?: string
          org: string
          status?: string
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          influx_url?: string
          measurement?: string
          org?: string
          status?: string
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      miner_stats: {
        Row: {
          hashrate: number | null
          id: string
          miner_id: string
          power: number | null
          recorded_at: string
          shares_accepted: number | null
          shares_rejected: number | null
          temperature: number | null
          uptime_seconds: number | null
          user_id: string | null
          voltage: number | null
        }
        Insert: {
          hashrate?: number | null
          id?: string
          miner_id: string
          power?: number | null
          recorded_at?: string
          shares_accepted?: number | null
          shares_rejected?: number | null
          temperature?: number | null
          uptime_seconds?: number | null
          user_id?: string | null
          voltage?: number | null
        }
        Update: {
          hashrate?: number | null
          id?: string
          miner_id?: string
          power?: number | null
          recorded_at?: string
          shares_accepted?: number | null
          shares_rejected?: number | null
          temperature?: number | null
          uptime_seconds?: number | null
          user_id?: string | null
          voltage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "miner_stats_miner_id_fkey"
            columns: ["miner_id"]
            isOneToOne: false
            referencedRelation: "miners"
            referencedColumns: ["id"]
          },
        ]
      }
      miners: {
        Row: {
          created_at: string
          firmware_version: string | null
          id: string
          ip_address: string
          last_seen: string | null
          model: string
          name: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          firmware_version?: string | null
          id?: string
          ip_address: string
          last_seen?: string | null
          model: string
          name: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          firmware_version?: string | null
          id?: string
          ip_address?: string
          last_seen?: string | null
          model?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
