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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount: number
          created_at: string
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          lead_id: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          customer_id: string
          id: string
          payment_id: string
          redeemed_at: string
        }
        Insert: {
          coupon_id: string
          customer_id: string
          id?: string
          payment_id: string
          redeemed_at?: string
        }
        Update: {
          coupon_id?: string
          customer_id?: string
          id?: string
          payment_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expiry_date: string | null
          id: string
          max_uses: number | null
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          uses_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          max_uses?: number | null
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          uses_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          max_uses?: number | null
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Relationships: []
      }
      customer_plans: {
        Row: {
          created_at: string
          customer_id: string
          expiry_date: string
          id: string
          plan_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expiry_date: string
          id?: string
          plan_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expiry_date?: string
          id?: string
          plan_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          created_at: string
          id: string
          installation_date: string | null
          lead_id: string | null
          name: string
          partner_id: string | null
          phone: string
          pincode: string
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          installation_date?: string | null
          lead_id?: string | null
          name: string
          partner_id?: string | null
          phone: string
          pincode: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          installation_date?: string | null
          lead_id?: string | null
          name?: string
          partner_id?: string | null
          phone?: string
          pincode?: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      install_tickets: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          partner_id: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["install_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          partner_id?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["install_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          partner_id?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["install_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "install_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "install_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "install_tickets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string
          created_at: string
          id: string
          name: string
          next_followup_date: string | null
          notes: string | null
          owner: string | null
          phone: string
          pincode: string
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          name: string
          next_followup_date?: string | null
          notes?: string | null
          owner?: string | null
          phone: string
          pincode: string
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          name?: string
          next_followup_date?: string | null
          notes?: string | null
          owner?: string | null
          phone?: string
          pincode?: string
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          coupon_id: string | null
          created_at: string
          customer_id: string
          date: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          original_amount: number | null
          plan_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          coupon_id?: string | null
          created_at?: string
          customer_id: string
          date?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          original_amount?: number | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          coupon_id?: string | null
          created_at?: string
          customer_id?: string
          date?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          original_amount?: number | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          speed_mbps: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price: number
          speed_mbps: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          speed_mbps?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      serviceable_areas: {
        Row: {
          area_name: string
          created_at: string
          id: string
          is_active: boolean
          partner_id: string | null
          pincode: string
          updated_at: string
        }
        Insert: {
          area_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          partner_id?: string | null
          pincode: string
          updated_at?: string
        }
        Update: {
          area_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          partner_id?: string | null
          pincode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serviceable_areas_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          assignment_type: Database["public"]["Enums"]["ticket_assignment_type"]
          created_at: string
          id: string
          name: string
        }
        Insert: {
          assignment_type?: Database["public"]["Enums"]["ticket_assignment_type"]
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          assignment_type?: Database["public"]["Enums"]["ticket_assignment_type"]
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_to_type:
            | Database["public"]["Enums"]["ticket_assignment_type"]
            | null
          category_id: string | null
          created_at: string
          customer_id: string
          description: string
          id: string
          internal_queue: string | null
          partner_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          updated_at: string
        }
        Insert: {
          assigned_to_type?:
            | Database["public"]["Enums"]["ticket_assignment_type"]
            | null
          category_id?: string | null
          created_at?: string
          customer_id: string
          description: string
          id?: string
          internal_queue?: string | null
          partner_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
        }
        Update: {
          assigned_to_type?:
            | Database["public"]["Enums"]["ticket_assignment_type"]
            | null
          category_id?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          id?: string
          internal_queue?: string | null
          partner_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
      waitlist: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string
          pincode: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          phone: string
          pincode: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string
          pincode?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_partner_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "partner"
      booking_status: "Paid" | "Pending" | "Failed"
      coupon_type: "percentage" | "flat"
      customer_status: "Active" | "Suspended" | "Churned"
      install_status: "Open" | "In Progress" | "Installed" | "Verified"
      lead_stage:
        | "New"
        | "Contacted"
        | "Scheduled Installation"
        | "Installed"
        | "Lost"
      payment_method: "Cash" | "UPI" | "Card" | "Bank Transfer" | "Other"
      payment_status: "Paid" | "Failed" | "Pending"
      ticket_assignment_type: "Partner" | "Internal"
      ticket_priority: "Low" | "Medium" | "High" | "Critical"
      ticket_status: "Open" | "In Progress" | "Resolved" | "Closed"
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
      app_role: ["admin", "partner"],
      booking_status: ["Paid", "Pending", "Failed"],
      coupon_type: ["percentage", "flat"],
      customer_status: ["Active", "Suspended", "Churned"],
      install_status: ["Open", "In Progress", "Installed", "Verified"],
      lead_stage: [
        "New",
        "Contacted",
        "Scheduled Installation",
        "Installed",
        "Lost",
      ],
      payment_method: ["Cash", "UPI", "Card", "Bank Transfer", "Other"],
      payment_status: ["Paid", "Failed", "Pending"],
      ticket_assignment_type: ["Partner", "Internal"],
      ticket_priority: ["Low", "Medium", "High", "Critical"],
      ticket_status: ["Open", "In Progress", "Resolved", "Closed"],
    },
  },
} as const
