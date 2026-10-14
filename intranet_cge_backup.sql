--
-- PostgreSQL database dump
--

\restrict NVzBNGvb303laSDhf3DpgBy4TU8Kiau6eMlbJW1SV3eUOiF3BVdncbHLshvQZsN

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: cge
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO cge;

--
-- Name: account_status; Type: TYPE; Schema: public; Owner: cge
--

CREATE TYPE public.account_status AS ENUM (
    'active',
    'disabled'
);


ALTER TYPE public.account_status OWNER TO cge;

--
-- Name: asset_status; Type: TYPE; Schema: public; Owner: cge
--

CREATE TYPE public.asset_status AS ENUM (
    'active',
    'maintenance',
    'disposed'
);


ALTER TYPE public.asset_status OWNER TO cge;

--
-- Name: import_status; Type: TYPE; Schema: public; Owner: cge
--

CREATE TYPE public.import_status AS ENUM (
    'previewed',
    'processing',
    'completed',
    'failed'
);


ALTER TYPE public.import_status OWNER TO cge;

--
-- Name: vacation_status; Type: TYPE; Schema: public; Owner: cge
--

CREATE TYPE public.vacation_status AS ENUM (
    'draft',
    'submitted',
    'supervisor_approved',
    'supervisor_rejected',
    'final_approved',
    'final_rejected',
    'cancelled'
);


ALTER TYPE public.vacation_status OWNER TO cge;

--
-- Name: visit_status; Type: TYPE; Schema: public; Owner: cge
--

CREATE TYPE public.visit_status AS ENUM (
    'pending',
    'approved',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'rejected'
);


ALTER TYPE public.visit_status OWNER TO cge;

--
-- Name: visit_type; Type: TYPE; Schema: public; Owner: cge
--

CREATE TYPE public.visit_type AS ENUM (
    'institutional_meeting',
    'technical_support',
    'technical_visit',
    'alignment_meeting',
    'presentation',
    'audit',
    'inspection',
    'training',
    'external_service',
    'other'
);


ALTER TYPE public.visit_type OWNER TO cge;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: cge
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO cge;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: cge
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO cge;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: cge
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patrimony_number text NOT NULL,
    description text NOT NULL,
    brand text,
    model text,
    serial_number text,
    status public.asset_status DEFAULT 'active'::public.asset_status NOT NULL,
    unit_id uuid,
    responsible_person_id uuid,
    acquisition_date date,
    acquisition_value numeric(14,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    room text,
    usage_date date,
    document_number text,
    document_date date,
    commitment_number text,
    conservation_status text,
    renavam text,
    chassis text
);


ALTER TABLE public.assets OWNER TO cge;

--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_account_id uuid,
    action character varying(120) NOT NULL,
    object_type character varying(80) NOT NULL,
    object_id uuid,
    outcome character varying(40) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_events OWNER TO cge;

--
-- Name: employment_categories; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.employment_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    vacation_eligible boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.employment_categories OWNER TO cge;

--
-- Name: employment_relationships; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.employment_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    category_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    supervisor_relationship_id uuid,
    start_date date NOT NULL,
    end_date date,
    job_title character varying(160),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employee_number character varying(50),
    CONSTRAINT employment_relationships_valid_dates CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);


ALTER TABLE public.employment_relationships OWNER TO cge;

--
-- Name: import_errors; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.import_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_run_id uuid NOT NULL,
    row_number integer NOT NULL,
    field character varying(100),
    message text NOT NULL,
    row_data jsonb
);


ALTER TABLE public.import_errors OWNER TO cge;

--
-- Name: import_runs; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.import_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_filename character varying(255) NOT NULL,
    checksum character varying(64) NOT NULL,
    status public.import_status DEFAULT 'previewed'::public.import_status NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    successful_rows integer DEFAULT 0 NOT NULL,
    failed_rows integer DEFAULT 0 NOT NULL,
    created_by_account_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


ALTER TABLE public.import_runs OWNER TO cge;

--
-- Name: organization_units; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.organization_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(160) NOT NULL,
    parent_id uuid,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.organization_units OWNER TO cge;

--
-- Name: people; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(180) NOT NULL,
    preferred_name character varying(120),
    birth_date date,
    birthday_visible boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_object_key character varying(255),
    avatar_updated_at timestamp with time zone
);


ALTER TABLE public.people OWNER TO cge;

--
-- Name: permission_overrides; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.permission_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    permission character varying(100) NOT NULL,
    effect character varying(10) NOT NULL,
    unit_id uuid
);


ALTER TABLE public.permission_overrides OWNER TO cge;

--
-- Name: role_assignments; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.role_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    role_id uuid NOT NULL,
    unit_id uuid
);


ALTER TABLE public.role_assignments OWNER TO cge;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission character varying(100) NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO cge;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(240)
);


ALTER TABLE public.roles OWNER TO cge;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash character varying(64) NOT NULL,
    account_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO cge;

--
-- Name: user_accounts; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.user_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    email character varying(254) NOT NULL,
    password_hash character varying(255) NOT NULL,
    status public.account_status DEFAULT 'active'::public.account_status NOT NULL,
    force_password_change_at timestamp with time zone,
    password_changed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_accounts OWNER TO cge;

--
-- Name: vacation_request_events; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.vacation_request_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vacation_request_id uuid NOT NULL,
    actor_account_id uuid NOT NULL,
    type text NOT NULL,
    comment text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vacation_request_events OWNER TO cge;

--
-- Name: vacation_requests; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.vacation_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employment_relationship_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status public.vacation_status DEFAULT 'draft'::public.vacation_status NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    supervisor_relationship_id uuid,
    CONSTRAINT vacation_requests_positive_version CHECK ((version > 0)),
    CONSTRAINT vacation_requests_valid_dates CHECK ((end_date >= start_date))
);


ALTER TABLE public.vacation_requests OWNER TO cge;

--
-- Name: visit_events; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.visit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_id uuid NOT NULL,
    actor_account_id uuid NOT NULL,
    type text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.visit_events OWNER TO cge;

--
-- Name: visit_visitors; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.visit_visitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_id uuid NOT NULL,
    name text NOT NULL,
    "position" text,
    organization text NOT NULL,
    sector text,
    email text,
    phone text,
    cpf text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmation_status character varying(20) DEFAULT 'not_sent'::character varying NOT NULL,
    confirmation_token_hash character varying(64),
    confirmation_sent_at timestamp with time zone,
    confirmation_responded_at timestamp with time zone,
    confirmation_expires_at timestamp with time zone
);


ALTER TABLE public.visit_visitors OWNER TO cge;

--
-- Name: visits; Type: TABLE; Schema: public; Owner: cge
--

CREATE TABLE public.visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    protocol text NOT NULL,
    type public.visit_type NOT NULL,
    subject text NOT NULL,
    description text,
    organization text NOT NULL,
    sector text,
    scheduled_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    location text NOT NULL,
    responsible_unit_id uuid,
    responsible_account_id uuid,
    created_by_account_id uuid NOT NULL,
    status public.visit_status DEFAULT 'pending'::public.visit_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT visits_valid_time CHECK ((end_time > start_time))
);


ALTER TABLE public.visits OWNER TO cge;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: cge
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: cge
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	9155b38c2344e4748d36d416cb88c3cab192fae4dcf4c53e4696eb6ef8447ca0	1785262327736
2	e934ecea1fcd7446ffb6f0cc63f0bde0904802cccaea8f513a6ca7e5e7cee7cf	1785263278596
3	045dc59b8e732a10896bf8ea0ea34339224680dabe0d75c1e432c062db7f5b31	1785263563246
4	a27db3047fc34d3657d72990f560d508b9c7f46f67a6cbfafe426db382f183d2	1785280858689
5	26dda2336da36d9de0e06c3cb7bdbc47d867cb4550ca3ce25ec4f408b6b61ad8	1785292056411
6	36ecbd6b02ed0aa225651bebd4d6021b621b98bb017ebfae66a17937ae956316	1786642081972
7	243d508a322ed00209f90432c8bc9fa9551efa9c1e0d33f1a1de1e08ba45ce75	1787924999227
8	76ff6a480cf8a0b0570875430da796525b9bf49e310afb24809568b93860f14a	1788275777311
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.assets (id, patrimony_number, description, brand, model, serial_number, status, unit_id, responsible_person_id, acquisition_date, acquisition_value, notes, created_at, updated_at, room, usage_date, document_number, document_date, commitment_number, conservation_status, renavam, chassis) FROM stdin;
8a35a75f-b3c7-4f59-9d01-66f1af73ea9b	PAT-0001	Notebook Dell	Delll	OptiPlex 7010	SN-TESTE-001	active	\N	\N	2026-08-28	5500.00	Bem cadastrado para teste do módulo de patrimônio.	2026-08-28 17:35:40.363522+00	2026-09-09 12:35:13.828+00	Denit	\N	\N	\N	\N	Bom	\N	\N
b0fbe843-a77e-4749-8c30-1c7cee5be4ba	1000	Celular Nokia T	Nokia	Modelo 25	\N	active	f92ddb96-1343-41a9-a821-21246563adf6	\N	2000-09-05	200.00	Precisa de manutenção	2026-09-02 15:46:42.728097+00	2026-09-09 12:52:11.543+00	DENIT	2026-09-22	NF1000	2000-09-20	\N	Bom	\N	\N
ea5cd712-90e6-4050-927e-67ee7d8d8d0e	9999	Bem testes	Teste2	modelo xx	\N	active	f92ddb96-1343-41a9-a821-21246563adf6	\N	\N	1000.01	\N	2026-09-01 17:58:00.167498+00	2026-09-09 12:53:28.393+00	sala de estarr	\N	NF999	\N	\N	Bom	\N	\N
297622ac-7c72-425c-93a2-3b4e6b4fcd7b	1002	Monitor Voige	Voige	AxL	SN-TESTE-003	active	9bbb4270-1bff-489f-893e-3d8f9248b7df	\N	2022-09-13	1050.00	\N	2026-09-09 13:13:37.383623+00	2026-09-09 13:13:37.383623+00	\N	2026-09-01	NF552	2026-09-10	\N	Ótimo	\N	\N
\.


--
-- Data for Name: audit_events; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.audit_events (id, actor_account_id, action, object_type, object_id, outcome, metadata, created_at) FROM stdin;
2236684e-45b2-48d3-9f14-1d87ab5b3715	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	platform-admin.bootstrapped	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-20 15:27:22.77849+00
9cfff0f6-868b-435c-85aa-c6cb29887309	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-20 15:32:52.274013+00
baa4bc9b-9a66-4c5f-bd78-fe041df5db35	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.password-change	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-20 15:34:39.511374+00
0205af24-04c0-44fc-b38e-d6a9b6422353	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-20 15:35:00.464987+00
65c8e6e9-7948-4a1c-8ac0-20ae1d41b818	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-21 12:05:20.681894+00
5855d8bc-d9f5-4394-9101-01c19a51fb20	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-24 14:45:47.936645+00
c11e4af2-3c39-4418-b831-5fdb2122316d	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-25 12:10:52.566808+00
036e5b34-fe00-462f-ac7a-d75c23f1e5c5	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.logout	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-25 12:46:26.99575+00
03d2a6c6-f429-448d-bea7-aed337758265	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-25 12:47:11.856852+00
3f03c6b8-8b56-4266-990c-bb7af2919317	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-25 12:47:47.015537+00
340eb478-b0ff-4b09-a8e2-4013240aa982	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	platform-admin.bootstrapped	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-25 13:07:02.76191+00
de9b5b03-a314-4c38-8809-02059f0e5cee	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-26 12:08:55.775463+00
872ed367-7c59-472d-97b0-4bba9343a00f	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-26 17:57:19.724571+00
537780a1-c21e-43cb-a32a-1ffd76b366bd	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-27 12:08:16.49771+00
c2106aab-b436-462a-a1d4-bc16603016ab	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-27 14:19:43.289375+00
2675ceb0-f0a3-4848-b122-36f6a090eab1	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	permission-override.created	permission-override	5bd819a5-29ca-4e65-a1b2-4b7bb6a543f4	success	{"effect": "allow", "unitId": null, "accountId": "551ccb0c-ca9f-4e0b-b2d9-cc90af398676", "permission": "assets.read"}	2026-08-27 14:22:45.882166+00
052eb0a9-c8d4-41b0-9cea-2183e577d935	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	permission-override.created	permission-override	1872fe4c-1e84-415a-8118-05e772c5c892	success	{"effect": "allow", "unitId": null, "accountId": "551ccb0c-ca9f-4e0b-b2d9-cc90af398676", "permission": "assets.manage"}	2026-08-27 14:22:51.66989+00
c1782ae8-91b7-41f8-bf5f-3089242ef372	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-28 12:58:23.849032+00
46c4ee66-7835-4b20-96da-e9ffa93c3b4c	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.logout	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-28 15:30:44.782518+00
5c4eacfd-ab86-41ff-8513-b8fc3d93eb55	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-28 15:31:11.420141+00
0c5df6bf-082e-4a08-8692-68347f0cb4b6	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.logout	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-28 17:04:14.659011+00
8a385b84-ed17-4799-9851-8d5617c25f1b	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-28 17:04:52.213054+00
92ca3ad6-9a7c-4462-bdbe-82cdc9938b82	\N	auth.login	account	\N	failure	{"email": "admin@cge.am.gov.br"}	2026-08-31 12:36:18.814332+00
e50e39ad-6b2c-49cf-89ca-709f7479f8cd	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-31 12:36:24.310979+00
db3b6ca8-7f49-46a9-856a-decc12da0b7b	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-31 15:04:13.227703+00
5acff612-fcc9-4147-ba0a-992e86fd5685	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-08-31 15:32:37.149933+00
6c89d42a-0cd0-402c-9267-7077a966cdb0	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-01 14:16:08.387783+00
19f278d3-2661-42ce-a027-fda82fb78428	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-01 15:35:29.473284+00
83a155e1-8d23-4aa9-a430-6e9355444c03	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-02 12:51:49.499162+00
6cab67d6-4a3b-4415-8d50-2975bf22e1fb	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-02 13:21:57.031028+00
42c9b93f-a7a6-400e-9b3e-febea2d2109a	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-03 14:26:19.573035+00
09632bdf-93ad-446e-802c-bd97db9df7b9	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-03 17:11:36.329931+00
5124e201-43a9-4b25-9535-d72a40a195e8	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-04 12:28:30.966421+00
f4814805-6872-445c-a7cd-e44ea2bcfb6b	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-08 12:31:09.508532+00
7355e640-3f3d-4780-9cff-70e12d54fda5	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.logout	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-08 12:40:00.070918+00
f4349859-581e-4a6b-9ae1-741e4f464c02	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-08 12:40:20.31012+00
b3144843-0a13-4e96-bef3-514ecc93524c	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.logout	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-08 13:19:37.247156+00
e90c9e1c-5325-4126-b465-2f4e133b97ba	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-08 13:19:49.646735+00
d6e01762-a185-482d-89f9-810a7ae6e0f8	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-08 13:33:35.095079+00
807d46e1-5eae-4704-b747-d96ec949790a	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-08 15:29:53.914665+00
467f8dd2-d6f9-4ec8-a3bf-2c0027321705	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-09 12:23:37.749896+00
e411960c-4552-4088-9c5f-5008a883c7d4	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	auth.login	account	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	success	\N	2026-09-09 13:11:05.145381+00
\.


--
-- Data for Name: employment_categories; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.employment_categories (id, name, vacation_eligible, active) FROM stdin;
\.


--
-- Data for Name: employment_relationships; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.employment_relationships (id, person_id, category_id, unit_id, supervisor_relationship_id, start_date, end_date, job_title, notes, created_at, updated_at, employee_number) FROM stdin;
\.


--
-- Data for Name: import_errors; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.import_errors (id, import_run_id, row_number, field, message, row_data) FROM stdin;
\.


--
-- Data for Name: import_runs; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.import_runs (id, original_filename, checksum, status, total_rows, successful_rows, failed_rows, created_by_account_id, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: organization_units; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.organization_units (id, code, name, parent_id, active) FROM stdin;
f92ddb96-1343-41a9-a821-21246563adf6	TESTE	Setor de Teste 4	\N	t
9bbb4270-1bff-489f-893e-3d8f9248b7df	ATEC	Acessoria Técnica	\N	t
b1ab1fa4-5da0-4226-b249-1477a983ecd8	DAF	Diretoria Administrativa Financeira	\N	t
\.


--
-- Data for Name: people; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.people (id, full_name, preferred_name, birth_date, birthday_visible, created_at, updated_at, avatar_object_key, avatar_updated_at) FROM stdin;
9813e32c-72a3-4f02-a2e7-58d501650586	Administrador da Plataforma	\N	\N	f	2026-08-20 15:27:22.496761+00	2026-08-20 15:27:22.496761+00	\N	\N
\.


--
-- Data for Name: permission_overrides; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.permission_overrides (id, account_id, permission, effect, unit_id) FROM stdin;
5bd819a5-29ca-4e65-a1b2-4b7bb6a543f4	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	assets.read	allow	\N
1872fe4c-1e84-415a-8118-05e772c5c892	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	assets.manage	allow	\N
\.


--
-- Data for Name: role_assignments; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.role_assignments (id, account_id, role_id, unit_id) FROM stdin;
91b29eec-92b1-4460-bb30-adf675b34017	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	5102797d-6dd8-4af9-9d59-3fd3930559b7	\N
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.role_permissions (role_id, permission) FROM stdin;
5102797d-6dd8-4af9-9d59-3fd3930559b7	access.manage
5102797d-6dd8-4af9-9d59-3fd3930559b7	accounts.manage
5102797d-6dd8-4af9-9d59-3fd3930559b7	audit.read
5102797d-6dd8-4af9-9d59-3fd3930559b7	audit.export
5102797d-6dd8-4af9-9d59-3fd3930559b7	people.read
5102797d-6dd8-4af9-9d59-3fd3930559b7	people.manage
5102797d-6dd8-4af9-9d59-3fd3930559b7	people.import
5102797d-6dd8-4af9-9d59-3fd3930559b7	birthdays.read
5102797d-6dd8-4af9-9d59-3fd3930559b7	vacations.create
5102797d-6dd8-4af9-9d59-3fd3930559b7	vacations.review.supervisor
5102797d-6dd8-4af9-9d59-3fd3930559b7	vacations.review.final
5102797d-6dd8-4af9-9d59-3fd3930559b7	visits.read
5102797d-6dd8-4af9-9d59-3fd3930559b7	visits.create
5102797d-6dd8-4af9-9d59-3fd3930559b7	visits.manage
5102797d-6dd8-4af9-9d59-3fd3930559b7	visits.approve
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.roles (id, name, description) FROM stdin;
5102797d-6dd8-4af9-9d59-3fd3930559b7	Administrador da plataforma	Acesso global para implantação e administração.
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.sessions (id, token_hash, account_id, expires_at, created_at, last_seen_at) FROM stdin;
2db0c90f-bde7-4d10-9920-6c0014778b4c	4ef36000d1f68afed96a712a038a74c34f1bb94ada0d3b8a107b21d485d39d06	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-21 03:35:00.467+00	2026-08-20 15:35:00.469619+00	2026-08-20 15:35:00.469619+00
ba5076d3-66e7-4b23-a835-fa6caf17a3a2	9eb928d548b97dd6c8221a286b152b594986fb9c107272fc731982e2bcaed33d	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-22 00:05:20.697+00	2026-08-21 12:05:20.700099+00	2026-08-21 12:05:20.700099+00
e7815bc9-ccf7-4394-a90e-a66d9f3b89b2	526ca86b060ab6123b211b566a560484e33b931fb289991a5dc6539ceb6c6b6d	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-25 02:45:47.99+00	2026-08-24 14:45:47.993107+00	2026-08-24 14:45:47.993107+00
29e7fe9d-efc6-4294-a34b-4e96e4c7c402	9e78cbb8e4ee0f6dd17161bdc18770c5b747dc2ff1a70c6b14622a28a79c94a6	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-26 00:47:11.866+00	2026-08-25 12:47:11.869166+00	2026-08-25 12:47:11.869166+00
94aba872-b5ff-4802-bcc0-091c0f274dc2	61d3fd877371bced64313a4bfc27d000d79135622fed1fbdebdbdb8f017457c0	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-26 00:47:47.025+00	2026-08-25 12:47:47.028805+00	2026-08-25 12:47:47.028805+00
1828eb1d-c466-459b-9dcf-1f9aaec6021b	34b9c633939545f22b6528a42e75272ad0ebaaad05232ee262cda3688f74d1e5	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-27 00:08:55.795+00	2026-08-26 12:08:55.797188+00	2026-08-26 12:08:55.797188+00
96c04ef7-9303-43f2-8868-c7e1b5b69bc0	b20b0477067953a623d59b43f61fbff33872804b82a61bc0a923516b909fc82d	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-27 05:57:19.761+00	2026-08-26 17:57:19.764663+00	2026-08-26 17:57:19.764663+00
ea3e64a1-b1c3-4fdc-b89d-dd9a87ea5058	51d131316170f36f7b2e02fc1f197e022ba148457c4cc1bfcfaae5b127cd6f78	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-28 00:08:16.516+00	2026-08-27 12:08:16.517857+00	2026-08-27 12:08:16.517857+00
69b763c2-c74e-48a9-9d5b-e38999d57071	52b0098c782e59956239024e00377c9fb8ce916d2e58d4263f5b08e1a0e5ff5b	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-28 02:19:43.321+00	2026-08-27 14:19:43.324385+00	2026-08-27 14:19:43.324385+00
d4ed894f-784e-4e1c-a01e-da5e2e881a38	c58ad3b1858821c19522e4452695ac5471fc7b085db45dc3076de83042430417	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-08-29 05:04:52.223+00	2026-08-28 17:04:52.226211+00	2026-08-28 17:04:52.226211+00
992098c8-a097-448d-9f16-232b397f2383	12d34c063d6a401875e10dd95bf5d4befda42e9bef5020fa35e6a9b3618833a7	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-01 00:36:24.328+00	2026-08-31 12:36:24.330018+00	2026-08-31 12:36:24.330018+00
5dc5cc10-c4ed-406c-977d-6c84416dc329	26325cb3f8bc493d0973225bf928eafea2493a1b8ca93dcd0771ad1099fca7b5	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-01 03:04:13.258+00	2026-08-31 15:04:13.259872+00	2026-08-31 15:04:13.259872+00
d738144b-a04b-4467-a0d7-6a83b105d0fc	adf4fba7b2f81705f35a8eca489fed3274d1406fd4c8b924e43b2ff669b0ce50	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-01 03:32:37.184+00	2026-08-31 15:32:37.187363+00	2026-08-31 15:32:37.187363+00
dd1e76ab-343e-4c79-9077-8ae42bda7bc5	8556106fb91df0f8343d6a45c6b987f14bf4f12798eeee58df828b24be665c26	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-02 02:16:08.404+00	2026-09-01 14:16:08.407579+00	2026-09-01 14:16:08.407579+00
329cd0d8-ef26-4c77-8e03-9b4b45dc8114	121c642a847710e945a1c94fea89b8a073633b0642bae34e4bf3d8694a0506d7	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-02 03:35:29.498+00	2026-09-01 15:35:29.496271+00	2026-09-01 15:35:29.496271+00
03c53ca8-f191-4623-8604-bb339e4203f9	0338cad4c5519b302b4ddc7e1c4fe6cb880f1d742056ed67e6eedae9350aebda	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-03 00:51:49.514+00	2026-09-02 12:51:49.518699+00	2026-09-02 12:51:49.518699+00
7914f8c7-4917-4a8c-8be7-14e63d6f0794	39e24645f23273c178d29187d514eb9765129a431263c47302666e914bf70b43	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-03 01:21:57.087+00	2026-09-02 13:21:57.094279+00	2026-09-02 13:21:57.094279+00
12bab96c-c17e-4add-a905-f54419d5744c	0586ec89f02cd856aac4763edf95b3f0645fb0302bda29c470bf4b5672bf36a4	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-04 02:26:19.595+00	2026-09-03 14:26:19.588479+00	2026-09-03 14:26:19.588479+00
fc2264c6-084f-44ec-b787-5009cd036849	7943ae6830965fcd30a8e0278f539b39d53872925478110c079b8c3581f272c9	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-04 05:11:36.352+00	2026-09-03 17:11:36.368864+00	2026-09-03 17:11:36.368864+00
d0a8990b-6326-40b3-883a-c685128a5154	832b3317248a866c716cc365ccd14e7293733e321ea68c38fa3423e0800401ce	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-05 00:28:30.986+00	2026-09-04 12:28:30.991491+00	2026-09-04 12:28:30.991491+00
42322bc6-b208-4db1-a076-bd6de24c7f29	6f05d66c20dd801e556202d758de004512016460e15e1b2ecb649b72a01a0b44	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-09 01:19:49.65+00	2026-09-08 13:19:49.660784+00	2026-09-08 13:19:49.660784+00
a0d580ce-ace5-452e-a8d9-e4c58e7fba48	90037f0085b53008ebe6ff78e7caa984dca9a1994419afd78386ef703cd47c1d	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-09 01:33:35.105+00	2026-09-08 13:33:35.108589+00	2026-09-08 13:33:35.108589+00
f9894461-cfe0-4603-9005-29c1908b9a59	e92cae5d95f3b09ba1c1a8312fc2883d4ade8adba3f7b5c4450203578042799f	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-09 03:29:53.928+00	2026-09-08 15:29:53.93128+00	2026-09-08 15:29:53.93128+00
d277c89a-0a70-4627-a53c-400b64a2c8a1	c3abc41e943c56bbfe5a4c7eee260ed79282ddf064523de90ec6fe85c0b71055	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-10 00:23:37.778+00	2026-09-09 12:23:37.768205+00	2026-09-09 12:23:37.768205+00
3f481de6-01f0-4dea-b1cc-be9d61427df0	939e959bd73948c87501a063281e547027cfd18fcd89b2258a025a9d7be67188	551ccb0c-ca9f-4e0b-b2d9-cc90af398676	2026-09-10 01:11:05.18+00	2026-09-09 13:11:05.181204+00	2026-09-09 13:11:05.181204+00
\.


--
-- Data for Name: user_accounts; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.user_accounts (id, person_id, email, password_hash, status, force_password_change_at, password_changed_at, created_at, updated_at) FROM stdin;
551ccb0c-ca9f-4e0b-b2d9-cc90af398676	9813e32c-72a3-4f02-a2e7-58d501650586	admin@cge.am.gov.br	$argon2id$v=19$m=65536,p=1,t=3$1JX/zR1kfFiTJqBcMMj83Q$vnY9KI3HMYxWMj+55ZZc9A+AXL7CgFjmyA3KO0ObnDA	active	\N	2026-08-20 15:34:39.486+00	2026-08-20 15:27:22.496761+00	2026-08-20 15:34:39.486+00
\.


--
-- Data for Name: vacation_request_events; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.vacation_request_events (id, vacation_request_id, actor_account_id, type, comment, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: vacation_requests; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.vacation_requests (id, employment_relationship_id, start_date, end_date, status, version, created_at, updated_at, supervisor_relationship_id) FROM stdin;
\.


--
-- Data for Name: visit_events; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.visit_events (id, visit_id, actor_account_id, type, comment, created_at) FROM stdin;
\.


--
-- Data for Name: visit_visitors; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.visit_visitors (id, visit_id, name, "position", organization, sector, email, phone, cpf, created_at, confirmation_status, confirmation_token_hash, confirmation_sent_at, confirmation_responded_at, confirmation_expires_at) FROM stdin;
\.


--
-- Data for Name: visits; Type: TABLE DATA; Schema: public; Owner: cge
--

COPY public.visits (id, protocol, type, subject, description, organization, sector, scheduled_date, start_time, end_time, location, responsible_unit_id, responsible_account_id, created_by_account_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: cge
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 8, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: cge
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: assets assets_patrimony_number_unique; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_patrimony_number_unique UNIQUE (patrimony_number);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: employment_categories employment_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.employment_categories
    ADD CONSTRAINT employment_categories_pkey PRIMARY KEY (id);


--
-- Name: employment_relationships employment_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.employment_relationships
    ADD CONSTRAINT employment_relationships_pkey PRIMARY KEY (id);


--
-- Name: import_errors import_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.import_errors
    ADD CONSTRAINT import_errors_pkey PRIMARY KEY (id);


--
-- Name: import_runs import_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.import_runs
    ADD CONSTRAINT import_runs_pkey PRIMARY KEY (id);


--
-- Name: organization_units organization_units_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.organization_units
    ADD CONSTRAINT organization_units_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: permission_overrides permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_pkey PRIMARY KEY (id);


--
-- Name: role_assignments role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_pk; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_pk PRIMARY KEY (role_id, permission);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: user_accounts user_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.user_accounts
    ADD CONSTRAINT user_accounts_pkey PRIMARY KEY (id);


--
-- Name: vacation_request_events vacation_request_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.vacation_request_events
    ADD CONSTRAINT vacation_request_events_pkey PRIMARY KEY (id);


--
-- Name: vacation_requests vacation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.vacation_requests
    ADD CONSTRAINT vacation_requests_pkey PRIMARY KEY (id);


--
-- Name: visit_events visit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visit_events
    ADD CONSTRAINT visit_events_pkey PRIMARY KEY (id);


--
-- Name: visit_visitors visit_visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visit_visitors
    ADD CONSTRAINT visit_visitors_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: visits visits_protocol_unique; Type: CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_protocol_unique UNIQUE (protocol);


--
-- Name: audit_events_actor_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX audit_events_actor_idx ON public.audit_events USING btree (actor_account_id);


--
-- Name: audit_events_created_at_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX audit_events_created_at_idx ON public.audit_events USING btree (created_at);


--
-- Name: audit_events_object_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX audit_events_object_idx ON public.audit_events USING btree (object_type, object_id);


--
-- Name: employment_categories_name_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX employment_categories_name_unique ON public.employment_categories USING btree (name);


--
-- Name: employment_relationships_employee_number_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX employment_relationships_employee_number_unique ON public.employment_relationships USING btree (employee_number) WHERE (employee_number IS NOT NULL);


--
-- Name: employment_relationships_one_active_per_person; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX employment_relationships_one_active_per_person ON public.employment_relationships USING btree (person_id) WHERE (end_date IS NULL);


--
-- Name: employment_relationships_person_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX employment_relationships_person_idx ON public.employment_relationships USING btree (person_id);


--
-- Name: employment_relationships_supervisor_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX employment_relationships_supervisor_idx ON public.employment_relationships USING btree (supervisor_relationship_id);


--
-- Name: employment_relationships_unit_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX employment_relationships_unit_idx ON public.employment_relationships USING btree (unit_id);


--
-- Name: import_errors_run_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX import_errors_run_idx ON public.import_errors USING btree (import_run_id);


--
-- Name: import_runs_checksum_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX import_runs_checksum_idx ON public.import_runs USING btree (checksum);


--
-- Name: import_runs_created_at_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX import_runs_created_at_idx ON public.import_runs USING btree (created_at);


--
-- Name: organization_units_code_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX organization_units_code_unique ON public.organization_units USING btree (code);


--
-- Name: organization_units_parent_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX organization_units_parent_idx ON public.organization_units USING btree (parent_id);


--
-- Name: people_full_name_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX people_full_name_idx ON public.people USING btree (full_name);


--
-- Name: permission_overrides_account_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX permission_overrides_account_idx ON public.permission_overrides USING btree (account_id);


--
-- Name: permission_overrides_global_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX permission_overrides_global_unique ON public.permission_overrides USING btree (account_id, permission) WHERE (unit_id IS NULL);


--
-- Name: permission_overrides_unit_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX permission_overrides_unit_unique ON public.permission_overrides USING btree (account_id, permission, unit_id) WHERE (unit_id IS NOT NULL);


--
-- Name: role_assignments_account_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX role_assignments_account_idx ON public.role_assignments USING btree (account_id);


--
-- Name: role_assignments_global_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX role_assignments_global_unique ON public.role_assignments USING btree (account_id, role_id) WHERE (unit_id IS NULL);


--
-- Name: role_assignments_unit_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX role_assignments_unit_idx ON public.role_assignments USING btree (unit_id);


--
-- Name: role_assignments_unit_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX role_assignments_unit_unique ON public.role_assignments USING btree (account_id, role_id, unit_id) WHERE (unit_id IS NOT NULL);


--
-- Name: roles_name_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX roles_name_unique ON public.roles USING btree (name);


--
-- Name: sessions_account_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX sessions_account_idx ON public.sessions USING btree (account_id);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_token_hash_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX sessions_token_hash_unique ON public.sessions USING btree (token_hash);


--
-- Name: user_accounts_email_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX user_accounts_email_unique ON public.user_accounts USING btree (lower((email)::text));


--
-- Name: user_accounts_person_unique; Type: INDEX; Schema: public; Owner: cge
--

CREATE UNIQUE INDEX user_accounts_person_unique ON public.user_accounts USING btree (person_id);


--
-- Name: vacation_request_events_request_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX vacation_request_events_request_idx ON public.vacation_request_events USING btree (vacation_request_id);


--
-- Name: vacation_requests_employment_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX vacation_requests_employment_idx ON public.vacation_requests USING btree (employment_relationship_id);


--
-- Name: vacation_requests_status_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX vacation_requests_status_idx ON public.vacation_requests USING btree (status);


--
-- Name: visit_events_visit_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX visit_events_visit_idx ON public.visit_events USING btree (visit_id);


--
-- Name: visit_visitors_visit_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX visit_visitors_visit_idx ON public.visit_visitors USING btree (visit_id);


--
-- Name: visits_responsible_unit_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX visits_responsible_unit_idx ON public.visits USING btree (responsible_unit_id);


--
-- Name: visits_scheduled_date_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX visits_scheduled_date_idx ON public.visits USING btree (scheduled_date);


--
-- Name: visits_status_idx; Type: INDEX; Schema: public; Owner: cge
--

CREATE INDEX visits_status_idx ON public.visits USING btree (status);


--
-- Name: assets assets_responsible_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_responsible_person_id_people_id_fk FOREIGN KEY (responsible_person_id) REFERENCES public.people(id);


--
-- Name: assets assets_unit_id_organization_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_unit_id_organization_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.organization_units(id);


--
-- Name: audit_events audit_events_actor_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_account_id_user_accounts_id_fk FOREIGN KEY (actor_account_id) REFERENCES public.user_accounts(id);


--
-- Name: employment_relationships employment_relationships_category_id_employment_categories_id_f; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.employment_relationships
    ADD CONSTRAINT employment_relationships_category_id_employment_categories_id_f FOREIGN KEY (category_id) REFERENCES public.employment_categories(id);


--
-- Name: employment_relationships employment_relationships_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.employment_relationships
    ADD CONSTRAINT employment_relationships_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: employment_relationships employment_relationships_supervisor_relationship_id_employment_; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.employment_relationships
    ADD CONSTRAINT employment_relationships_supervisor_relationship_id_employment_ FOREIGN KEY (supervisor_relationship_id) REFERENCES public.employment_relationships(id);


--
-- Name: employment_relationships employment_relationships_unit_id_organization_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.employment_relationships
    ADD CONSTRAINT employment_relationships_unit_id_organization_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.organization_units(id);


--
-- Name: import_errors import_errors_import_run_id_import_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.import_errors
    ADD CONSTRAINT import_errors_import_run_id_import_runs_id_fk FOREIGN KEY (import_run_id) REFERENCES public.import_runs(id) ON DELETE CASCADE;


--
-- Name: import_runs import_runs_created_by_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.import_runs
    ADD CONSTRAINT import_runs_created_by_account_id_user_accounts_id_fk FOREIGN KEY (created_by_account_id) REFERENCES public.user_accounts(id);


--
-- Name: organization_units organization_units_parent_id_organization_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.organization_units
    ADD CONSTRAINT organization_units_parent_id_organization_units_id_fk FOREIGN KEY (parent_id) REFERENCES public.organization_units(id);


--
-- Name: permission_overrides permission_overrides_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_account_id_user_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE;


--
-- Name: permission_overrides permission_overrides_unit_id_organization_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.permission_overrides
    ADD CONSTRAINT permission_overrides_unit_id_organization_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.organization_units(id);


--
-- Name: role_assignments role_assignments_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_account_id_user_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE;


--
-- Name: role_assignments role_assignments_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_assignments role_assignments_unit_id_organization_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_unit_id_organization_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.organization_units(id);


--
-- Name: role_permissions role_permissions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_account_id_user_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE;


--
-- Name: user_accounts user_accounts_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.user_accounts
    ADD CONSTRAINT user_accounts_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: vacation_request_events vacation_request_events_actor_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.vacation_request_events
    ADD CONSTRAINT vacation_request_events_actor_account_id_user_accounts_id_fk FOREIGN KEY (actor_account_id) REFERENCES public.user_accounts(id);


--
-- Name: vacation_request_events vacation_request_events_vacation_request_id_vacation_requests_i; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.vacation_request_events
    ADD CONSTRAINT vacation_request_events_vacation_request_id_vacation_requests_i FOREIGN KEY (vacation_request_id) REFERENCES public.vacation_requests(id) ON DELETE CASCADE;


--
-- Name: vacation_requests vacation_requests_employment_relationship_id_employment_relatio; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.vacation_requests
    ADD CONSTRAINT vacation_requests_employment_relationship_id_employment_relatio FOREIGN KEY (employment_relationship_id) REFERENCES public.employment_relationships(id);


--
-- Name: vacation_requests vacation_requests_supervisor_relationship_id_employment_relatio; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.vacation_requests
    ADD CONSTRAINT vacation_requests_supervisor_relationship_id_employment_relatio FOREIGN KEY (supervisor_relationship_id) REFERENCES public.employment_relationships(id);


--
-- Name: visit_events visit_events_actor_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visit_events
    ADD CONSTRAINT visit_events_actor_account_id_user_accounts_id_fk FOREIGN KEY (actor_account_id) REFERENCES public.user_accounts(id);


--
-- Name: visit_events visit_events_visit_id_visits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visit_events
    ADD CONSTRAINT visit_events_visit_id_visits_id_fk FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE;


--
-- Name: visit_visitors visit_visitors_visit_id_visits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visit_visitors
    ADD CONSTRAINT visit_visitors_visit_id_visits_id_fk FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE;


--
-- Name: visits visits_created_by_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_created_by_account_id_user_accounts_id_fk FOREIGN KEY (created_by_account_id) REFERENCES public.user_accounts(id);


--
-- Name: visits visits_responsible_account_id_user_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_responsible_account_id_user_accounts_id_fk FOREIGN KEY (responsible_account_id) REFERENCES public.user_accounts(id);


--
-- Name: visits visits_responsible_unit_id_organization_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: cge
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_responsible_unit_id_organization_units_id_fk FOREIGN KEY (responsible_unit_id) REFERENCES public.organization_units(id);


--
-- PostgreSQL database dump complete
--

\unrestrict NVzBNGvb303laSDhf3DpgBy4TU8Kiau6eMlbJW1SV3eUOiF3BVdncbHLshvQZsN

