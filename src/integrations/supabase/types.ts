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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_enumeration_log: {
        Row: {
          day: string
          first_seen_at: string
          ip: string
          key: string
          kind: string
        }
        Insert: {
          day: string
          first_seen_at?: string
          ip: string
          key: string
          kind: string
        }
        Update: {
          day?: string
          first_seen_at?: string
          ip?: string
          key?: string
          kind?: string
        }
        Relationships: []
      }
      agent_lead_requests: {
        Row: {
          client_session_id: string
          created_at: string
          id: string
          ip: string | null
          lead_submission_id: string | null
          reason: string | null
          resolved_at: string | null
          tier: string
        }
        Insert: {
          client_session_id: string
          created_at?: string
          id?: string
          ip?: string | null
          lead_submission_id?: string | null
          reason?: string | null
          resolved_at?: string | null
          tier: string
        }
        Update: {
          client_session_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          lead_submission_id?: string | null
          reason?: string | null
          resolved_at?: string | null
          tier?: string
        }
        Relationships: []
      }
      agent_rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      agent_sessions: {
        Row: {
          client_session_id: string
          closed: boolean
          created_at: string
          data_pull_count: number
          history: Json
          idle_closed_at: string | null
          ip: string | null
          last_message_at: string
          post_handoff_replies: number
          token_total: number
          turn_count: number
        }
        Insert: {
          client_session_id: string
          closed?: boolean
          created_at?: string
          data_pull_count?: number
          history?: Json
          idle_closed_at?: string | null
          ip?: string | null
          last_message_at?: string
          post_handoff_replies?: number
          token_total?: number
          turn_count?: number
        }
        Update: {
          client_session_id?: string
          closed?: boolean
          created_at?: string
          data_pull_count?: number
          history?: Json
          idle_closed_at?: string | null
          ip?: string | null
          last_message_at?: string
          post_handoff_replies?: number
          token_total?: number
          turn_count?: number
        }
        Relationships: []
      }
      agent_usage_daily: {
        Row: {
          day: string
          total_requests: number
          total_tokens: number
        }
        Insert: {
          day: string
          total_requests?: number
          total_tokens?: number
        }
        Update: {
          day?: string
          total_requests?: number
          total_tokens?: number
        }
        Relationships: []
      }
      bedroom_label_anomalies: {
        Row: {
          first_seen_at: string
          id: string
          last_seen_at: string
          neighborhood_slug: string | null
          occurrences: number
          period: string | null
          raw_label: string
          series: string
          source_table: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          neighborhood_slug?: string | null
          occurrences?: number
          period?: string | null
          raw_label: string
          series: string
          source_table?: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          neighborhood_slug?: string | null
          occurrences?: number
          period?: string | null
          raw_label?: string
          series?: string
          source_table?: string
        }
        Relationships: []
      }
      export_job_state: {
        Row: {
          created_at: string
          job: string
          last_monthly_path: string | null
          last_monthly_period: string | null
          last_monthly_sent_at: string | null
          last_weekly_path: string | null
          last_weekly_period: string | null
          last_weekly_sent_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          job: string
          last_monthly_path?: string | null
          last_monthly_period?: string | null
          last_monthly_sent_at?: string | null
          last_weekly_path?: string | null
          last_weekly_period?: string | null
          last_weekly_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          job?: string
          last_monthly_path?: string | null
          last_monthly_period?: string | null
          last_monthly_sent_at?: string | null
          last_weekly_path?: string | null
          last_weekly_period?: string | null
          last_weekly_sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      export_job_token: {
        Row: {
          created_at: string
          id: boolean
          label: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          label?: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          label?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_submissions: {
        Row: {
          client_session_id: string | null
          created_at: string
          email: string
          id: string
          intent: string
          message: string | null
          name: string
          neighborhoods: string[]
          phone: string | null
          price_range: string | null
          reason: string | null
          referrer: string | null
          source_path: string | null
          tier: string | null
          timeline: string | null
          transcript: Json | null
          user_agent: string | null
        }
        Insert: {
          client_session_id?: string | null
          created_at?: string
          email: string
          id?: string
          intent: string
          message?: string | null
          name: string
          neighborhoods?: string[]
          phone?: string | null
          price_range?: string | null
          reason?: string | null
          referrer?: string | null
          source_path?: string | null
          tier?: string | null
          timeline?: string | null
          transcript?: Json | null
          user_agent?: string | null
        }
        Update: {
          client_session_id?: string | null
          created_at?: string
          email?: string
          id?: string
          intent?: string
          message?: string | null
          name?: string
          neighborhoods?: string[]
          phone?: string | null
          price_range?: string | null
          reason?: string | null
          referrer?: string | null
          source_path?: string | null
          tier?: string | null
          timeline?: string | null
          transcript?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      monthly_report: {
        Row: {
          generated_at: string
          is_provisional: boolean
          month_end: string
          month_start: string
          payload: Json
        }
        Insert: {
          generated_at?: string
          is_provisional?: boolean
          month_end: string
          month_start: string
          payload: Json
        }
        Update: {
          generated_at?: string
          is_provisional?: boolean
          month_end?: string
          month_start?: string
          payload?: Json
        }
        Relationships: []
      }
      monthly_report_archive: {
        Row: {
          archived_at: string
          month_end: string
          month_start: string
          payload: Json
        }
        Insert: {
          archived_at?: string
          month_end: string
          month_start: string
          payload: Json
        }
        Update: {
          archived_at?: string
          month_end?: string
          month_start?: string
          payload?: Json
        }
        Relationships: []
      }
      neighborhood_monthly_archive: {
        Row: {
          archived_at: string
          month_start: string
          payload: Json
        }
        Insert: {
          archived_at?: string
          month_start: string
          payload: Json
        }
        Update: {
          archived_at?: string
          month_start?: string
          payload?: Json
        }
        Relationships: []
      }
      neighborhood_monthly_report: {
        Row: {
          created_at: string
          id: string
          neighborhood_slug: string
          payload: Json
          period: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          neighborhood_slug: string
          payload: Json
          period: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          neighborhood_slug?: string
          payload?: Json
          period?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_alert_state: {
        Row: {
          agent_name: string
          alert_key: string
          kind: string
          notified_at: string
          started_at: string | null
          week_start: string | null
        }
        Insert: {
          agent_name: string
          alert_key: string
          kind: string
          notified_at?: string
          started_at?: string | null
          week_start?: string | null
        }
        Update: {
          agent_name?: string
          alert_key?: string
          kind?: string
          notified_at?: string
          started_at?: string | null
          week_start?: string | null
        }
        Relationships: []
      }
      pipeline_run_status: {
        Row: {
          agent_name: string
          completed_at: string | null
          detail: string | null
          started_at: string
          status: string
          week_start: string
        }
        Insert: {
          agent_name: string
          completed_at?: string | null
          detail?: string | null
          started_at?: string
          status?: string
          week_start: string
        }
        Update: {
          agent_name?: string
          completed_at?: string | null
          detail?: string | null
          started_at?: string
          status?: string
          week_start?: string
        }
        Relationships: []
      }
      quarterly_brief_publish_log: {
        Row: {
          html_path: string | null
          published_at: string | null
          quarter_label: string
        }
        Insert: {
          html_path?: string | null
          published_at?: string | null
          quarter_label: string
        }
        Update: {
          html_path?: string | null
          published_at?: string | null
          quarter_label?: string
        }
        Relationships: []
      }
      service_audit_log: {
        Row: {
          action: string
          actor: string
          error_code: string | null
          error_message: string | null
          id: number
          ip_hash: string | null
          lead_id: string | null
          meta: Json | null
          outcome: string
          row_count: number | null
          session_id: string | null
          target_table: string | null
          ts: string
        }
        Insert: {
          action: string
          actor: string
          error_code?: string | null
          error_message?: string | null
          id?: number
          ip_hash?: string | null
          lead_id?: string | null
          meta?: Json | null
          outcome?: string
          row_count?: number | null
          session_id?: string | null
          target_table?: string | null
          ts?: string
        }
        Update: {
          action?: string
          actor?: string
          error_code?: string | null
          error_message?: string | null
          id?: number
          ip_hash?: string | null
          lead_id?: string | null
          meta?: Json | null
          outcome?: string
          row_count?: number | null
          session_id?: string | null
          target_table?: string | null
          ts?: string
        }
        Relationships: []
      }
      site_edit_digest_state: {
        Row: {
          id: boolean
          last_digested_at: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          last_digested_at?: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          last_digested_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sowhat_notes: {
        Row: {
          author: string | null
          block_key: string
          block_label: string | null
          correction: string | null
          created_at: string
          id: string
          neighborhood_slug: string
          note: string
          sentence_snapshot: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          block_key: string
          block_label?: string | null
          correction?: string | null
          created_at?: string
          id?: string
          neighborhood_slug: string
          note: string
          sentence_snapshot?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          block_key?: string
          block_label?: string | null
          correction?: string | null
          created_at?: string
          id?: string
          neighborhood_slug?: string
          note?: string
          sentence_snapshot?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_reconciliation_flags: {
        Row: {
          check_name: string
          created_at: string
          delta: number | null
          detail: Json
          hero_value: number | null
          id: string
          resolved_at: string | null
          severity: string
          status: string
          table_value: number | null
          updated_at: string
          week_start: string
        }
        Insert: {
          check_name: string
          created_at?: string
          delta?: number | null
          detail?: Json
          hero_value?: number | null
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          table_value?: number | null
          updated_at?: string
          week_start: string
        }
        Update: {
          check_name?: string
          created_at?: string
          delta?: number | null
          detail?: Json
          hero_value?: number | null
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          table_value?: number | null
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_report: {
        Row: {
          generated_at: string
          is_provisional: boolean
          payload: Json
          week_end: string
          week_start: string
        }
        Insert: {
          generated_at?: string
          is_provisional?: boolean
          payload: Json
          week_end: string
          week_start: string
        }
        Update: {
          generated_at?: string
          is_provisional?: boolean
          payload?: Json
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_report_archive: {
        Row: {
          archived_at: string
          payload: Json
          week_end: string
          week_start: string
        }
        Insert: {
          archived_at?: string
          payload: Json
          week_end: string
          week_start: string
        }
        Update: {
          archived_at?: string
          payload?: Json
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agent_rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
        }[]
      }
      agent_usage_increment: {
        Args: { p_day: string; p_tokens: number }
        Returns: undefined
      }
      bed_label_sort_index: { Args: { label: string }; Returns: number }
      canonical_bed_label: { Args: { raw: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_canonical_bed_label: { Args: { raw: string }; Returns: boolean }
      normalize_bed_series: { Args: { series: Json }; Returns: Json }
      normalize_report_bed_labels: { Args: { payload: Json }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "staff"
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
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
