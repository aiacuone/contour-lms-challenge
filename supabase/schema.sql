-- The whole public schema in one file, for reading only. Generated from the
-- local database by `npm run db:schema`; do not edit it by hand.
-- The migrations in supabase/migrations are the source of truth.
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."consultation_status" AS ENUM (
    'booked',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."consultation_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_consultations"() RETURNS TABLE("id" "uuid", "student_id" "uuid", "student_email" "text", "first_name" "text", "last_name" "text", "reason" "text", "scheduled_at" timestamp with time zone, "status" "public"."consultation_status", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    c.id,
    c.student_id,
    u.email::text,
    c.first_name,
    c.last_name,
    c.reason,
    c.scheduled_at,
    c.status,
    c.created_at,
    c.updated_at
  from public.consultations as c
  join auth.users as u on u.id = c.student_id
  -- security definer skips RLS, so the admin check is done here: anyone
  -- else gets no rows.
  where public.is_admin()
  order by c.scheduled_at desc;
$$;


ALTER FUNCTION "public"."admin_consultations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_consultations"() IS 'Every consultation with the student''s email, newest first. Returns rows only to admins.';



CREATE OR REPLACE FUNCTION "public"."enforce_consultation_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'booked' then
      raise exception 'New consultations must start as booked.'
        using errcode = 'P0001';
    end if;
    if new.scheduled_at <= now() then
      raise exception 'Consultation must be in the future.'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'cancelled' then
    raise exception 'Cancelled consultations can''t be changed.'
      using errcode = 'P0001';
  end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    if old.status <> 'booked' then
      raise exception 'Only booked consultations can be rescheduled.'
        using errcode = 'P0001';
    end if;
    if new.scheduled_at <= now() then
      raise exception 'Consultation must be in the future.'
        using errcode = 'P0001';
    end if;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'booked' and new.status in ('completed', 'cancelled'))
      or (old.status = 'completed' and new.status = 'booked')
    ) then
      if new.status = 'cancelled' then
        raise exception 'Only booked consultations can be cancelled.'
          using errcode = 'P0001';
      end if;
      raise exception 'That status change isn''t allowed.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_consultation_rules"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_consultation_rules"() IS 'Rejects invalid consultation changes: past times, changes to cancelled consultations and status moves outside booked/completed/cancelled rules.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'True when the logged-in user has the admin role. Used by RLS policies and the admin API route.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."consultations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "status" "public"."consultation_status" DEFAULT 'booked'::"public"."consultation_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "consultations_first_name_check" CHECK ((("char_length"("first_name") >= 1) AND ("char_length"("first_name") <= 80))),
    CONSTRAINT "consultations_last_name_check" CHECK ((("char_length"("last_name") >= 1) AND ("char_length"("last_name") <= 80))),
    CONSTRAINT "consultations_reason_check" CHECK ((("char_length"("reason") >= 1) AND ("char_length"("reason") <= 500)))
);


ALTER TABLE "public"."consultations" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultations" IS 'Consultations booked by students. Cancelled ones are kept (soft cancel).';



COMMENT ON COLUMN "public"."consultations"."student_id" IS 'The student who booked it. Set from the logged-in user.';



COMMENT ON COLUMN "public"."consultations"."scheduled_at" IS 'When the consultation happens. Changed only by booking or rescheduling.';



COMMENT ON COLUMN "public"."consultations"."status" IS 'Current state: booked (not yet complete), completed or cancelled. Set only by the API routes.';



COMMENT ON COLUMN "public"."consultations"."created_at" IS 'When it was booked. Never changes.';



COMMENT ON COLUMN "public"."consultations"."updated_at" IS 'When the row last changed, by anything. Not used as a completion or cancellation time.';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Roles granted to users. No row means the user is a student. Users can read their own rows and cannot write any.';



COMMENT ON COLUMN "public"."user_roles"."created_at" IS 'When the role was granted. Never changes.';



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role");



CREATE INDEX "consultations_scheduled_at_idx" ON "public"."consultations" USING "btree" ("scheduled_at" DESC);



CREATE INDEX "consultations_student_id_scheduled_at_idx" ON "public"."consultations" USING "btree" ("student_id", "scheduled_at");



CREATE OR REPLACE TRIGGER "consultations_enforce_rules" BEFORE INSERT OR UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_consultation_rules"();



CREATE OR REPLACE TRIGGER "consultations_set_updated_at" BEFORE UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Students book consultations for themselves" ON "public"."consultations" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Students change their own consultations" ON "public"."consultations" FOR UPDATE TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Students read their own consultations and admins read all" ON "public"."consultations" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users can read their own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."consultations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_consultations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_consultations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_consultations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_consultation_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_consultation_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_consultation_rules"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON TABLE "public"."consultations" TO "service_role";
GRANT SELECT ON TABLE "public"."consultations" TO "authenticated";



GRANT INSERT("first_name") ON TABLE "public"."consultations" TO "authenticated";



GRANT INSERT("last_name") ON TABLE "public"."consultations" TO "authenticated";



GRANT INSERT("reason") ON TABLE "public"."consultations" TO "authenticated";



GRANT INSERT("scheduled_at"),UPDATE("scheduled_at") ON TABLE "public"."consultations" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."consultations" TO "authenticated";



GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







