// GERADO por scripts/gerar-tipos-supabase.mjs (npm run tipos:supabase) — não editar à mão.
// Fonte: OpenAPI do PostgREST do projeto. Rode de novo após cada migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      _baseline_efetivo: {
        Row: {
          afastados: number | null
          ativos: number | null
          custo_ativos: number | null
          desligados: number | null
          setor: string | null
        }
        Insert: {
          afastados?: number | null
          ativos?: number | null
          custo_ativos?: number | null
          desligados?: number | null
          setor?: string | null
        }
        Update: {
          afastados?: number | null
          ativos?: number | null
          custo_ativos?: number | null
          desligados?: number | null
          setor?: string | null
        }
        Relationships: []
      }
      _baseline_faltas: {
        Row: {
          faltas_julho: number | null
          setor: string | null
        }
        Insert: {
          faltas_julho?: number | null
          setor?: string | null
        }
        Update: {
          faltas_julho?: number | null
          setor?: string | null
        }
        Relationships: []
      }
      _stg_efetivo: {
        Row: {
          adicional_noturno: number | null
          ajuda_custo: number | null
          alimentacao: number | null
          cargo: string | null
          nome: string | null
          passagem: number | null
          salario: number | null
          setor: string | null
          total: number | null
        }
        Insert: {
          adicional_noturno?: number | null
          ajuda_custo?: number | null
          alimentacao?: number | null
          cargo?: string | null
          nome?: string | null
          passagem?: number | null
          salario?: number | null
          setor?: string | null
          total?: number | null
        }
        Update: {
          adicional_noturno?: number | null
          ajuda_custo?: number | null
          alimentacao?: number | null
          cargo?: string | null
          nome?: string | null
          passagem?: number | null
          salario?: number | null
          setor?: string | null
          total?: number | null
        }
        Relationships: []
      }
      areas: {
        Row: {
          created_at: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          antes: Json | null
          depois: Json | null
          em: string
          email: string | null
          id: number
          operacao: string
          registro: string | null
          tabela: string
          usuario: string | null
        }
        Insert: {
          antes?: Json | null
          depois?: Json | null
          em?: string
          email?: string | null
          id: number
          operacao: string
          registro?: string | null
          tabela: string
          usuario?: string | null
        }
        Update: {
          antes?: Json | null
          depois?: Json | null
          em?: string
          email?: string | null
          id?: number
          operacao?: string
          registro?: string | null
          tabela?: string
          usuario?: string | null
        }
        Relationships: []
      }
      backup_receitas_desc_20260929: {
        Row: {
          created_at: string | null
          data: string | null
          fornecedor_id: string | null
          id: string | null
          minimo_aplicado: number | null
          observacao: string | null
          peso_kg: number | null
          preco_por_tonelada: number | null
          preco_por_unidade: number | null
          quantidade: number | null
          receita: number | null
          tipo: Database["public"]["Enums"]["descarregamento_tipo"] | null
        }
        Insert: {
          created_at?: string | null
          data?: string | null
          fornecedor_id?: string | null
          id?: string | null
          minimo_aplicado?: number | null
          observacao?: string | null
          peso_kg?: number | null
          preco_por_tonelada?: number | null
          preco_por_unidade?: number | null
          quantidade?: number | null
          receita?: number | null
          tipo?: Database["public"]["Enums"]["descarregamento_tipo"] | null
        }
        Update: {
          created_at?: string | null
          data?: string | null
          fornecedor_id?: string | null
          id?: string | null
          minimo_aplicado?: number | null
          observacao?: string | null
          peso_kg?: number | null
          preco_por_tonelada?: number | null
          preco_por_unidade?: number | null
          quantidade?: number | null
          receita?: number | null
          tipo?: Database["public"]["Enums"]["descarregamento_tipo"] | null
        }
        Relationships: []
      }
      backup_receitas_diario_20260929: {
        Row: {
          created_at: string | null
          data: string | null
          descarregos: number | null
          id: string | null
          observacao: string | null
          peso_kg: number | null
          qtd_batido: number | null
          qtd_pal_rem: number | null
          qtd_paletizado: number | null
          qtd_volume: number | null
          receita: number | null
        }
        Insert: {
          created_at?: string | null
          data?: string | null
          descarregos?: number | null
          id?: string | null
          observacao?: string | null
          peso_kg?: number | null
          qtd_batido?: number | null
          qtd_pal_rem?: number | null
          qtd_paletizado?: number | null
          qtd_volume?: number | null
          receita?: number | null
        }
        Update: {
          created_at?: string | null
          data?: string | null
          descarregos?: number | null
          id?: string | null
          observacao?: string | null
          peso_kg?: number | null
          qtd_batido?: number | null
          qtd_pal_rem?: number | null
          qtd_paletizado?: number | null
          qtd_volume?: number | null
          receita?: number | null
        }
        Relationships: []
      }
      calendario_rotas: {
        Row: {
          aliases: string[]
          cidade: string
          dia_limite_pedido: string | null
          dia_saida_rota: string[]
          grupo_rota: string | null
          id: number
          janela_entrega: string[]
          observacao: string | null
          regiao_operacional: string | null
          rota: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          aliases: string[]
          cidade: string
          dia_limite_pedido?: string | null
          dia_saida_rota: string[]
          grupo_rota?: string | null
          id: number
          janela_entrega: string[]
          observacao?: string | null
          regiao_operacional?: string | null
          rota?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          cidade?: string
          dia_limite_pedido?: string | null
          dia_saida_rota?: string[]
          grupo_rota?: string | null
          id?: number
          janela_entrega?: string[]
          observacao?: string | null
          regiao_operacional?: string | null
          rota?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      config_descarregamento: {
        Row: {
          atualizado_em: string
          id: boolean
          valor_minimo: number
        }
        Insert: {
          atualizado_em?: string
          id?: boolean
          valor_minimo?: number
        }
        Update: {
          atualizado_em?: string
          id?: boolean
          valor_minimo?: number
        }
        Relationships: []
      }
      custos_fixos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          valor?: number
        }
        Relationships: []
      }
      custos_mensais: {
        Row: {
          created_at: string
          data: string | null
          id: string
          mes: string
          nome: string
          tipo: Database["public"]["Enums"]["custo_tipo"]
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string | null
          id?: string
          mes: string
          nome: string
          tipo: Database["public"]["Enums"]["custo_tipo"]
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string | null
          id?: string
          mes?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["custo_tipo"]
          valor?: number
        }
        Relationships: []
      }
      descarregos_carros_dia: {
        Row: {
          atualizado_em: string
          data: string
          qtd_batido: number
          qtd_pal_rem: number
          qtd_paletizado: number
          qtd_volume: number
        }
        Insert: {
          atualizado_em?: string
          data: string
          qtd_batido?: number
          qtd_pal_rem?: number
          qtd_paletizado?: number
          qtd_volume?: number
        }
        Update: {
          atualizado_em?: string
          data?: string
          qtd_batido?: number
          qtd_pal_rem?: number
          qtd_paletizado?: number
          qtd_volume?: number
        }
        Relationships: []
      }
      efetivo_mensal_cargo: {
        Row: {
          ativos: number
          atualizado_em: string
          criado_em: string
          custo_ativos: number
          filial: string
          grupo: string
          mes: string
          setor: string
        }
        Insert: {
          ativos?: number
          atualizado_em?: string
          criado_em?: string
          custo_ativos?: number
          filial?: string
          grupo: string
          mes: string
          setor: string
        }
        Update: {
          ativos?: number
          atualizado_em?: string
          criado_em?: string
          custo_ativos?: number
          filial?: string
          grupo?: string
          mes?: string
          setor?: string
        }
        Relationships: []
      }
      efetivo_mensal_setor: {
        Row: {
          afastados: number
          ativos: number
          atualizado_em: string
          criado_em: string
          custo_ativos: number
          desligados: number
          filial: string
          mes: string
          setor: string
        }
        Insert: {
          afastados?: number
          ativos?: number
          atualizado_em?: string
          criado_em?: string
          custo_ativos?: number
          desligados?: number
          filial?: string
          mes: string
          setor: string
        }
        Update: {
          afastados?: number
          ativos?: number
          atualizado_em?: string
          criado_em?: string
          custo_ativos?: number
          desligados?: number
          filial?: string
          mes?: string
          setor?: string
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          ativo: boolean
          criado_em: string
          custo_unitario: number
          id: string
          nome: string
          quantidade: number
          setor: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          custo_unitario?: number
          id?: string
          nome: string
          quantidade?: number
          setor?: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          custo_unitario?: number
          id?: string
          nome?: string
          quantidade?: number
          setor?: string
          tipo?: string
        }
        Relationships: []
      }
      faltas: {
        Row: {
          created_at: string
          data: string
          funcionario_id: string
          id: string
          observacao: string | null
          tipo: Database["public"]["Enums"]["tipo_falta"]
        }
        Insert: {
          created_at?: string
          data: string
          funcionario_id: string
          id?: string
          observacao?: string | null
          tipo: Database["public"]["Enums"]["tipo_falta"]
        }
        Update: {
          created_at?: string
          data?: string
          funcionario_id?: string
          id?: string
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_falta"]
        }
        Relationships: [
          {
            foreignKeyName: "faltas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamento_mensal: {
        Row: {
          atendimentos: number | null
          criado_em: string
          devolvidas: number
          devolvidas_avulsas: number
          emitidas: number
          filial: string
          mes: string
          peso_devolucao: number
          peso_faturado: number
          positivados: number
          valor_devolucao: number
          valor_devolucao_avulsa: number
          venda_faturada: number
          venda_liquida: number
        }
        Insert: {
          atendimentos?: number | null
          criado_em?: string
          devolvidas?: number
          devolvidas_avulsas?: number
          emitidas?: number
          filial?: string
          mes: string
          peso_devolucao?: number
          peso_faturado?: number
          positivados?: number
          valor_devolucao?: number
          valor_devolucao_avulsa?: number
          venda_faturada?: number
          venda_liquida?: number
        }
        Update: {
          atendimentos?: number | null
          criado_em?: string
          devolvidas?: number
          devolvidas_avulsas?: number
          emitidas?: number
          filial?: string
          mes?: string
          peso_devolucao?: number
          peso_faturado?: number
          positivados?: number
          valor_devolucao?: number
          valor_devolucao_avulsa?: number
          venda_faturada?: number
          venda_liquida?: number
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      frota_consumo_modelos: {
        Row: {
          atualizado_em: string
          km_por_litro: number
          modelo: string
        }
        Insert: {
          atualizado_em?: string
          km_por_litro: number
          modelo: string
        }
        Update: {
          atualizado_em?: string
          km_por_litro?: number
          modelo?: string
        }
        Relationships: []
      }
      frota_historico_janelas: {
        Row: {
          baixada_em: string
          inicio: string
          veiculo_id: string
        }
        Insert: {
          baixada_em?: string
          inicio: string
          veiculo_id: string
        }
        Update: {
          baixada_em?: string
          inicio?: string
          veiculo_id?: string
        }
        Relationships: []
      }
      frota_hodometro_diario: {
        Row: {
          atualizado_em: string
          dia: string
          hodometro_max_m: number | null
          hodometro_min_m: number | null
          km_gps: number | null
          leituras: number
          placa: string
          primeira_leitura: string | null
          ultima_leitura: string | null
        }
        Insert: {
          atualizado_em?: string
          dia: string
          hodometro_max_m?: number | null
          hodometro_min_m?: number | null
          km_gps?: number | null
          leituras?: number
          placa: string
          primeira_leitura?: string | null
          ultima_leitura?: string | null
        }
        Update: {
          atualizado_em?: string
          dia?: string
          hodometro_max_m?: number | null
          hodometro_min_m?: number | null
          km_gps?: number | null
          leituras?: number
          placa?: string
          primeira_leitura?: string | null
          ultima_leitura?: string | null
        }
        Relationships: []
      }
      frota_parametros: {
        Row: {
          atualizado_em: string
          desgaste_mensal: number
          id: number
          manutencao_mensal: number
          preco_diesel: number
        }
        Insert: {
          atualizado_em?: string
          desgaste_mensal?: number
          id?: number
          manutencao_mensal?: number
          preco_diesel: number
        }
        Update: {
          atualizado_em?: string
          desgaste_mensal?: number
          id?: number
          manutencao_mensal?: number
          preco_diesel?: number
        }
        Relationships: []
      }
      frota_veiculos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          modelo: string
          placa: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          modelo: string
          placa: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          modelo?: string
          placa?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "frota_veiculos_modelo_fkey"
            columns: ["modelo"]
            isOneToOne: false
            referencedRelation: "frota_consumo_modelos"
            referencedColumns: ["modelo"]
          },
        ]
      }
      funcionarios: {
        Row: {
          adicional_noturno: number | null
          ajuda_custo: number | null
          alimentacao: number | null
          cargo: string
          created_at: string
          custo_mensal: number
          data_admissao: string
          data_desligamento: string | null
          id: string
          motivo_desligamento: Database["public"]["Enums"]["motivo_desligamento"] | null
          nome: string
          passagem: number | null
          plano_saude: number | null
          premiacao: number | null
          salario_base: number | null
          setor_id: string
          status: Database["public"]["Enums"]["status_funcionario"]
          turno: string
        }
        Insert: {
          adicional_noturno?: number | null
          ajuda_custo?: number | null
          alimentacao?: number | null
          cargo: string
          created_at?: string
          custo_mensal?: number
          data_admissao: string
          data_desligamento?: string | null
          id?: string
          motivo_desligamento?: Database["public"]["Enums"]["motivo_desligamento"] | null
          nome: string
          passagem?: number | null
          plano_saude?: number | null
          premiacao?: number | null
          salario_base?: number | null
          setor_id: string
          status?: Database["public"]["Enums"]["status_funcionario"]
          turno?: string
        }
        Update: {
          adicional_noturno?: number | null
          ajuda_custo?: number | null
          alimentacao?: number | null
          cargo?: string
          created_at?: string
          custo_mensal?: number
          data_admissao?: string
          data_desligamento?: string | null
          id?: string
          motivo_desligamento?: Database["public"]["Enums"]["motivo_desligamento"] | null
          nome?: string
          passagem?: number | null
          plano_saude?: number | null
          premiacao?: number | null
          salario_base?: number | null
          setor_id?: string
          status?: Database["public"]["Enums"]["status_funcionario"]
          turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      harpia_usuarios: {
        Row: {
          atualizado_em: string
          funcionario_id: string | null
          usuario: number
        }
        Insert: {
          atualizado_em?: string
          funcionario_id?: string | null
          usuario: number
        }
        Update: {
          atualizado_em?: string
          funcionario_id?: string | null
          usuario?: number
        }
        Relationships: [
          {
            foreignKeyName: "harpia_usuarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_descarregamento: {
        Row: {
          atualizado_em: string
          preco_por_tonelada: number
          preco_por_unidade: number | null
          tipo: Database["public"]["Enums"]["descarregamento_tipo"]
        }
        Insert: {
          atualizado_em?: string
          preco_por_tonelada?: number
          preco_por_unidade?: number | null
          tipo: Database["public"]["Enums"]["descarregamento_tipo"]
        }
        Update: {
          atualizado_em?: string
          preco_por_tonelada?: number
          preco_por_unidade?: number | null
          tipo?: Database["public"]["Enums"]["descarregamento_tipo"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          area_id: string | null
          created_at: string
          email: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          area_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_descarregamento: {
        Row: {
          carro_id: string | null
          carros: number | null
          created_at: string
          data: string
          fornecedor_id: string
          id: string
          isento: boolean
          minimo_aplicado: number
          observacao: string | null
          peso_kg: number
          preco_por_tonelada: number
          preco_por_unidade: number | null
          quantidade: number | null
          receita: number
          tipo: Database["public"]["Enums"]["descarregamento_tipo"]
          valor_fechado: boolean
        }
        Insert: {
          carro_id?: string | null
          carros?: number | null
          created_at?: string
          data: string
          fornecedor_id: string
          id?: string
          isento?: boolean
          minimo_aplicado?: number
          observacao?: string | null
          peso_kg?: number
          preco_por_tonelada: number
          preco_por_unidade?: number | null
          quantidade?: number | null
          receita: number
          tipo: Database["public"]["Enums"]["descarregamento_tipo"]
          valor_fechado?: boolean
        }
        Update: {
          carro_id?: string | null
          carros?: number | null
          created_at?: string
          data?: string
          fornecedor_id?: string
          id?: string
          isento?: boolean
          minimo_aplicado?: number
          observacao?: string | null
          peso_kg?: number
          preco_por_tonelada?: number
          preco_por_unidade?: number | null
          quantidade?: number | null
          receita?: number
          tipo?: Database["public"]["Enums"]["descarregamento_tipo"]
          valor_fechado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "receitas_descarregamento_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_descarregamento_diario: {
        Row: {
          created_at: string
          data: string
          descarregos: number
          id: string
          observacao: string | null
          peso_kg: number
          qtd_batido: number | null
          qtd_pal_rem: number | null
          qtd_paletizado: number | null
          qtd_volume: number | null
          receita: number
        }
        Insert: {
          created_at?: string
          data: string
          descarregos: number
          id?: string
          observacao?: string | null
          peso_kg: number
          qtd_batido?: number | null
          qtd_pal_rem?: number | null
          qtd_paletizado?: number | null
          qtd_volume?: number | null
          receita: number
        }
        Update: {
          created_at?: string
          data?: string
          descarregos?: number
          id?: string
          observacao?: string | null
          peso_kg?: number
          qtd_batido?: number | null
          qtd_pal_rem?: number | null
          qtd_paletizado?: number | null
          qtd_volume?: number | null
          receita?: number
        }
        Relationships: []
      }
      receitas_diversas: {
        Row: {
          categoria: Database["public"]["Enums"]["receita_categoria"]
          created_at: string
          data: string
          id: string
          material: string | null
          observacao: string | null
          preco_unitario: number | null
          quantidade: number | null
          unidade: string
          valor: number
        }
        Insert: {
          categoria: Database["public"]["Enums"]["receita_categoria"]
          created_at?: string
          data: string
          id?: string
          material?: string | null
          observacao?: string | null
          preco_unitario?: number | null
          quantidade?: number | null
          unidade?: string
          valor: number
        }
        Update: {
          categoria?: Database["public"]["Enums"]["receita_categoria"]
          created_at?: string
          data?: string
          id?: string
          material?: string | null
          observacao?: string | null
          preco_unitario?: number | null
          quantidade?: number | null
          unidade?: string
          valor?: number
        }
        Relationships: []
      }
      separacao_mapas: {
        Row: {
          criado_em: string
          data: string
          funcionario_id: string
          id: string
          mapa: string
          registrado_por: string | null
        }
        Insert: {
          criado_em?: string
          data: string
          funcionario_id: string
          id?: string
          mapa: string
          registrado_por?: string | null
        }
        Update: {
          criado_em?: string
          data?: string
          funcionario_id?: string
          id?: string
          mapa?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "separacao_mapas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          area_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      _snapshot_efetivo: {
        Row: {
          afastados: number | null
          ativos: number | null
          custo_ativos: number | null
          desligados: number | null
          setor: string | null
        }
        Relationships: []
      }
      _snapshot_faltas: {
        Row: {
          faltas_julho: number | null
          setor: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      area_do_usuario: { Args: Record<PropertyKey, never>; Returns: unknown }
      frota_registrar_hodometro: { Args: { leituras: Json }; Returns: unknown }
      frota_registrar_km_gps: { Args: { km: Json }; Returns: unknown }
      is_admin: { Args: Record<PropertyKey, never>; Returns: unknown }
      pode_ver_funcionario: { Args: { p_funcionario_id: string }; Returns: unknown }
      pode_ver_setor: { Args: { p_setor_id: string }; Returns: unknown }
    }
    Enums: {
      custo_tipo: "fixo" | "variavel"
      descarregamento_tipo: "batido" | "paletizado" | "pal_rem" | "volume"
      motivo_desligamento: "pedido_demissao" | "dispensa_sem_justa_causa" | "dispensa_justa_causa" | "fim_contrato" | "termino_experiencia" | "abandono"
      receita_categoria: "reciclagem"
      status_funcionario: "ativo" | "afastado" | "desligado"
      tipo_falta: "justificada" | "injustificada" | "atestado" | "folga" | "ferias"
      user_role: "admin" | "viewer" | "rh"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
};

type Publico = Database["public"];
export type Tabela<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Row"];
export type Enum<T extends keyof Publico["Enums"]> = Publico["Enums"][T];
