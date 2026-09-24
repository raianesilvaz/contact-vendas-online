-- Sessão criptografada do conector WhatsApp BETA.
-- O bucket permanece privado e só pode ser acessado pelo conector com a chave
-- secreta do servidor. Nenhuma política para anon/authenticated é criada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-connector-private',
  'whatsapp-connector-private',
  false,
  1048576,
  array['application/octet-stream']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
