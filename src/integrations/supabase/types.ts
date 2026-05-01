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
      couriers: {
        Row: {
          address: string | null
          ai_validation: Json
          backpack_url: string | null
          circulation_url: string | null
          created_at: string
          has_backpack: boolean
          id: string
          ine_back_url: string | null
          ine_front_url: string | null
          lat: number | null
          license_url: string | null
          lng: number | null
          moto_url: string | null
          plan: Database["public"]["Enums"]["courier_plan"]
          plate: string | null
          plate_url: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["courier_status"]
          subscription_active: boolean
          subscription_expires_at: string | null
          updated_at: string
          user_id: string
          wallet_balance: number
          willing_to_get_backpack: boolean
        }
        Insert: {
          address?: string | null
          ai_validation?: Json
          backpack_url?: string | null
          circulation_url?: string | null
          created_at?: string
          has_backpack?: boolean
          id?: string
          ine_back_url?: string | null
          ine_front_url?: string | null
          lat?: number | null
          license_url?: string | null
          lng?: number | null
          moto_url?: string | null
          plan?: Database["public"]["Enums"]["courier_plan"]
          plate?: string | null
          plate_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          subscription_active?: boolean
          subscription_expires_at?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number
          willing_to_get_backpack?: boolean
        }
        Update: {
          address?: string | null
          ai_validation?: Json
          backpack_url?: string | null
          circulation_url?: string | null
          created_at?: string
          has_backpack?: boolean
          id?: string
          ine_back_url?: string | null
          ine_front_url?: string | null
          lat?: number | null
          license_url?: string | null
          lng?: number | null
          moto_url?: string | null
          plan?: Database["public"]["Enums"]["courier_plan"]
          plate?: string | null
          plate_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          subscription_active?: boolean
          subscription_expires_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number
          willing_to_get_backpack?: boolean
        }
        Relationships: []
      }
      orders: {
        Row: {
          accepted_at: string | null
          amount_to_collect: number
          courier_id: string | null
          created_at: string
          delivered_at: string | null
          delivered_lat: number | null
          delivered_lng: number | null
          delivery_proof_url: string | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          external_order_id: string | null
          id: string
          notes: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          accepted_at?: string | null
          amount_to_collect?: number
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_lat?: number | null
          delivered_lng?: number | null
          delivery_proof_url?: string | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          external_order_id?: string | null
          id?: string
          notes?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          accepted_at?: string | null
          amount_to_collect?: number
          courier_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_lat?: number | null
          delivered_lng?: number | null
          delivery_proof_url?: string | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          external_order_id?: string | null
          id?: string
          notes?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country_code: string
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          phone_dial_code: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          phone_dial_code?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_dial_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string
          category: string
          created_at: string
          facade_url: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          category: string
          created_at?: string
          facade_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          category?: string
          created_at?: string
          facade_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          courier_id: string
          created_at: string
          expires_at: string
          id: string
          started_at: string
          status: string
        }
        Insert: {
          amount?: number
          courier_id: string
          created_at?: string
          expires_at: string
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          amount?: number
          courier_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          courier_id: string
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Insert: {
          amount: number
          balance_after?: number | null
          courier_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Update: {
          amount?: number
          balance_after?: number | null
          courier_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      restaurant_owns_order_for_courier: {
        Args: { _courier_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "restaurant" | "courier" | "admin"
      courier_plan: "pps" | "subscription"
      courier_status: "pending_validation" | "active" | "rejected" | "suspended"
      order_status:
        | "pending"
        | "assigned"
        | "in_transit"
        | "delivered"
        | "cancelled"
      wallet_tx_type: "topup" | "order_fee" | "subscription_charge" | "refund"
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
      app_role: ["restaurant", "courier", "admin"],
      courier_plan: ["pps", "subscription"],
      courier_status: ["pending_validation", "active", "rejected", "suspended"],
      order_status: [
        "pending",
        "assigned",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      wallet_tx_type: ["topup", "order_fee", "subscription_charge", "refund"],
    },
  },
} as const
