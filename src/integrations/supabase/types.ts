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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      albums: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          name: string
          release_date: string | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          name: string
          release_date?: string | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          name?: string
          release_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          created_at: string
          genre: string
          id: string
          katalognummer: string | null
          label: string | null
          language: string | null
          name: string
          personality: string
          profile_image_url: string | null
          rechteinhaber_master: string | null
          rechteinhaber_publishing: string | null
          style: string
          verlag: string | null
          voice_prompt: string
        }
        Insert: {
          created_at?: string
          genre: string
          id?: string
          katalognummer?: string | null
          label?: string | null
          language?: string | null
          name: string
          personality: string
          profile_image_url?: string | null
          rechteinhaber_master?: string | null
          rechteinhaber_publishing?: string | null
          style: string
          verlag?: string | null
          voice_prompt: string
        }
        Update: {
          created_at?: string
          genre?: string
          id?: string
          katalognummer?: string | null
          label?: string | null
          language?: string | null
          name?: string
          personality?: string
          profile_image_url?: string | null
          rechteinhaber_master?: string | null
          rechteinhaber_publishing?: string | null
          style?: string
          verlag?: string | null
          voice_prompt?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          album_id: string
          anteil_komponist: number | null
          anteil_text: number | null
          anteil_verlag: number | null
          audio_url: string | null
          bemerkungen: string | null
          bpm: number | null
          created_at: string
          einnahmequelle: string | null
          exklusivitaet: string | null
          gema_status: string | null
          gema_werknummer: string | null
          generation_status: string | null
          id: string
          isrc: string | null
          iswc: string | null
          jahresumsatz: number | null
          katalogwert: number | null
          ki_generiert: string | null
          komponist: string | null
          laenge: string | null
          name: string
          song_id: string | null
          suno_task_id: string | null
          textdichter: string | null
          tonart: string | null
          track_number: number
          version: string | null
          vertragsart: string | null
          vertragsbeginn: string | null
          vertragsende: string | null
          verwertungsstatus: string | null
        }
        Insert: {
          album_id: string
          anteil_komponist?: number | null
          anteil_text?: number | null
          anteil_verlag?: number | null
          audio_url?: string | null
          bemerkungen?: string | null
          bpm?: number | null
          created_at?: string
          einnahmequelle?: string | null
          exklusivitaet?: string | null
          gema_status?: string | null
          gema_werknummer?: string | null
          generation_status?: string | null
          id?: string
          isrc?: string | null
          iswc?: string | null
          jahresumsatz?: number | null
          katalogwert?: number | null
          ki_generiert?: string | null
          komponist?: string | null
          laenge?: string | null
          name: string
          song_id?: string | null
          suno_task_id?: string | null
          textdichter?: string | null
          tonart?: string | null
          track_number: number
          version?: string | null
          vertragsart?: string | null
          vertragsbeginn?: string | null
          vertragsende?: string | null
          verwertungsstatus?: string | null
        }
        Update: {
          album_id?: string
          anteil_komponist?: number | null
          anteil_text?: number | null
          anteil_verlag?: number | null
          audio_url?: string | null
          bemerkungen?: string | null
          bpm?: number | null
          created_at?: string
          einnahmequelle?: string | null
          exklusivitaet?: string | null
          gema_status?: string | null
          gema_werknummer?: string | null
          generation_status?: string | null
          id?: string
          isrc?: string | null
          iswc?: string | null
          jahresumsatz?: number | null
          katalogwert?: number | null
          ki_generiert?: string | null
          komponist?: string | null
          laenge?: string | null
          name?: string
          song_id?: string | null
          suno_task_id?: string | null
          textdichter?: string | null
          tonart?: string | null
          track_number?: number
          version?: string | null
          vertragsart?: string | null
          vertragsbeginn?: string | null
          vertragsende?: string | null
          verwertungsstatus?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
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
