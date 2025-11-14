// Configuração do Supabase. Este módulo expõe um cliente pronto para ser
// importado em outros arquivos. Use as chaves do seu projeto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// URL e chave pública anônima do projeto Supabase (API → anon public)
const SUPABASE_URL = "https://tsdrlbkrkjaxzpdxtmoa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZHJsYmtya2pheHpwZHh0bW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjY0NjYsImV4cCI6MjA3NzcwMjQ2Nn0.Jx0ot29QIb2bi-wcTL6T69J6oBHoEFbR237Rtf3MO0g";

// Instância do Supabase Client para ser usada em todo o app.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Também exporta as constantes caso precise delas em outro lugar
export { SUPABASE_URL, SUPABASE_ANON_KEY };