export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          changes: NonNullable<Json>;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          org_id: string;
          txid: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          changes: NonNullable<Json>;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          org_id: string;
          txid?: number;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          changes?: NonNullable<Json>;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          org_id?: string;
          txid?: number;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          org_id: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["org_role"];
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          min_rest_hours: number;
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          min_rest_hours?: number;
          name: string;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          min_rest_hours?: number;
          name?: string;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rotation_pattern_days: {
        Row: {
          day_index: number;
          org_id: string;
          pattern_id: string;
          shift_type_id: string;
        };
        ComputedFields: never;
        Insert: {
          day_index: number;
          org_id: string;
          pattern_id: string;
          shift_type_id: string;
        };
        Update: {
          day_index?: number;
          org_id?: string;
          pattern_id?: string;
          shift_type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rotation_pattern_days_pattern_id_org_id_fkey";
            columns: ["pattern_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "rotation_patterns";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "rotation_pattern_days_shift_type_id_org_id_fkey";
            columns: ["shift_type_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id", "org_id"];
          },
        ];
      };
      rotation_patterns: {
        Row: {
          created_at: string;
          cycle_length: number;
          id: string;
          name: string;
          org_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          cycle_length: number;
          id?: string;
          name: string;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cycle_length?: number;
          id?: string;
          name?: string;
          org_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rotation_patterns_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      schedules: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          org_id: string;
          period_end: string;
          period_start: string;
          published_at: string | null;
          status: Database["public"]["Enums"]["schedule_status"];
          team_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          org_id: string;
          period_end: string;
          period_start: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["schedule_status"];
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          org_id?: string;
          period_end?: string;
          period_start?: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["schedule_status"];
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_team_id_org_id_fkey";
            columns: ["team_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "org_id"];
          },
        ];
      };
      shift_types: {
        Row: {
          color: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          name: string;
          org_id: string;
          start_time: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          duration_minutes: number;
          id?: string;
          name: string;
          org_id: string;
          start_time: string;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          name?: string;
          org_id?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shift_types_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          org_id: string;
          schedule_id: string;
          shift_type_id: string | null;
          starts_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          org_id: string;
          schedule_id: string;
          shift_type_id?: string | null;
          starts_at: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          org_id?: string;
          schedule_id?: string;
          shift_type_id?: string | null;
          starts_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_schedule_id_org_id_fkey";
            columns: ["schedule_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "schedules";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "shifts_shift_type_id_org_id_fkey";
            columns: ["shift_type_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "shifts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          created_at: string;
          org_id: string;
          team_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          team_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          team_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_org_id_user_id_fkey";
            columns: ["org_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["org_id", "user_id"];
          },
          {
            foreignKeyName: "team_members_team_id_org_id_fkey";
            columns: ["team_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "org_id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          org_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          org_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      time_off: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          kind: Database["public"]["Enums"]["time_off_kind"];
          org_id: string;
          requested_by: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["time_off_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          kind: Database["public"]["Enums"]["time_off_kind"];
          org_id: string;
          requested_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["time_off_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["time_off_kind"];
          org_id?: string;
          requested_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["time_off_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_off_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_off_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_off_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_off_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      create_invitation: {
        Args: {
          p_email: string;
          p_org_id: string;
          p_role?: Database["public"]["Enums"]["org_role"];
        };
        Returns: {
          invitation_email: string;
          invitation_expires_at: string;
          invitation_id: string;
          invitation_role: Database["public"]["Enums"]["org_role"];
          token: string;
        }[];
      };
      create_organization: {
        Args: { p_name: string; p_slug: string; p_timezone?: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          min_rest_hours: number;
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          email: string;
          organization_name: string;
          role: Database["public"]["Enums"]["org_role"];
          status: string;
        }[];
      };
      replace_schedule_shifts: {
        Args: {
          p_delete_ids?: string[];
          p_schedule_id: string;
          p_shifts: Json;
        };
        Returns: number;
      };
      save_rotation_pattern: {
        Args: {
          p_days: string[];
          p_name: string;
          p_org_id: string;
          p_pattern_id?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      org_role: "admin" | "manager" | "member";
      schedule_status: "draft" | "published";
      time_off_kind: "vacation" | "medical" | "leave" | "other";
      time_off_status: "pending" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      org_role: ["admin", "manager", "member"],
      schedule_status: ["draft", "published"],
      time_off_kind: ["vacation", "medical", "leave", "other"],
      time_off_status: ["pending", "approved", "rejected"],
    },
  },
} as const;
