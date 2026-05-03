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
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
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
          location_updated_at: string | null
          moto_url: string | null
          plan: Database["public"]["Enums"]["courier_plan"]
          plate: string | null
          plate_url: string | null
          rejection_reason: string | null
          stats_avg_minutes: number
          stats_cancelled: number
          stats_on_time_deliveries: number
          stats_score: number
          stats_total_deliveries: number
          status: Database["public"]["Enums"]["courier_status"]
          subscription_active: boolean
          subscription_expires_at: string | null
          updated_at: string
          user_id: string
          wallet_balance: number
          willing_to_get_backpack: boolean
          zone_id: string | null
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
          location_updated_at?: string | null
          moto_url?: string | null
          plan?: Database["public"]["Enums"]["courier_plan"]
          plate?: string | null
          plate_url?: string | null
          rejection_reason?: string | null
          stats_avg_minutes?: number
          stats_cancelled?: number
          stats_on_time_deliveries?: number
          stats_score?: number
          stats_total_deliveries?: number
          status?: Database["public"]["Enums"]["courier_status"]
          subscription_active?: boolean
          subscription_expires_at?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number
          willing_to_get_backpack?: boolean
          zone_id?: string | null
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
          location_updated_at?: string | null
          moto_url?: string | null
          plan?: Database["public"]["Enums"]["courier_plan"]
          plate?: string | null
          plate_url?: string | null
          rejection_reason?: string | null
          stats_avg_minutes?: number
          stats_cancelled?: number
          stats_on_time_deliveries?: number
          stats_score?: number
          stats_total_deliveries?: number
          status?: Database["public"]["Enums"]["courier_status"]
          subscription_active?: boolean
          subscription_expires_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number
          willing_to_get_backpack?: boolean
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "operational_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      operational_zones: {
        Row: {
          active: boolean
          base_fee_multiplier: number
          bbox_max_lat: number
          bbox_max_lng: number
          bbox_min_lat: number
          bbox_min_lng: number
          city: string
          country_code: string
          created_at: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_fee_multiplier?: number
          bbox_max_lat: number
          bbox_max_lng: number
          bbox_min_lat: number
          bbox_min_lng: number
          city: string
          country_code?: string
          created_at?: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_fee_multiplier?: number
          bbox_max_lat?: number
          bbox_max_lng?: number
          bbox_min_lat?: number
          bbox_min_lng?: number
          city?: string
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id: string
          sender_id: string
          sender_role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          amount_to_collect: number
          batch_id: string | null
          courier_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          customer_phone_dial_code: string
          delivered_at: string | null
          delivered_lat: number | null
          delivered_lng: number | null
          delivery_proof_url: string | null
          distance_km: number | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          eta_minutes: number | null
          external_order_id: string | null
          id: string
          notes: string | null
          picked_up_at: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          pos_integration_id: string | null
          restaurant_id: string
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          tracking_token: string | null
          zone_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount_to_collect?: number
          batch_id?: string | null
          courier_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone_dial_code?: string
          delivered_at?: string | null
          delivered_lat?: number | null
          delivered_lng?: number | null
          delivery_proof_url?: string | null
          distance_km?: number | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          eta_minutes?: number | null
          external_order_id?: string | null
          id?: string
          notes?: string | null
          picked_up_at?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pos_integration_id?: string | null
          restaurant_id: string
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          tracking_token?: string | null
          zone_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount_to_collect?: number
          batch_id?: string | null
          courier_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone_dial_code?: string
          delivered_at?: string | null
          delivered_lat?: number | null
          delivered_lng?: number | null
          delivery_proof_url?: string | null
          distance_km?: number | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          eta_minutes?: number | null
          external_order_id?: string | null
          id?: string
          notes?: string | null
          picked_up_at?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pos_integration_id?: string | null
          restaurant_id?: string
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          tracking_token?: string | null
          zone_id?: string | null
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
            foreignKeyName: "orders_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "operational_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_integrations: {
        Row: {
          active: boolean
          api_key_hash: string
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          restaurant_id: string
        }
        Insert: {
          active?: boolean
          api_key_hash: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          restaurant_id: string
        }
        Update: {
          active?: boolean
          api_key_hash?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_integrations_restaurant_id_fkey"
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
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_by_user_id: string | null
          reward_granted: boolean
          reward_granted_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_by_user_id?: string | null
          reward_granted?: boolean
          reward_granted_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_by_user_id?: string | null
          reward_granted?: boolean
          reward_granted_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string
          category: string | null
          created_at: string
          facade_url: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string
          updated_at: string
          user_id: string
          zone_id: string | null
        }
        Insert: {
          address: string
          category?: string | null
          created_at?: string
          facade_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone: string
          updated_at?: string
          user_id: string
          zone_id?: string | null
        }
        Update: {
          address?: string
          category?: string | null
          created_at?: string
          facade_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "operational_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkout_sessions: {
        Row: {
          amount_cents: number
          courier_id: string | null
          created_at: string
          currency: string
          environment: string
          id: string
          price_id: string
          processed_at: string | null
          purpose: string
          status: string
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          courier_id?: string | null
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          price_id: string
          processed_at?: string | null
          purpose: string
          status?: string
          stripe_session_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          courier_id?: string | null
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          price_id?: string
          processed_at?: string | null
          purpose?: string
          status?: string
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
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
      support_conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      calculate_shipping_fee: {
        Args: { _distance_km: number; _requested_at?: string }
        Returns: {
          base_fee: number
          surge_multiplier: number
          surge_reason: string
          total_fee: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_zone_for_point: {
        Args: { _lat: number; _lng: number }
        Returns: string
      }
      generate_referral_code: { Args: never; Returns: string }
      get_available_orders: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          distance_km: number
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          restaurant_id: string
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      get_courier_stats: {
        Args: { _courier_id: string }
        Returns: {
          avg_minutes: number
          full_name: string
          on_time_deliveries: number
          score: number
          total_deliveries: number
        }[]
      }
      get_public_tracking: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          courier_lat: number
          courier_lng: number
          courier_name: string
          courier_score: number
          created_at: string
          delivered_at: string
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          eta_minutes: number
          location_updated_at: string
          picked_up_at: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          restaurant_name: string
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_participant: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      restaurant_owns_order_for_courier: {
        Args: { _courier_id: string; _user_id: string }
        Returns: boolean
      }
      validate_referral_code: { Args: { _code: string }; Returns: boolean }
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
