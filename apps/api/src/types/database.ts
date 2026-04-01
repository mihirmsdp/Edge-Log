export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          starting_balance: number;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          starting_balance: number;
          currency?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          starting_balance?: number;
          currency?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      trades: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          symbol: string;
          asset_class: string;
          direction: string;
          entry_price: number;
          exit_price: number | null;
          stop_loss: number | null;
          take_profit: number | null;
          size: number;
          commission: number;
          risk_amount: number | null;
          gross_pnl: number | null;
          net_pnl: number | null;
          rr_multiple: number | null;
          entry_date: string;
          exit_date: string | null;
          setup_name: string | null;
          timeframe: string | null;
          session: string | null;
          emotion: string | null;
          mistakes: string | null;
          notes: string | null;
          rating: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          symbol: string;
          asset_class: string;
          direction: string;
          entry_price: number;
          exit_price?: number | null;
          stop_loss?: number | null;
          take_profit?: number | null;
          size: number;
          commission?: number;
          risk_amount?: number | null;
          gross_pnl?: number | null;
          net_pnl?: number | null;
          rr_multiple?: number | null;
          entry_date: string;
          exit_date?: string | null;
          setup_name?: string | null;
          timeframe?: string | null;
          session?: string | null;
          emotion?: string | null;
          mistakes?: string | null;
          notes?: string | null;
          rating?: number | null;
          created_at?: string;
        };
        Update: {
          account_id?: string;
          symbol?: string;
          asset_class?: string;
          direction?: string;
          entry_price?: number;
          exit_price?: number | null;
          stop_loss?: number | null;
          take_profit?: number | null;
          size?: number;
          commission?: number;
          risk_amount?: number | null;
          gross_pnl?: number | null;
          net_pnl?: number | null;
          rr_multiple?: number | null;
          entry_date?: string;
          exit_date?: string | null;
          setup_name?: string | null;
          timeframe?: string | null;
          session?: string | null;
          emotion?: string | null;
          mistakes?: string | null;
          notes?: string | null;
          rating?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      trade_screenshots: {
        Row: {
          id: string;
          trade_id: string;
          file_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trade_id: string;
          file_path: string;
          created_at?: string;
        };
        Update: {
          file_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_screenshots_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: false;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          }
        ];
      };
      playbook_setups: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          rules: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          rules: Json;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          rules?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "playbook_setups_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      postmkt_analyses: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          analysis_json: Json;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          analysis_json: Json;
          generated_at?: string;
        };
        Update: {
          date?: string;
          analysis_json?: Json;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "postmkt_analyses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      upstox_connections: {
        Row: {
          user_id: string;
          upstox_user_id: string | null;
          upstox_user_name: string | null;
          upstox_email: string | null;
          broker: string;
          access_token: string | null;
          extended_token: string | null;
          exchanges: string[];
          products: string[];
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          upstox_user_id?: string | null;
          upstox_user_name?: string | null;
          upstox_email?: string | null;
          broker?: string;
          access_token?: string | null;
          extended_token?: string | null;
          exchanges?: string[];
          products?: string[];
          connected_at?: string;
          updated_at?: string;
        };
        Update: {
          upstox_user_id?: string | null;
          upstox_user_name?: string | null;
          upstox_email?: string | null;
          broker?: string;
          access_token?: string | null;
          extended_token?: string | null;
          exchanges?: string[];
          products?: string[];
          connected_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "upstox_connections_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      premkt_analyses: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          analysis_json: Json;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          analysis_json: Json;
          generated_at?: string;
        };
        Update: {
          date?: string;
          analysis_json?: Json;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "premkt_analyses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          content: string;
          mood: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          content: string;
          mood?: string | null;
          created_at?: string;
        };
        Update: {
          date?: string;
          content?: string;
          mood?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      trade_tags: {
        Row: {
          trade_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          trade_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "trade_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_tags_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: false;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      dashboard_trade_summary: {
        Row: {
          user_id: string;
          total_trades: number;
          wins: number;
          losses: number;
          gross_profit: number;
          gross_loss: number;
          net_pnl: number;
          win_rate: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}





