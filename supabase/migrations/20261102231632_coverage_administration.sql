create extension if not exists postgis with schema extensions;
create table public.coverage_sources (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('base','city','map')),
 operator text not null check(operator in ('desktop','claro','vero','alcans')),
 city text not null default '' check(length(city)<=120),
 uf text not null default '' check(uf='' or uf ~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'),
 title text not null check(length(title) between 1 and 180),
 state text not null default 'draft' check(state in ('draft','active','inactive')),
 source_path text, filename text, sha256 text,
 chunks jsonb not null default '[]'::jsonb check(jsonb_typeof(chunks)='array'),
 summary jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
 check(kind='base' or (length(trim(city))>1 and length(uf)=2)),
 check(kind<>'map' or state<>'active' or jsonb_array_length(chunks)>0)
);
create unique index coverage_one_base on public.coverage_sources(operator) where kind='base';
create unique index coverage_one_city on public.coverage_sources(operator,lower(city),uf) where kind='city';
create index coverage_sources_state on public.coverage_sources(state,kind);
alter table public.coverage_sources enable row level security;
revoke all on public.coverage_sources from anon;
grant select,insert,update,delete on public.coverage_sources to authenticated;
create policy coverage_read on public.coverage_sources for select to authenticated using (
 (select private.current_user_role())='admin' or ((select private.current_user_role()) in ('vendedora','parceiro') and (state='active' or kind in ('base','city')))
);
create policy coverage_admin_insert on public.coverage_sources for insert to authenticated with check ((select private.current_user_role())='admin');
create policy coverage_admin_update on public.coverage_sources for update to authenticated using ((select private.current_user_role())='admin') with check ((select private.current_user_role())='admin');
create policy coverage_admin_delete on public.coverage_sources for delete to authenticated using ((select private.current_user_role())='admin' and kind<>'base');
create function public.coverage_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.updated_at=now();new.updated_by=auth.uid();
 if TG_OP='INSERT' then new.created_by=auth.uid();end if;
 return new;
end $$;
revoke all on function public.coverage_stamp() from public;
create trigger coverage_stamp before insert or update on public.coverage_sources for each row execute function public.coverage_stamp();
insert into public.coverage_sources(kind,operator,title,state) values
 ('base','desktop','Mapas atuais Desktop','active'),('base','claro','Mapas atuais Claro','active'),
 ('base','alcans','Mapas atuais Alcans','active'),('base','vero','Lista atual de cidades VERO','active');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('coverage-files','coverage-files',false,52428800,array['application/octet-stream','application/json']);
create policy coverage_files_read on storage.objects for select to authenticated using (bucket_id='coverage-files' and (
 (select private.current_user_role())='admin' or ((select private.current_user_role()) in ('vendedora','parceiro') and exists(
 select 1 from public.coverage_sources c where c.kind='map' and c.state='active' and split_part(objects.name,'/',1)=c.id::text and split_part(objects.name,'/',2)='geo'
 ))));
create policy coverage_files_insert on storage.objects for insert to authenticated with check(bucket_id='coverage-files' and (select private.current_user_role())='admin');
create policy coverage_files_delete on storage.objects for delete to authenticated using(bucket_id='coverage-files' and (select private.current_user_role())='admin');
create function public.coverage_validate_geometries(items jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; ring jsonb; g extensions.geometry; outerg extensions.geometry; holes extensions.geometry; original extensions.geometry; answer jsonb:='[]'; repaired boolean;
begin
 if auth.uid() is null or (select private.current_user_role()) is distinct from 'admin'::public.user_role then raise exception 'Acesso exclusivo de Administrador';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>100 then raise exception 'Lote de até 100 áreas';end if;
 for item in select value from jsonb_array_elements(items) loop
  original=extensions.st_geomfromgeojson(item);
  if extensions.st_geometrytype(original)<>'ST_Polygon' or extensions.st_npoints(original)>100000 then raise exception 'Área inválida ou complexa demais';end if;
  if extensions.st_xmin(original::extensions.box3d)<-180 or extensions.st_xmax(original::extensions.box3d)>180 or extensions.st_ymin(original::extensions.box3d)<-90 or extensions.st_ymax(original::extensions.box3d)>90 then raise exception 'Coordenadas inválidas';end if;
  repaired=not extensions.st_isvalid(original);
  if repaired then
   outerg=extensions.st_collectionextract(extensions.st_makevalid(extensions.st_makepolygon(extensions.st_exteriorring(original))),3);
   holes=null;
   for ring in select value from jsonb_array_elements(item->'coordinates') with ordinality as x(value,n) where n>1 loop
    g=extensions.st_collectionextract(extensions.st_makevalid(extensions.st_geomfromgeojson(jsonb_build_object('type','Polygon','coordinates',jsonb_build_array(ring)))),3);
    holes=case when holes is null then g else extensions.st_union(holes,g) end;
   end loop;
   g=case when holes is null then outerg else extensions.st_difference(outerg,holes) end;
   g=extensions.st_collectionextract(g,3);
  else g=original;end if;
  if extensions.st_isempty(g) or not extensions.st_isvalid(g) or extensions.st_area(g)<=0 then raise exception 'Contorno sem área utilizável';end if;
  answer=answer||jsonb_build_array(jsonb_build_object('geometry',extensions.st_asgeojson(g,9)::jsonb,'bbox',jsonb_build_array(extensions.st_xmin(g::extensions.box3d),extensions.st_ymin(g::extensions.box3d),extensions.st_xmax(g::extensions.box3d),extensions.st_ymax(g::extensions.box3d)),'repaired',repaired));
 end loop;
 return answer;
end $$;
revoke all on function public.coverage_validate_geometries(jsonb) from public,anon;
grant execute on function public.coverage_validate_geometries(jsonb) to authenticated;
create function public.coverage_publish(source_id uuid,replace_previous boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare current_row public.coverage_sources;
begin
 if auth.uid() is null or (select private.current_user_role()) is distinct from 'admin'::public.user_role then raise exception 'Acesso exclusivo de Administrador';end if;
 select * into current_row from public.coverage_sources where id=source_id for update;
 if not found or current_row.kind<>'map' or jsonb_array_length(current_row.chunks)=0 then raise exception 'Mapa sem áreas preparadas';end if;
 perform pg_advisory_xact_lock(hashtextextended(current_row.operator||lower(current_row.city)||current_row.uf,0));
 if replace_previous then update public.coverage_sources set state='inactive' where id<>source_id and kind='map' and operator=current_row.operator and lower(city)=lower(current_row.city) and uf=current_row.uf and state='active';end if;
 update public.coverage_sources set state='active' where id=source_id;
end $$;
revoke all on function public.coverage_publish(uuid,boolean) from public,anon;
grant execute on function public.coverage_publish(uuid,boolean) to authenticated;
